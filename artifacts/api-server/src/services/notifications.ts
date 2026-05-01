import { v4 as uuid } from "uuid";
import db from "../db/index.js";
import { sseBus } from "../lib/sse.js";

export function notify(userId: string, opts: { type?: string; title: string; body?: string; link?: string; projectId?: string }): void {
  const id = uuid();
  db.prepare(
    "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, userId, opts.type ?? "info", opts.title, opts.body ?? null, opts.link ?? null);
  if (opts.projectId) {
    sseBus.publish(opts.projectId, { type: "notification", data: { id, title: opts.title } });
  }
}

export function listForUser(userId: string, limit = 50): unknown[] {
  return db
    .prepare(
      "SELECT id, type, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .all(userId, limit);
}

export function markRead(userId: string, id: string): void {
  db.prepare(
    "UPDATE notifications SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?",
  ).run(id, userId);
}
