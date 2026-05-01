import type { Request, Response, NextFunction } from "express";

const MAX_STRING_LEN = 20_000;
const MAX_DEPTH = 12;
const MAX_KEYS = 200;
const MAX_ARRAY_LEN = 1000;

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function clean(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return null;
  if (typeof value === "string") {
    let s = value.replace(CONTROL_CHARS, "");
    if (s.length > MAX_STRING_LEN) s = s.slice(0, MAX_STRING_LEN);
    return s;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LEN).map((item) => clean(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    let i = 0;
    for (const [rawKey, v] of Object.entries(value)) {
      if (i++ >= MAX_KEYS) break;
      // Strip prototype-pollution keys outright.
      if (rawKey === "__proto__" || rawKey === "constructor" || rawKey === "prototype") continue;
      const key = rawKey.replace(CONTROL_CHARS, "").slice(0, 256);
      if (!key) continue;
      out[key] = clean(v, depth + 1);
    }
    return out;
  }
  return null;
}

/**
 * Recursively strips control characters, caps string/array sizes, blocks
 * prototype-pollution keys, and bounds object depth/breadth in `req.body`,
 * `req.query`, and `req.params`. This is a defence-in-depth layer applied to
 * every request before route handlers see it.
 */
function sanitizeStringMap(target: Record<string, unknown>): void {
  const cleaned = clean(target, 0) as Record<string, unknown>;
  for (const k of Object.keys(target)) {
    if (cleaned[k] !== undefined) target[k] = cleaned[k];
  }
}

export function sanitizeRequests(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = clean(req.body, 0);
  }
  if (req.params && typeof req.params === "object") {
    sanitizeStringMap(req.params as unknown as Record<string, unknown>);
  }
  if (req.query && typeof req.query === "object") {
    sanitizeStringMap(req.query as unknown as Record<string, unknown>);
  }
  next();
}
