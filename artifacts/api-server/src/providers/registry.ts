import { v4 as uuid } from "uuid";
import db from "../db/index.js";
import { decryptSecret } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";

export const DEMO_MODE: boolean = (process.env.DEMO_MODE || "false").toLowerCase() === "true";

export interface ProviderKeyRow {
  id: string;
  provider_name: string;
  encrypted_key: string;
  enabled: number;
  priority: number;
  status: string | null;
  cooldown_until: string | null;
  error_count: number;
}

export interface ActiveKey {
  id: string;
  key: string;
  source: "env" | "db";
}

export function getActiveKey(providerName: string): ActiveKey | null {
  const envMap: Record<string, string | undefined> = {
    anthropic: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    freepik: process.env.FREEPIK_API_KEY || process.env.MAGNIFIC_API_KEY,
    magnific: process.env.MAGNIFIC_API_KEY,
    razorpay: process.env.RAZORPAY_KEY_SECRET,
  };
  const envKey = envMap[providerName];
  if (envKey) return { id: `env:${providerName}`, key: envKey, source: "env" };

  const row = db
    .prepare<[string], ProviderKeyRow>(
      `SELECT id, provider_name, encrypted_key, enabled, priority, status, cooldown_until, error_count
       FROM provider_keys
       WHERE provider_name = ? AND enabled = 1
         AND (cooldown_until IS NULL OR cooldown_until < strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ORDER BY priority DESC, error_count ASC
       LIMIT 1`,
    )
    .get(providerName);

  if (!row) return null;
  try {
    return { id: row.id, key: decryptSecret(row.encrypted_key), source: "db" };
  } catch {
    return null;
  }
}

/**
 * Record a provider error against a key. If the error suggests a key-level
 * problem (auth, quota, persistent rate-limit), set a cooldown so the next
 * call automatically fails over to a different key.
 */
export function recordKeyError(opts: {
  providerName: string;
  keyId: string;
  statusCode?: number;
  message?: string;
}): void {
  if (opts.keyId.startsWith("env:")) return;

  // Persistently bump error count so weighted ordering deprioritises it.
  try {
    db.prepare(
      "UPDATE provider_keys SET error_count = error_count + 1, last_failure_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), notes = ? WHERE id = ?",
    ).run((opts.message || "").slice(0, 500), opts.keyId);
  } catch (err) {
    logger.warn({ err }, "recordKeyError: failed to bump error_count");
  }

  const status = opts.statusCode || 0;
  const isQuota = status === 429 || status === 402;
  const isAuth = status === 401 || status === 403;
  const isHardServer = status === 500 || status === 502 || status === 503 || status === 504;

  let cooldownMin = 0;
  if (isQuota) cooldownMin = 15;
  else if (isAuth) cooldownMin = 24 * 60;
  else if (isHardServer) cooldownMin = 5;

  if (cooldownMin > 0) {
    const until = new Date(Date.now() + cooldownMin * 60 * 1000).toISOString();
    try {
      db.prepare("UPDATE provider_keys SET cooldown_until = ?, status = ? WHERE id = ?").run(
        until,
        isAuth ? "auth_failed" : isQuota ? "quota_exhausted" : "transient_error",
        opts.keyId,
      );
      // Failover event log.
      const next = db
        .prepare<[string, string], { id: string }>(
          `SELECT id FROM provider_keys
           WHERE provider_name = ? AND enabled = 1 AND id != ?
             AND (cooldown_until IS NULL OR cooldown_until < strftime('%Y-%m-%dT%H:%M:%fZ','now'))
           ORDER BY priority DESC, error_count ASC LIMIT 1`,
        )
        .get(opts.providerName, opts.keyId);
      db.prepare(
        "INSERT INTO provider_failover_events (id, provider_name, from_key_id, to_key_id, reason) VALUES (?, ?, ?, ?, ?)",
      ).run(uuid(), opts.providerName, opts.keyId, next?.id || null, `${status}:${(opts.message || "").slice(0, 200)}`);
    } catch (err) {
      logger.warn({ err }, "recordKeyError: failed to apply cooldown / log failover");
    }
  }
}

/**
 * Convenience wrapper: run `fn` with the active key for a provider; on a
 * failure that looks key-related, mark the key and retry once with the next
 * available key.
 */
export async function withFailover<T>(
  providerName: string,
  fn: (key: ActiveKey) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const k = getActiveKey(providerName);
    if (!k) {
      throw lastErr || Object.assign(new Error(`No keys available for ${providerName}`), { statusCode: 503 });
    }
    try {
      return await fn(k);
    } catch (err) {
      lastErr = err;
      const e = err as { statusCode?: number; message?: string };
      const code = e?.statusCode || 0;
      const looksKeyRelated = code === 401 || code === 403 || code === 429 || code === 402 || code >= 500;
      if (!looksKeyRelated || k.source === "env") {
        throw err;
      }
      recordKeyError({ providerName, keyId: k.id, statusCode: code, message: e?.message });
    }
  }
  throw lastErr;
}

export function notConfiguredError(providerName: string, capability: string) {
  return {
    error: "provider_not_configured",
    provider: providerName,
    capability,
    message: `Provider "${providerName}" is not configured. Add an API key in Admin → Provider Keys, enable Demo Mode, or set the corresponding environment variable.`,
  };
}

export function demoResponse(kind: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    demo: true,
    kind,
    note: "DEMO_MODE response — no provider call was made.",
    ...extra,
  };
}
