import { v4 as uuid } from "uuid";
import db from "../db/index.js";

export function getBalance(userId: string): number {
  const r = db.prepare<[string], { credits: number }>("SELECT credits FROM users WHERE id = ?").get(userId);
  return r?.credits ?? 0;
}

export function getPrice(operation: string): number {
  const r = db.prepare<[string], { credits: number }>("SELECT credits FROM pricing_config WHERE operation = ?").get(operation);
  return r?.credits ?? 0;
}

export function adjustCredits(
  userId: string,
  delta: number,
  reason: string,
  reference?: { id?: string; type?: string },
): { balance: number } {
  const tx = db.transaction((uid: string, d: number) => {
    const cur = db.prepare<[string], { credits: number }>("SELECT credits FROM users WHERE id = ?").get(uid);
    if (!cur) throw new Error("User not found");
    const next = cur.credits + d;
    if (next < 0) throw Object.assign(new Error("Insufficient credits"), { statusCode: 402 });
    db.prepare("UPDATE users SET credits = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(next, uid);
    db.prepare(
      "INSERT INTO credit_ledger (id, user_id, delta, balance_after, reason, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(uuid(), uid, d, next, reason, reference?.id ?? null, reference?.type ?? null);
    return next;
  });
  return { balance: tx(userId, delta) };
}

export function debitCredits(userId: string, operation: string, reference?: { id?: string; type?: string }): { balance: number; cost: number } {
  const cost = getPrice(operation);
  if (cost === 0) return { balance: getBalance(userId), cost: 0 };
  const result = adjustCredits(userId, -cost, `op:${operation}`, reference);
  return { balance: result.balance, cost };
}
