import fs from "node:fs";
import { Router, type IRouter, type Response } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { generationLimiter } from "../middleware/rateLimit.js";
import { singleUpload, IMAGE_MIME } from "../middleware/upload.js";
import { enqueueTask, enqueueStageOnce, findInflightStage } from "../services/queue.js";
import { recordPlaygroundEvent } from "../services/playgroundEvents.js";
import { loadMemory } from "../services/productionMemory.js";
import { approveLock, assertNotLocked } from "../services/characterConsistencyLock.js";
import { debitCredits, getPrice } from "../services/credits.js";
import { saveBuffer } from "../providers/storageProvider.js";
import { analyzeCharacterReference } from "../providers/visionProvider.js";
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
  const body = (req.body || {}) as {
    title?: string;
    format?: string;
    // Accept both singular and array forms from the wizard.
    genre?: string;
    genres?: string[];
    // Accept both `voice` and `voiceStyle` for back-compat.
    voice?: string;
    voiceStyle?: string;
    storyPrompt?: string;
    targetSeconds?: number;
    targetMinutes?: number;
  };
  if (!body.title) {
    res.status(400).json({ error: "title required" });
    return;
  }
  const id = uuid();
  const genreValue =
    body.genre ??
    (Array.isArray(body.genres) && body.genres.length > 0 ? body.genres.join(", ") : null);
  const voiceValue = body.voiceStyle ?? body.voice ?? null;
  // Resolve the production-target duration in seconds. The wizard sends one of:
  //   - targetSeconds (preferred, exact)
  //   - targetMinutes (will be converted)
  //   - format only — fallback to a sane default per format band:
  //       short=180s (3 min), episode=1320s (22 min), series=10800s (~3hr)
  let targetSeconds = 0;
  if (typeof body.targetSeconds === "number" && body.targetSeconds > 0) {
    targetSeconds = Math.round(body.targetSeconds);
  } else if (typeof body.targetMinutes === "number" && body.targetMinutes > 0) {
    targetSeconds = Math.round(body.targetMinutes * 60);
  } else {
    const f = (body.format || "short").toLowerCase();
    targetSeconds = f === "series" ? 10800 : f === "episode" ? 1320 : 180;
  }
  // Clamp to the satisfiable range. Story-bible scene-band math currently
  // tops out at 40 scenes × 300s = 12000s; clamp accordingly so the user
  // can never request a target the planner can't produce.
  targetSeconds = Math.max(10, Math.min(12000, targetSeconds));

  db.prepare(
    "INSERT INTO projects (id, user_id, title, format, genre, voice_style, story_prompt, estimated_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    u.sub,
    body.title,
    body.format ?? null,
    genreValue,
    voiceValue,
    body.storyPrompt ?? null,
    targetSeconds,
  );
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
  // Use enqueueStageOnce so a double-click or re-trigger while a task is still
  // in-flight just returns the existing one — never duplicates expensive work.
  // After the task completes, a fresh manual click WILL enqueue a new task
  // (legitimate re-run of an approved stage).
  const task = enqueueStageOnce({
    type: stageType,
    stage: stageType,
    projectId,
    userId,
    payload,
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
  // Credit-saving: if a story_bible_generate is already in-flight, return that
  // task without re-debiting credits or enqueueing duplicate work.
  const inflight = findInflightStage(p.id, "story_bible_generate");
  let bible = db.prepare("SELECT * FROM story_bibles WHERE project_id = ?").get(p.id);
  if (inflight) {
    res.status(202).json({ jobId: inflight.id, status: inflight.status, storyBible: bible, deduped: true });
    return;
  }
  try {
    debitCredits(u.sub, "story_bible_generate", { id: p.id, type: "project" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode || 500).json({ error: e.message });
    return;
  }
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

router.post("/:id/story/finalize", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const bible = db.prepare("SELECT status FROM story_bibles WHERE project_id = ?").get(p.id) as { status?: string } | undefined;
  if (!bible || !bible.status || !["ready", "approved"].includes(bible.status)) {
    res.status(409).json({
      error: "Story is not ready to finalize. Wait for the Story Director to finish, then try again.",
      code: "STORY_NOT_READY",
      currentStatus: bible?.status ?? "missing",
    });
    return;
  }
  db.prepare(
    "UPDATE projects SET story_finalized_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), current_stage = 'story_finalized' WHERE id = ?",
  ).run(p.id);
  recordPlaygroundEvent({
    projectId: p.id,
    eventType: "story_finalized",
    agent: "Story Director",
    message: "Story finalized. Character Studio unlocked.",
  });
  res.json({ ok: true, finalizedAt: new Date().toISOString() });
});

router.post("/:id/story/unfinalize", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  db.prepare("UPDATE projects SET story_finalized_at = NULL WHERE id = ?").run(p.id);
  recordPlaygroundEvent({
    projectId: p.id,
    eventType: "story_unfinalized",
    agent: "Story Director",
    message: "Story unlocked for further edits.",
  });
  res.json({ ok: true });
});

interface ChatBody { message?: string; stage?: string }

const AGENT_ROUTES: Array<{ keywords: RegExp; agent: string; intent: string; reply: (msg: string) => string }> = [
  { keywords: /(rewrite|regenerate).*story|story.*(rewrite|regenerate)/i, agent: "Story Director", intent: "story_rewrite",
    reply: () => "Rewriting the full story arc with stronger pacing and cliffhangers." },
  { keywords: /(act\s*[123]|climax|romance|darker|suspense|twist)/i, agent: "Story Director", intent: "story_edit",
    reply: (m) => `Reworking the requested beat: "${m.slice(0, 80)}".` },
  { keywords: /story\s*bible|bible|lore|world/i, agent: "Story Bible Agent", intent: "bible_edit",
    reply: () => "Re-syncing the Story Bible with the latest narrative state." },
  { keywords: /(regenerate|edit).*character|character.*(regenerate|edit)|hero|protagonist|antagonist/i, agent: "Character Director", intent: "character_edit",
    reply: () => "Updating character design — Vision Analyzer will re-extract reference cues." },
  { keywords: /environment|location|tokyo|forest|rainy|setting/i, agent: "Environment Director", intent: "environment_edit",
    reply: (m) => `Adjusting environment pack: "${m.slice(0, 80)}".` },
  { keywords: /storyboard|panel/i, agent: "Storyboard Composer", intent: "storyboard_edit",
    reply: () => "Recomposing storyboard panels aligned with the chunk video prompt." },
  { keywords: /chunk\s*\d+|prompt|video/i, agent: "Prompt Compiler", intent: "chunk_edit",
    reply: (m) => `Recompiling chunk prompt: "${m.slice(0, 80)}".` },
];

router.post("/:id/chat", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const body = (req.body || {}) as ChatBody;
  const text = (body.message || "").trim();
  if (!text) {
    res.status(400).json({ error: "message required" });
    return;
  }
  // Record user-side message into the playground event stream so it appears
  // in the persistent chat panel for everyone watching the project.
  recordPlaygroundEvent({
    projectId: p.id,
    eventType: "user_message",
    agent: "You",
    message: text,
    payload: body.stage ? { stage: body.stage } : undefined,
  });
  // Route the intent to a virtual agent. Real downstream wiring (calling
  // the actual rewrite handlers) is intentionally separate from the chat
  // surface — the chat panel must always acknowledge instantly even when
  // the heavy job is queued. Heavy stages already have their own POST routes.
  // Resolution order:
  //   1. explicit keyword match (strong signal in the prompt itself);
  //   2. stage-aware fallback — if the user has a stage selected on the
  //      Playground left rail, ambiguous directives route deterministically
  //      to that stage's agent (V17 §4.3 "select an act/stage and edit it");
  //   3. generic Story Director ack.
  const STAGE_AGENT: Record<string, { agent: string; intent: string }> = {
    intake: { agent: "Story Director", intent: "intake" },
    story: { agent: "Story Director", intent: "story_edit" },
    finalize: { agent: "Story Director", intent: "story_finalize" },
    bible: { agent: "Story Bible Agent", intent: "bible_edit" },
    characters: { agent: "Character Director", intent: "character_edit" },
    turnaround: { agent: "Character Director", intent: "turnaround_edit" },
    environments: { agent: "Environment Director", intent: "environment_edit" },
    frames: { agent: "Visualization Director", intent: "frame_edit" },
    storyboard: { agent: "Storyboard Composer", intent: "storyboard_edit" },
    viz: { agent: "Visualization Director", intent: "viz_pack_edit" },
    compile: { agent: "Prompt Compiler", intent: "prompt_edit" },
    video: { agent: "Video Orchestrator", intent: "chunk_edit" },
    qc: { agent: "Quality Validator", intent: "qc_edit" },
    song: { agent: "Audio Director", intent: "song_edit" },
    export: { agent: "Export Agent", intent: "export_edit" },
  };
  const stageHint = body.stage && STAGE_AGENT[body.stage] ? STAGE_AGENT[body.stage] : null;
  const keywordMatch = AGENT_ROUTES.find((r) => r.keywords.test(text));
  const route = keywordMatch
    ? keywordMatch
    : stageHint
      ? {
          agent: stageHint.agent,
          intent: stageHint.intent,
          reply: (m: string) => `${stageHint.agent} acknowledged. Applying to ${body.stage}: "${m.slice(0, 80)}".`,
        }
      : {
          agent: "Story Director",
          intent: "general",
          reply: (m: string) => `Understood — "${m.slice(0, 80)}". Standing by for the next directive.`,
        };
  recordPlaygroundEvent({
    projectId: p.id,
    eventType: "agent_message",
    agent: route.agent,
    message: route.reply(text),
    payload: { intent: route.intent },
  });
  res.json({ ok: true, agent: route.agent, intent: route.intent });
});

