import { v4 as uuid } from "uuid";
import db from "../db/index.js";

export interface ProductionMemoryDoc {
  characters: Record<string, unknown>;
  environments: Record<string, unknown>;
  storyArc: Record<string, unknown>;
  visualStyle: Record<string, unknown>;
  audioStyle: Record<string, unknown>;
  approvedAssets: string[];
  notes: string[];
}

const EMPTY: ProductionMemoryDoc = {
  characters: {},
  environments: {},
  storyArc: {},
  visualStyle: {},
  audioStyle: {},
  approvedAssets: [],
  notes: [],
};

interface MemoryRow { version: number; data_json: string }

export function loadMemory(projectId: string): { version: number; data: ProductionMemoryDoc } {
  const row = db
    .prepare<[string], MemoryRow>("SELECT version, data_json FROM production_memory WHERE project_id = ?")
    .get(projectId);
  if (!row) {
    db.prepare(
      "INSERT INTO production_memory (project_id, version, data_json) VALUES (?, 1, ?)",
    ).run(projectId, JSON.stringify(EMPTY));
    return { version: 1, data: { ...EMPTY } };
  }
  return { version: row.version, data: JSON.parse(row.data_json) as ProductionMemoryDoc };
}

export function updateMemory(
  projectId: string,
  agent: string,
  patch: Partial<ProductionMemoryDoc>,
  eventType = "memory_update",
): { version: number; data: ProductionMemoryDoc } {
  const current = loadMemory(projectId);
  const next: ProductionMemoryDoc = { ...current.data, ...patch };
  const newVersion = current.version + 1;
  db.prepare(
    "UPDATE production_memory SET version = ?, data_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE project_id = ?",
  ).run(newVersion, JSON.stringify(next), projectId);
  db.prepare(
    "INSERT INTO memory_events (id, project_id, agent, event_type, payload_json, version) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(uuid(), projectId, agent, eventType, JSON.stringify(patch), newVersion);
  return { version: newVersion, data: next };
}
