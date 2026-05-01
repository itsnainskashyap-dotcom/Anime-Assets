/**
 * Lightweight HTTP client for the Magnific AI API.
 *
 * Defaults match the official documentation at https://docs.magnific.com:
 *   - base URL: https://api.magnific.com
 *   - auth header: x-magnific-api-key
 * Both are overridable via MAGNIFIC_API_BASE_URL / MAGNIFIC_AUTH_HEADER for
 * deployments that proxy through Freepik or another mirror.
 */
import { logger } from "../lib/logger.js";
import { getActiveKey, notConfiguredError, withFailover } from "./registry.js";
import db from "../db/index.js";
import { v4 as uuid } from "uuid";

const BASE_URL = process.env.MAGNIFIC_API_BASE_URL || "https://api.magnific.com";
const AUTH_HEADER = process.env.MAGNIFIC_AUTH_HEADER || "x-magnific-api-key";
const TIMEOUT_MS = Number(process.env.MAGNIFIC_TIMEOUT_MS || "60000");

export class MagnificError extends Error {
  statusCode: number;
  response?: unknown;
  constructor(message: string, statusCode = 500, response?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.response = response;
  }
}

function logCall(opts: {
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  keyId?: string;
}): void {
  try {
    db.prepare(
      "INSERT INTO provider_call_logs (id, provider_name, provider_key_id, endpoint, status_code, latency_ms, success, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      uuid(),
      "magnific",
      opts.keyId ?? null,
      opts.endpoint,
      opts.statusCode,
      opts.latencyMs,
      opts.success ? 1 : 0,
      opts.errorMessage ?? null,
    );
  } catch (err) {
    logger.warn({ err }, "Failed to record provider_call_logs");
  }
}

export interface MagnificRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export async function magnificFetch<T = unknown>(
  endpoint: string,
  opts: MagnificRequestOptions = {},
): Promise<T> {
  // Pre-flight: ensure a key exists so we surface a clean 503 instead of
  // throwing inside withFailover with a generic "no keys" message.
  if (!getActiveKey("magnific")) {
    throw new MagnificError(
      "Magnific provider not configured",
      503,
      notConfiguredError("magnific", endpoint),
    );
  }

  const url = new URL(endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const method = opts.method || (opts.body ? "POST" : "GET");

  return withFailover<T>("magnific", async (key) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      [AUTH_HEADER]: key.key,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();
    let statusCode = 0;
    let success = false;
    let errorMessage: string | undefined;
    try {
      const res = await fetch(url.toString(), {
        method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      statusCode = res.status;
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json() : await res.text();
      if (!res.ok) {
        errorMessage = typeof data === "string" ? data : JSON.stringify(data).slice(0, 500);
        throw new MagnificError(
          `Magnific ${method} ${endpoint} failed: ${res.status}`,
          res.status,
          data,
        );
      }
      success = true;
      return data as T;
    } catch (err) {
      if (!errorMessage) errorMessage = err instanceof Error ? err.message : String(err);
      if (err instanceof MagnificError) throw err;
      throw new MagnificError(errorMessage, statusCode || 500);
    } finally {
      clearTimeout(timer);
      logCall({
        endpoint,
        statusCode,
        latencyMs: Date.now() - startedAt,
        success,
        errorMessage,
        keyId: key.id,
      });
    }
  });
}

export async function poll<T>(
  fetcher: () => Promise<T>,
  isDone: (v: T) => boolean,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<T> {
  const interval = options.intervalMs ?? 5000;
  const timeout = options.timeoutMs ?? 10 * 60 * 1000;
  const start = Date.now();
  while (true) {
    const v = await fetcher();
    if (isDone(v)) return v;
    if (Date.now() - start > timeout) {
      throw new MagnificError("Polling timed out", 504);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}