router.post("/:id/characters/generate", requireAuth, generationLimiter, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  // Section 5.3 / 7.1 gate: characters require an explicitly finalized story.
  const finalizedAt = (p as ProjectRow & { story_finalized_at?: string | null }).story_finalized_at;
  if (!finalizedAt) {
    res.status(409).json({
      error: "Story must be finalized before generating characters.",
      code: "STORY_NOT_FINALIZED",
    });
    return;
  }
  const inflight = findInflightStage(p.id, "character_generate");
  if (inflight) {
    res.status(202).json({ jobId: inflight.id, status: inflight.status, deduped: true });
    return;
  }
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

/**
 * V17 §7.2 — upload a character reference image. Saves the file, runs Gemini
 * 2.5 Flash vision analysis to extract structured appearance fields, inserts
 * a new character row pre-populated from the analysis, and emits Vision
 * Analyzer + Character Director playground events.
 *
 * Multipart form: field `file` (image), optional `name`, optional `role`.
 */
router.post(
  "/:id/characters/upload-reference",
  requireAuth,
  generationLimiter,
  singleUpload({ allowedMime: IMAGE_MIME, maxBytes: 20 * 1024 * 1024, field: "file" }),
  async (req, res) => {
    const u = (req as AuthenticatedRequest).user!;
    const p = loadProject(req.params.id as string, u.sub);
    if (!p) return notFound(res);
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "Missing file field" });
      return;
    }
    const body = (req.body || {}) as { name?: string; role?: string };

    // 1. Persist the upload to storage so vision analyzer + future render
    //    pipeline can fetch by URL.
    const buf = await fs.promises.readFile(file.path);
    const saved = await saveBuffer(buf, {
      userId: u.sub,
      projectId: p.id,
      assetType: "character_reference",
      filename: file.filename,
      contentType: file.mimetype,
    });
    await fs.promises.unlink(file.path).catch(() => undefined);

    // 2. Build the absolute URL the vision provider can fetch. The storage
    //    URL is server-relative; PUBLIC_BASE_URL is set in dev/prod.
    const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
    const fetchableUrl = base ? `${base}${saved.url}` : saved.url;

    // 3. Inform the user immediately — analysis happens in-line but the
    //    upload itself is the user-visible event.
    recordPlaygroundEvent({
      projectId: p.id,
      eventType: "character_uploaded",
      agent: "Character Director",
      message: `Reference image uploaded${body.name ? ` for ${body.name}` : ""}. Vision Analyzer is extracting design cues.`,
      payload: { url: saved.url, sizeBytes: saved.sizeBytes },
    });

    // 4. Run Gemini 2.5 Flash analysis. Errors are non-fatal — we still
    //    create a character row with the raw image as portrait so the user
    //    can manually edit fields if vision fails.
    let analysis;
    try {
      analysis = await analyzeCharacterReference(fetchableUrl);
    } catch (err) {
      // Defensive — analyzeCharacterReference already swallows internal
      // errors, but belt-and-braces.
      analysis = {
        appearance: "Reference character (analysis unavailable).",
        summary: `Analyzer error: ${(err as Error).message}`,
        modelUsed: "fallback",
      } as Awaited<ReturnType<typeof analyzeCharacterReference>>;
    }

    // 5. Persist character row.
    const characterId = uuid();
    const appearanceJson = JSON.stringify({
      faceStructure: analysis.faceStructure,
      hairColor: analysis.hairColor,
      hairStyle: analysis.hairStyle,
      skinTone: analysis.skinTone,
      outfit: analysis.outfit,
      ageVibe: analysis.ageVibe,
      mood: analysis.mood,
      accessories: analysis.accessories,
      energy: analysis.energy,
      source: "uploaded_reference",
      referenceUrl: saved.url,
      analyzerModel: analysis.modelUsed,
    });
    db.prepare(
      `INSERT INTO characters (id, project_id, name, role, description, appearance_json, portrait_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      characterId,
      p.id,
      body.name || "Reference Character",
      body.role || "Protagonist",
      analysis.appearance,
      appearanceJson,
      saved.url,
    );

    recordPlaygroundEvent({
      projectId: p.id,
      eventType: "vision_analyzed",
      agent: "Vision Analyzer",
      message: `Analyzed uploaded portrait via ${analysis.modelUsed}. ${analysis.summary}`,
      payload: {
        characterId,
        analyzer: analysis.modelUsed,
        extracted: {
          hair: analysis.hairColor && analysis.hairStyle
            ? `${analysis.hairColor} ${analysis.hairStyle}`
            : analysis.hairColor || analysis.hairStyle,
          age: analysis.ageVibe,
          outfit: analysis.outfit,
        },
      },
    });

    res.status(201).json({
      ok: true,
      characterId,
      referenceUrl: saved.url,
      analysis,
    });
  },
);

router.post("/:id/storyboard/generate", requireAuth, generationLimiter, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const inflight = findInflightStage(p.id, "storyboard_generate");
  if (inflight) {
    res.status(202).json({ jobId: inflight.id, status: inflight.status, deduped: true });
    return;
  }
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
  const inflight = findInflightStage(p.id, "visualization_generate");
  if (inflight) {
    res.status(202).json({ jobId: inflight.id, status: inflight.status, deduped: true });
    return;
  }
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
  const inflight = findInflightStage(p.id, "production_pipeline");
  if (inflight) {
    res.json({ ok: true, jobId: inflight.id, deduped: true });
    return;
  }
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
  const events = db
    .prepare(
      "SELECT id, event_type, agent, message, payload_json, created_at FROM playground_events WHERE project_id = ? ORDER BY created_at DESC LIMIT 50",
    )
    .all(p.id);
  const agentLogs = db
    .prepare(
      "SELECT id, agent_name, level, message, metadata_json, created_at FROM agent_activity_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 50",
    )
    .all(p.id);
  res.write(`event: history\ndata: ${JSON.stringify({ events, agentLogs })}\n\n`);
  req.on("close", cleanup);
});

router.get("/:id/story-bible", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const bible = db.prepare("SELECT * FROM story_bibles WHERE project_id = ?").get(p.id);
  if (!bible) {
    res.json(null);
    return;
  }
  const b = bible as Record<string, unknown>;
  let parsed: unknown = null;
  try {
    parsed = b.arcs_json ? JSON.parse(b.arcs_json as string) : null;
  } catch {
    parsed = null;
  }
  res.json({ ...b, parsed });
});

router.get("/:id/characters", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const rows = db
    .prepare("SELECT * FROM characters WHERE project_id = ? ORDER BY created_at ASC")
    .all(p.id);
  res.json(rows);
});

router.get("/:id/scenes", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const rows = db
    .prepare(
      "SELECT s.*, sv.start_frame_url, sv.end_frame_url FROM scenes s LEFT JOIN scene_visualizations sv ON sv.scene_id = s.id WHERE s.project_id = ? ORDER BY s.scene_number ASC",
    )
    .all(p.id);
  res.json(rows);
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
