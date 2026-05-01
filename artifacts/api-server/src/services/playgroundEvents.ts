import { v4 as uuid } from "uuid";
import db from "../db/index.js";
import { sseBus } from "../lib/sse.js";

export function recordPlaygroundEvent(opts: {
  projectId: string;
  eventType: string;
  agent?: string;
  message?: string;
  payload?: Record<string, unknown>;
}): void {
  const id = uuid();
  db.prepare(
    "INSERT INTO playground_events (id, project_id, event_type, agent, message, payload_json) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    opts.projectId,
    opts.eventType,
    opts.agent ?? null,
    opts.message ?? null,
    opts.payload ? JSON.stringify(opts.payload) : null,
  );
  sseBus.publish(opts.projectId, {
    type: "playground_event",
    data: {
      id,
      eventType: opts.eventType,
      agent: opts.agent,
      message: opts.message,
      payload: opts.payload,
      ts: new Date().toISOString(),
    },
  });
}

export function recordAgentLog(opts: {
  projectId?: string;
  agentName: string;
  level?: string;
  message: string;
  metadata?: Record<string, unknown>;
}): void {
  const id = uuid();
  db.prepare(
    "INSERT INTO agent_activity_logs (id, project_id, agent_name, level, message, metadata_json) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    opts.projectId ?? null,
    opts.agentName,
    opts.level ?? "info",
    opts.message,
    opts.metadata ? JSON.stringify(opts.metadata) : null,
  );
  if (opts.projectId) {
    sseBus.publish(opts.projectId, {
      type: "agent_log",
      data: { id, agent: opts.agentName, level: opts.level ?? "info", message: opts.message },
    });
  }
}
