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
import { recordAgentLog, recordPlaygroundEvent } from "../services/playgroundEvents.js";
import db from "../db/index.js";

const WORKER_ID = `worker_${process.pid}_${uuid().slice(0, 8)}`;
const POLL_MS = 1500;
const RECOVERY_MS = 30_000;

type StageHandler = (task: JobTaskRow) => Promise<Record<string, unknown>>;

const stageHandlers: Record<string, StageHandler> = {
  story_bible_generate: async (task) => {
    recordAgentLog({ projectId: task.project_id ?? undefined, agentName: "story_director", message: "Generating story bible (stub)" });
    return { stub: true, summary: "Stub story bible generated. Implement in Task 3." };
  },
  character_generate: async (task) => {
    recordAgentLog({ projectId: task.project_id ?? undefined, agentName: "character_director", message: "Generating characters (stub)" });
    return { stub: true };
  },
  storyboard_generate: async (task) => {
    recordAgentLog({ projectId: task.project_id ?? undefined, agentName: "storyboard_director", message: "Generating storyboard (stub)" });
    return { stub: true };
  },
  visualization_generate: async (task) => {
    recordAgentLog({ projectId: task.project_id ?? undefined, agentName: "visualization_director", message: "Generating visualization pack (stub)" });
    return { stub: true };
  },
  video_chunk_generate: async (task) => {
    recordAgentLog({ projectId: task.project_id ?? undefined, agentName: "video_provider", message: "Generating video chunk (stub)" });
    return { stub: true };
  },
  validation: async (task) => {
    recordAgentLog({ projectId: task.project_id ?? undefined, agentName: "video_validator", message: "Validating chunk (stub)" });
    return { stub: true, passed: true };
  },
  export_project: async (task) => {
    recordAgentLog({ projectId: task.project_id ?? undefined, agentName: "export_agent", message: "Exporting project (stub)" });
    return { stub: true };
  },
  song_generate: async (task) => {
    recordAgentLog({ projectId: task.project_id ?? undefined, agentName: "song_bible", message: "Generating song (stub)" });
    return { stub: true };
  },
  cleanup: async () => ({ stub: true, cleaned: 0 }),
  notification: async () => ({ stub: true }),
  reference_video_trim: async (task) => ({ stub: true, taskId: task.id }),
};

let stopRequested = false;

async function runOne(): Promise<boolean> {
  const task = claimNextTask(WORKER_ID, 60);
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
    heartbeat(task.id, WORKER_ID, 60);
  }, 20_000);

  try {
    const handler = stageHandlers[task.type] || stageHandlers[task.stage || ""] || (async () => ({
      stub: true,
      note: `No handler for type=${task.type} (stage=${task.stage}). Implement in Task 3.`,
    }));
    const result = await handler(task);
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
    logger.error({ err, taskId: task.id }, "Task failed");
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
}

export function stopWorkers(): void {
  stopRequested = true;
}
