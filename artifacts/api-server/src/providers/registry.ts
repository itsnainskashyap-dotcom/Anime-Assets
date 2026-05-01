import db from "../db/index.js";
import { decryptSecret } from "../lib/crypto.js";

export const DEMO_MODE: boolean = (process.env.DEMO_MODE || "false").toLowerCase() === "true";

export interface ProviderKeyRow {
  id: string;
  provider_name: string;
  encrypted_key: string;
  enabled: number;
  priority: number;
  status: string | null;
  cooldown_until: string | null;
}

export function getActiveKey(providerName: string): { id: string; key: string } | null {
  const envMap: Record<string, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_API_KEY,
    freepik: process.env.FREEPIK_API_KEY,
    magnific: process.env.MAGNIFIC_API_KEY,
    razorpay: process.env.RAZORPAY_KEY_SECRET,
  };
  const envKey = envMap[providerName];
  if (envKey) return { id: `env:${providerName}`, key: envKey };

  const row = db
    .prepare<[string], ProviderKeyRow>(
      `SELECT id, provider_name, encrypted_key, enabled, priority, status, cooldown_until
       FROM provider_keys
       WHERE provider_name = ? AND enabled = 1
         AND (cooldown_until IS NULL OR cooldown_until < strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ORDER BY priority DESC, error_count ASC
       LIMIT 1`,
    )
    .get(providerName);

  if (!row) return null;
  try {
    return { id: row.id, key: decryptSecret(row.encrypted_key) };
  } catch {
    return null;
  }
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
