import { Router, type IRouter, type Response } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { generationLimiter } from "../middleware/rateLimit.js";
import { enqueueTask } from "../services/queue.js";
import { recordPlaygroundEvent } from "../services/playgroundEvents.js";
import { loadMemory } from "../services/productionMemory.js";
import { approveLock, assertNotLocked } from "../services/characterConsistencyLock.js";
import { debitCredits, getPrice } from "../services/credits.js";
import { attachSseClient } from "../lib/sse.js";

const router: IRouter = Router();

interface ProjectRow {
  id: string; user_id: string; title: string; format: string | null; genre: string | null;
  voice_style: string | null; story_prompt: string | null; status: string;
  thumbnail_url: string | null; estimated_credits: number; estimated_seconds: number;
  progress_percent: number; current_stage: string | null; created_at: string; updated_at: string;
}

function loadProject(projectId: string, userId: string): ProjectRow | null {
  return (
    db
      .prepare<[string, string], ProjectRow>("SELECT * FROM projects WHERE id = ? AND user_id = ?")
      .get(projectId, userId) || null
  );
}

function notFound(res: Response): void {
  res.status(404).json({ error: "Project not found" });
}

router.post("/", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const { title, format, genre, voiceStyle, storyPrompt } = req.body || {};
  if (!title) {
    res.status(400).json({ error: "title required" });
    return;
  }
  const id = uuid();
  db.prepare(
    "INSERT INTO projects (id, user_id, title, format, genre, voice_style, story_prompt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, u.sub, title, format ?? null, genre ?? null, voiceStyle ?? null, storyPrompt ?? null);
  db.prepare("INSERT INTO project_settings (project_id) VALUES (?)").run(id);
  loadMemory(id);
  res.status(201).json(loadProject(id, u.sub));
});

router.get("/", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const rows = db
    .prepare<[string], ProjectRow>("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC")
    .all(u.sub);
  res.json(rows);
});

router.get("/:id", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const settings = db.prepare("SELECT * FROM project_settings WHERE project_id = ?").get((req.params.id as string));
  res.json({ ...p, settings });
});

router.delete("/:id", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const r = db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run((req.params.id as string), u.sub);
  if (r.changes === 0) return notFound(res);
  res.json({ ok: true });
});

function enqueueGenerationStage(stageType: string, projectId: string, userId: string, payload: Record<string, unknown> = {}) {
  const idemKey = `${projectId}:${stageType}:${Date.now()}`;
  const task = enqueueTask({
    type: stageType,
    stage: stageType,
    projectId,
    userId,
    payload,
    idempotencyKey: idemKey,
  });
  recordPlaygroundEvent({
    projectId,
    eventType: "stage_queued",
    message: `${stageType} queued`,
    payload: { taskId: task.id },
  });
  return task;
}

router.post("/:id/story-bible/generate", requireAuth, generationLimiter, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  try {
    debitCredits(u.sub, "story_bible_generate", { id: p.id, type: "project" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode || 500).json({ error: e.message });
    return;
  }
  let bible = db.prepare("SELECT * FROM story_bibles WHERE project_id = ?").get(p.id);
  if (!bible) {
    const bid = uuid();
    db.prepare("INSERT INTO story_bibles (id, project_id, status) VALUES (?, ?, 'generating')").run(bid, p.id);
    bible = db.prepare("SELECT * FROM story_bibles WHERE id = ?").get(bid);
  }
  const task = enqueueGenerationStage("story_bible_generate", p.id, u.sub, { storyPrompt: p.story_prompt });
  res.status(202).json({ jobId: task.id, status: "queued", storyBible: bible });
});

router.post("/:id/story-bible/approve", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  db.prepare(
    "UPDATE story_bibles SET status='approved', approved_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE project_id = ?",
  ).run(p.id);
  recordPlaygroundEvent({ projectId: p.id, eventType: "story_bible_approved", message: "Story bible approved" });
  res.json({ ok: true });
});

router.post("/:id/characters/generate", requireAuth, generationLimiter, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  try {
    debitCredits(u.sub, "character_generate", { id: p.id, type: "project" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode || 500).json({ error: e.message });
    return;
  }
  const task = enqueueGenerationStage("character_generate", p.id, u.sub, req.body);
  res.status(202).json({ jobId: task.id, status: "queued" });
});

router.post("/:id/characters/approve-lock", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const { characterId, visualSignature, referenceUrls } = req.body || {};
  if (!characterId) {
    res.status(400).json({ error: "characterId required" });
    return;
  }
  const lock = approveLock({
    characterId,
    approvedBy: u.sub,
    visualSignature: visualSignature || "auto",
    referenceUrls: referenceUrls || [],
  });
  recordPlaygroundEvent({ projectId: p.id, eventType: "character_locked", message: `Character ${characterId} locked` });
  res.json({ ok: true, lock });
});

