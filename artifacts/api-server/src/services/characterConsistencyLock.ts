import { v4 as uuid } from "uuid";
import db from "../db/index.js";

export interface ConsistencyLockRow {
  id: string;
  character_id: string;
  locked: number;
  approved_by: string | null;
  approved_at: string | null;
  visual_signature: string | null;
  reference_urls: string | null;
}

export function getLock(characterId: string): ConsistencyLockRow | null {
  return (
    db
      .prepare<[string], ConsistencyLockRow>(
        "SELECT * FROM character_consistency_locks WHERE character_id = ?",
      )
      .get(characterId) || null
  );
}

export function isLocked(characterId: string): boolean {
  const row = getLock(characterId);
  return !!row && row.locked === 1;
}

export function approveLock(opts: {
  characterId: string;
  approvedBy: string;
  visualSignature: string;
  referenceUrls: string[];
}): ConsistencyLockRow {
  const existing = getLock(opts.characterId);
  if (existing && existing.locked === 1) {
    return existing;
  }
  if (!existing) {
    db.prepare(
      "INSERT INTO character_consistency_locks (id, character_id, locked, approved_by, approved_at, visual_signature, reference_urls) VALUES (?, ?, 1, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?, ?)",
    ).run(uuid(), opts.characterId, opts.approvedBy, opts.visualSignature, JSON.stringify(opts.referenceUrls));
  } else {
    db.prepare(
      "UPDATE character_consistency_locks SET locked = 1, approved_by = ?, approved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), visual_signature = ?, reference_urls = ? WHERE character_id = ?",
    ).run(opts.approvedBy, opts.visualSignature, JSON.stringify(opts.referenceUrls), opts.characterId);
  }
  return getLock(opts.characterId)!;
}

export function assertNotLocked(characterId: string): void {
  if (isLocked(characterId)) {
    throw Object.assign(new Error("Character is locked and cannot be modified"), { statusCode: 409 });
  }
}
