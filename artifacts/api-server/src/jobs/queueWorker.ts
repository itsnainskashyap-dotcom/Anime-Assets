import { v4 as uuid } from "uuid";
import { logger } from "../lib/logger.js";
import {
  claimNextTask,
  completeTask,
  failTask,
  heartbeat,
  recoverStaleTasks,
  type JobTaskRow,
} from "../services/queue.js";
import { recordPlaygroundEvent } from "../services/playgroundEvents.js";
import db from "../db/index.js";
import { runHandler } from "./handlers.js";

const WORKER_ID = `worker_${process.pid}_${uuid().slice(0, 8)}`;
const POLL_MS = 1500;
const RECOVERY_MS = 30_000;

let stopRequested = false;

async function runOne(): Promise<boolean> {
  const task = claimNextTask(WORKER_ID, 120);
  if (!task) return false;

  if (task.project_id) {
    recordPlaygroundEvent({
      projectId: task.project_id,
      eventType: "task_started",
      message: `Stage ${task.stage || task.type} started`,
      payload: { taskId: task.id, type: task.type, stage: task.stage },
    });
  }

  const heartbeatTimer = setInterval(() => {
    heartbeat(task.id, WORKER_ID, 120);
  }, 30_000);

  try {
    const stage = task.stage || task.type;
    const result = await runHandler(stage, task);
    completeTask(task.id, result);
    if (task.project_id) {
      recordPlaygroundEvent({
        projectId: task.project_id,
        eventType: "task_completed",
        message: `Stage ${task.stage || task.type} completed`,
        payload: { taskId: task.id, result },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, taskId: task.id, stage: task.stage, type: task.type }, "Task failed");
    failTask(task.id, message, true);
  } finally {
    clearInterval(heartbeatTimer);
  }
  return true;
}

async function pollLoop(): Promise<void> {
  while (!stopRequested) {
    let didWork = false;
    try {
      didWork = await runOne();
    } catch (err) {
      logger.error({ err }, "Queue worker crashed in loop");
    }
    if (!didWork) await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

async function recoveryLoop(): Promise<void> {
  while (!stopRequested) {
    try {
      const recovered = recoverStaleTasks();
      if (recovered > 0) logger.info({ recovered }, "Recovered stale tasks");
    } catch (err) {
      logger.error({ err }, "Recovery loop error");
    }
    await new Promise((r) => setTimeout(r, RECOVERY_MS));
  }
}

async function snapshotLoop(): Promise<void> {
  while (!stopRequested) {
    try {
      const projects = db
        .prepare<[], { id: string; status: string; current_stage: string | null; progress_percent: number | null }>(
          `SELECT id, status, current_stage, progress_percent FROM projects
           WHERE status IN ('queued','generating','validating','exporting','production_locked')`,
        )
        .all();
      const insertSnap = db.prepare(
        "INSERT INTO live_progress_snapshots (id, project_id, snapshot_json) VALUES (?, ?, ?)",
      );
      for (const p of projects) {
        const taskCounts = db
          .prepare<[string], { status: string; n: number }>(
            "SELECT status, COUNT(*) as n FROM job_tasks WHERE project_id = ? GROUP BY status",
          )
          .all(p.id);
        const chunkCounts = db
          .prepare<[string], { status: string; n: number }>(
            "SELECT status, COUNT(*) as n FROM video_chunks WHERE project_id = ? GROUP BY status",
          )
          .all(p.id);
        const snap = {
          status: p.status,
          stage: p.current_stage,
          progressPercent: p.progress_percent,
          tasks: Object.fromEntries(taskCounts.map((r) => [r.status, r.n])),
          chunks: Object.fromEntries(chunkCounts.map((r) => [r.status, r.n])),
          at: new Date().toISOString(),
        };
        insertSnap.run(uuid(), p.id, JSON.stringify(snap));
      }
      // Trim per project to last 200 snapshots.
      db.prepare(
        `DELETE FROM live_progress_snapshots
         WHERE id IN (
           SELECT id FROM (
             SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at DESC) AS rn
             FROM live_progress_snapshots
           ) WHERE rn > 200
         )`,
      ).run();
    } catch (err) {
      logger.error({ err }, "Snapshot loop error");
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
}

async function cleanupLoop(): Promise<void> {
  while (!stopRequested) {
    try {
      db.prepare(
        `DELETE FROM playground_events WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')`,
      ).run();
      db.prepare(
        `DELETE FROM agent_activity_logs WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-14 days')`,
      ).run();
    } catch (err) {
      logger.error({ err }, "Cleanup loop error");
    }
    await new Promise((r) => setTimeout(r, 60 * 60 * 1000));
  }
}

export function startWorkers(): void {
  logger.info({ workerId: WORKER_ID }, "Starting AnimeStudioAI workers");
  void pollLoop();
  void recoveryLoop();
  void cleanupLoop();
  void snapshotLoop();
}

export function stopWorkers(): void {
  stopRequested = true;
}