router.post("/:id/storyboard/generate", requireAuth, generationLimiter, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  try {
    debitCredits(u.sub, "storyboard_generate", { id: p.id, type: "project" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode || 500).json({ error: e.message });
    return;
  }
  const task = enqueueGenerationStage("storyboard_generate", p.id, u.sub, {});
  res.status(202).json({ jobId: task.id, status: "queued" });
});

router.post("/:id/visualization/generate", requireAuth, generationLimiter, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  try {
    debitCredits(u.sub, "visualization_generate", { id: p.id, type: "project" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode || 500).json({ error: e.message });
    return;
  }
  const task = enqueueGenerationStage("visualization_generate", p.id, u.sub, {});
  res.status(202).json({ jobId: task.id, status: "queued" });
});

router.post("/:id/cost-estimate", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const sceneCount = (db.prepare("SELECT COUNT(*) AS c FROM scenes WHERE project_id = ?").get(p.id) as { c: number }).c || 6;
  const chunksPerScene = 1;
  const totalChunks = sceneCount * chunksPerScene;
  const breakdown = {
    story_bible: getPrice("story_bible_generate"),
    characters: getPrice("character_generate") * 3,
    storyboard: getPrice("storyboard_generate"),
    visualization: getPrice("visualization_generate"),
    chunks: getPrice("chunk_video_standard") * totalChunks,
    validation: getPrice("validation") * totalChunks,
    export: getPrice("export_zip"),
  };
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  res.json({ totalCredits: total, breakdown, estimatedMinutes: Math.max(2, totalChunks * 2) });
});

router.post("/:id/production/start", requireAuth, generationLimiter, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  db.prepare("UPDATE projects SET status='producing', current_stage='production_start' WHERE id = ?").run(p.id);
  const task = enqueueGenerationStage("production_pipeline", p.id, u.sub, {});
  recordPlaygroundEvent({ projectId: p.id, eventType: "production_started", message: "Production started" });
  res.json({ ok: true, jobId: task.id });
});

router.post("/:id/production/pause", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  db.prepare("UPDATE projects SET status='paused' WHERE id = ?").run(p.id);
  db.prepare("UPDATE job_tasks SET status='paused' WHERE project_id = ? AND status IN ('queued','in_progress')").run(p.id);
  recordPlaygroundEvent({ projectId: p.id, eventType: "production_paused" });
  res.json({ ok: true });
});

router.post("/:id/production/resume", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  db.prepare("UPDATE projects SET status='producing' WHERE id = ?").run(p.id);
  db.prepare("UPDATE job_tasks SET status='queued' WHERE project_id = ? AND status='paused'").run(p.id);
  recordPlaygroundEvent({ projectId: p.id, eventType: "production_resumed" });
  res.json({ ok: true });
});

router.post("/:id/production/cancel", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  db.prepare("UPDATE projects SET status='cancelled' WHERE id = ?").run(p.id);
  db.prepare("UPDATE job_tasks SET status='cancelled' WHERE project_id = ? AND status IN ('queued','in_progress','paused')").run(p.id);
  recordPlaygroundEvent({ projectId: p.id, eventType: "production_cancelled" });
  res.json({ ok: true });
});

router.get("/:id/production/status", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const tasks = db
    .prepare<[string], { status: string; c: number }>(
      "SELECT status, COUNT(*) AS c FROM job_tasks WHERE project_id = ? GROUP BY status",
    )
    .all(p.id);
  const chunks = db
    .prepare<[string], { status: string; c: number }>(
      "SELECT status, COUNT(*) AS c FROM video_chunks WHERE project_id = ? GROUP BY status",
    )
    .all(p.id);
  res.json({
    status: p.status,
    currentStage: p.current_stage,
    progressPercent: p.progress_percent,
    tasksByStatus: tasks,
    chunksByStatus: chunks,
  });
});

router.get("/:id/chunks", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const chunks = db
    .prepare("SELECT * FROM video_chunks WHERE project_id = ? ORDER BY chunk_number ASC")
    .all(p.id);
  res.json(chunks);
});

router.get("/:id/playground/events", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const cleanup = attachSseClient(p.id, res);
  const recent = db
    .prepare("SELECT id, event_type, agent, message, payload_json, created_at FROM playground_events WHERE project_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(p.id);
  res.write(`event: history\ndata: ${JSON.stringify(recent)}\n\n`);
  req.on("close", cleanup);
});

router.get("/:id/agents", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const runs = db
    .prepare("SELECT * FROM agent_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT 100")
    .all(p.id);
  res.json(runs);
});

router.get("/:id/memory", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  res.json(loadMemory(p.id));
});

export { assertNotLocked };
export default router;
