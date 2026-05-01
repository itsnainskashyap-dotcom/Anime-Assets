import { v4 as uuid } from "uuid";
import db from "../db/index.js";
import { sseBus } from "../lib/sse.js";

export interface EnqueueOptions {
  type: string;
  stage?: string;
  projectId?: string | null;
  userId?: string | null;
  sceneId?: string | null;
  chunkId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  priority?: number;
  scheduledFor?: Date;
  dependsOn?: string[];
}

export interface JobTaskRow {
  id: string;
  project_id: string | null;
  user_id: string | null;
  scene_id: string | null;
  chunk_id: string | null;
  type: string;
  stage: string | null;
  status: string;
  payload_json: string | null;
  result_json: string | null;
  idempotency_key: string | null;
  provider_key_id: string | null;
  locked_by_worker_id: string | null;
  lock_expires_at: string | null;
  heartbeat_at: string | null;
  retry_count: number;
  max_retries: number;
  priority: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

export function enqueueTask(opts: EnqueueOptions): JobTaskRow {
  if (opts.idempotencyKey) {
    const existing = db
      .prepare<[string], JobTaskRow>("SELECT * FROM job_tasks WHERE idempotency_key = ?")
      .get(opts.idempotencyKey);
    if (existing) return existing;
  }
  const id = uuid();
  const scheduledFor = opts.scheduledFor ? opts.scheduledFor.toISOString() : new Date().toISOString();
  db.prepare(
    `INSERT INTO job_tasks
     (id, project_id, user_id, scene_id, chunk_id, type, stage, status,
      payload_json, idempotency_key, priority, scheduled_for)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)`,
  ).run(
    id,
    opts.projectId ?? null,
    opts.userId ?? null,
    opts.sceneId ?? null,
    opts.chunkId ?? null,
    opts.type,
    opts.stage ?? null,
    opts.payload ? JSON.stringify(opts.payload) : null,
    opts.idempotencyKey ?? null,
    opts.priority ?? 0,
    scheduledFor,
  );
  if (opts.dependsOn && opts.dependsOn.length > 0) {
    const insDep = db.prepare("INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)");
    const tx = db.transaction((deps: string[]) => {
      for (const d of deps) insDep.run(id, d);
    });
    tx(opts.dependsOn);
  }
  if (opts.projectId) {
    sseBus.publish(opts.projectId, {
      type: "task_enqueued",
      data: { taskId: id, taskType: opts.type, stage: opts.stage ?? null },
    });
  }
  return db.prepare<[string], JobTaskRow>("SELECT * FROM job_tasks WHERE id = ?").get(id)!;
}

export function claimNextTask(workerId: string, leaseSeconds = 60): JobTaskRow | null {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + leaseSeconds * 1000).toISOString();
  const tx = db.transaction(() => {
    const row = db
      .prepare<[], JobTaskRow>(
        `SELECT t.* FROM job_tasks t
         WHERE t.status = 'queued'
           AND (t.scheduled_for IS NULL OR t.scheduled_for <= strftime('%Y-%m-%dT%H:%M:%fZ','now'))
           AND (t.locked_by_worker_id IS NULL OR t.lock_expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now'))
           AND NOT EXISTS (
             SELECT 1 FROM task_dependencies d
             JOIN job_tasks dep ON dep.id = d.depends_on_task_id
             WHERE d.task_id = t.id AND dep.status NOT IN ('completed', 'skipped')
           )
         ORDER BY t.priority DESC, t.created_at ASC
         LIMIT 1`,
      )
      .get();
    if (!row) return null;
    const result = db
      .prepare(
        `UPDATE job_tasks
         SET status = 'in_progress',
             locked_by_worker_id = ?,
             lock_expires_at = ?,
             heartbeat_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
             started_at = COALESCE(started_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ? AND (locked_by_worker_id IS NULL OR lock_expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      )
      .run(workerId, leaseUntil, row.id);
    if (result.changes === 0) return null;
    return db.prepare<[string], JobTaskRow>("SELECT * FROM job_tasks WHERE id = ?").get(row.id) ?? null;
  });
  return tx();
}

export function heartbeat(taskId: string, workerId: string, leaseSeconds = 60): boolean {
  const leaseUntil = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  const r = db
    .prepare(
      `UPDATE job_tasks SET heartbeat_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), lock_expires_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ? AND locked_by_worker_id = ?`,
    )
    .run(leaseUntil, taskId, workerId);
  return r.changes > 0;
}

export function completeTask(taskId: string, result: Record<string, unknown>): void {
  const r = db
    .prepare<[string], JobTaskRow>("SELECT project_id FROM job_tasks WHERE id = ?")
    .get(taskId);
  db.prepare(
    `UPDATE job_tasks SET status = 'completed', result_json = ?, finished_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), locked_by_worker_id = NULL, lock_expires_at = NULL WHERE id = ?`,
  ).run(JSON.stringify(result), taskId);
  if (r?.project_id) {
    sseBus.publish(r.project_id, { type: "task_completed", data: { taskId, result } });
  }
}

export function failTask(taskId: string, errorMessage: string, retry = true): void {
  const row = db.prepare<[string], JobTaskRow>("SELECT * FROM job_tasks WHERE id = ?").get(taskId);
  if (!row) return;
  const nextRetry = row.retry_count + 1;
  const shouldRetry = retry && nextRetry <= row.max_retries;
  if (shouldRetry) {
    const backoffSec = Math.min(60 * 5, 5 * 2 ** nextRetry);
    const scheduledFor = new Date(Date.now() + backoffSec * 1000).toISOString();
    db.prepare(
      `UPDATE job_tasks SET status = 'queued', retry_count = ?, error_message = ?, locked_by_worker_id = NULL,
       lock_expires_at = NULL, scheduled_for = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    ).run(nextRetry, errorMessage, scheduledFor, taskId);
  } else {
    db.prepare(
      `UPDATE job_tasks SET status = 'failed', error_message = ?, finished_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), locked_by_worker_id = NULL, lock_expires_at = NULL WHERE id = ?`,
    ).run(errorMessage, taskId);
  }
  if (row.project_id) {
    sseBus.publish(row.project_id, {
      type: shouldRetry ? "task_retry" : "task_failed",
      data: { taskId, errorMessage, retryCount: nextRetry },
    });
  }
}

export function recoverStaleTasks(): number {
  const r = db
    .prepare(
      `UPDATE job_tasks SET status = 'queued', locked_by_worker_id = NULL, lock_expires_at = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE status = 'in_progress' AND lock_expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    )
    .run();
  return r.changes;
}
