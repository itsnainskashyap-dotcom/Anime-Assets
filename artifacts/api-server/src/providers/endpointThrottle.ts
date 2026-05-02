/**
 * Persistent endpoint cooldowns + per-endpoint concurrency limiter for the
 * Magnific API.
 *
 * Why this exists:
 *   - Magnific imposes BOTH a per-minute rate limit ("You've hit your minute
 *     limit") AND a per-day quota ("You've hit your daily limit") on each
 *     image/video endpoint. When we run a multi-scene visualization stage we
 *     can easily fire 30+ parallel calls and trigger the per-minute limit.
 *   - The previous in-memory cooldown registry was lost on every api-server
 *     restart, which meant a daily-quota-exhausted endpoint got hammered
 *     again as soon as the worker came back up.
 *
 * Design:
 *   - `endpointInCooldown(endpoint)` reads from `provider_endpoint_cooldowns`
 *     so the cooldown survives restarts.
 *   - `tripEndpointCooldown(endpoint, ms, reason)` writes to the same table.
 *   - `acquireSlot(endpoint, max)` is a tiny per-endpoint semaphore so we
 *     never exceed `max` in-flight calls per endpoint per process.
 */
import db from "../db/index.js";
import { logger } from "../lib/logger.js";

const cooldownCache = new Map<string, { until: number; checkedAt: number }>();
const COOLDOWN_CACHE_TTL_MS = 5_000;

export function endpointInCooldown(endpoint: string): boolean {
  const cached = cooldownCache.get(endpoint);
  const now = Date.now();
  if (cached && now - cached.checkedAt < COOLDOWN_CACHE_TTL_MS) {
    return now < cached.until;
  }
  try {
    const row = db
      .prepare(
        "SELECT until_ms FROM provider_endpoint_cooldowns WHERE endpoint = ?",
      )
      .get(endpoint) as { until_ms?: number } | undefined;
    const until = row?.until_ms ?? 0;
    cooldownCache.set(endpoint, { until, checkedAt: now });
    return now < until;
  } catch (err) {
    logger.warn({ err, endpoint }, "endpointInCooldown: db read failed");
    return false;
  }
}

export function tripEndpointCooldown(
  endpoint: string,
  durationMs: number,
  reason: string,
): void {
  const until = Date.now() + durationMs;
  try {
    db.prepare(
      `INSERT INTO provider_endpoint_cooldowns(endpoint, until_ms, reason, failure_count, updated_at)
       VALUES(?, ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(endpoint) DO UPDATE SET
         until_ms = excluded.until_ms,
         reason = excluded.reason,
         failure_count = provider_endpoint_cooldowns.failure_count + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    ).run(endpoint, until, reason);
    cooldownCache.set(endpoint, { until, checkedAt: Date.now() });
    logger.warn(
      { endpoint, reason, until: new Date(until).toISOString() },
      "endpoint cooldown engaged — falling back to next provider",
    );
  } catch (err) {
    logger.warn({ err, endpoint }, "tripEndpointCooldown: db write failed");
  }
}

export function clearEndpointCooldown(endpoint: string): void {
  try {
    db.prepare("DELETE FROM provider_endpoint_cooldowns WHERE endpoint = ?").run(
      endpoint,
    );
    cooldownCache.delete(endpoint);
  } catch (err) {
    logger.warn({ err, endpoint }, "clearEndpointCooldown: db delete failed");
  }
}

// ── Per-endpoint concurrency limiter (semaphore) ─────────────────────────
const inFlight = new Map<string, number>();
const waiters = new Map<string, Array<() => void>>();

/**
 * Acquire a slot for `endpoint`, blocking when `max` calls are already in
 * flight to that endpoint. Returns a release function that the caller MUST
 * invoke (preferably in a finally block) to free the slot. This keeps us
 * under Magnific's per-minute throttle without sacrificing throughput.
 */
export async function acquireSlot(
  endpoint: string,
  max: number,
): Promise<() => void> {
  const current = inFlight.get(endpoint) ?? 0;
  if (current < max) {
    inFlight.set(endpoint, current + 1);
    return () => releaseSlot(endpoint);
  }
  return new Promise<() => void>((resolve) => {
    const queue = waiters.get(endpoint) ?? [];
    queue.push(() => {
      inFlight.set(endpoint, (inFlight.get(endpoint) ?? 0) + 1);
      resolve(() => releaseSlot(endpoint));
    });
    waiters.set(endpoint, queue);
  });
}

function releaseSlot(endpoint: string): void {
  const current = inFlight.get(endpoint) ?? 0;
  inFlight.set(endpoint, Math.max(0, current - 1));
  const queue = waiters.get(endpoint);
  if (queue && queue.length > 0) {
    const next = queue.shift()!;
    next();
  }
}

// ── Concurrency limits per endpoint family ───────────────────────────────
// Magnific's per-minute throttle on nano-banana-pro kicks in around ~10
// concurrent submits per process. Cap at 4 to leave headroom for retries.
export const ENDPOINT_CONCURRENCY: Record<string, number> = {
  "nano-banana-pro": 4,
  "imagen4-ultra": 6,
  "seedream-v4": 6,
  // Kling video is much heavier — keep parallel submits low so we don't
  // saturate the per-minute submit limit on the video endpoint.
  "kling-v3-omni-pro": 3,
};

export function concurrencyFor(endpoint: string): number {
  for (const [key, value] of Object.entries(ENDPOINT_CONCURRENCY)) {
    if (endpoint.includes(key)) return value;
  }
  return 8; // generous default for endpoints we haven't tuned
}
