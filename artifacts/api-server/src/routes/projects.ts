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
    language?: string;
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

  const langValue = body.language ?? "en";
  db.prepare(
    "INSERT INTO projects (id, user_id, title, format, genre, voice_style, story_prompt, estimated_seconds, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    u.sub,
    body.title,
    body.format ?? null,
    genreValue,
    voiceValue,
    body.storyPrompt ?? null,
    targetSeconds,
    langValue,
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

  // Idempotency: if the auto-pilot already finalized the story, skip the
  // debit + enqueue and just report the existing character job (if any).
  // This prevents double-debit when a stale frontend or API client calls
  // /story/finalize after handleStoryBible already auto-finalized.
  const existing = db
    .prepare<[string], { story_finalized_at: string | null }>(
      "SELECT story_finalized_at FROM projects WHERE id = ?",
    )
    .get(p.id);
  if (existing?.story_finalized_at) {
    const inflight = findInflightStage(p.id, "character_generate");
    res.json({
      ok: true,
      finalizedAt: existing.story_finalized_at,
      characterJobId: inflight?.id,
      alreadyFinalized: true,
    });
    return;
  }

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

  // Auto-trigger character generation immediately after finalization.
  // Idempotent — if a job is already running (e.g., double-click), skip.
  let autoJobId: string | undefined;
  const inflightChar = findInflightStage(p.id, "character_generate");
  if (!inflightChar) {
    try {
      debitCredits(u.sub, "character_generate", { id: p.id, type: "project" });
      const charTask = enqueueGenerationStage("character_generate", p.id, u.sub, {});
      autoJobId = charTask.id;
    } catch {
      // Credits exhausted or other non-fatal issue — character gen can be
      // triggered manually from the Characters tab.
    }
  } else {
    autoJobId = inflightChar.id;
  }

  res.json({ ok: true, finalizedAt: new Date().toISOString(), characterJobId: autoJobId });
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

/**
 * Chat → real action mapping.
 *
 * When the user types something that matches a regenerate-style keyword,
 * we actually enqueue the corresponding pipeline stage instead of just
 * recording an empty acknowledgment. The chat surface stays instant —
 * the heavy work happens in the queue.
 *
 * `action` returns either a plain reply (no job triggered, still useful
 * as a directive log) or `{ reply, stageType }` to enqueue a real job.
 */
type ChatActionResult =
  | { reply: string }
  | { reply: string; stageType: string; payload?: Record<string, unknown> };

const AGENT_ROUTES: Array<{
  keywords: RegExp;
  agent: string;
  intent: string;
  action: (msg: string) => ChatActionResult;
}> = [
  // Order matters: more specific keywords first so "storyboard" beats "story".
  {
    keywords: /(rewrite|regenerate|redo|recompose)\s*(the\s*)?(storyboard|panels)\b/i,
    agent: "Storyboard Composer",
    intent: "storyboard_regenerate",
    action: () => ({
      reply: "Recomposing the storyboard — splitting scenes into fresh 10-second chunks.",
      stageType: "storyboard_generate",
    }),
  },
  {
    keywords: /(rewrite|regenerate|redo)\s*(the\s*)?(visualization|viz|frames|stills|scene\s*boards?)\b/i,
    agent: "Visualization Director",
    intent: "visualization_regenerate",
    action: () => ({
      reply: "Regenerating the visualization pack — start/end frames and scene boards anchored on canon characters.",
      stageType: "visualization_generate",
    }),
  },
  {
    keywords: /(rewrite|regenerate|redo)\s*(the\s*)?(characters?|cast|hero|protagonist)\b/i,
    agent: "Character Director",
    intent: "character_regenerate",
    action: () => ({
      reply: "Regenerating every character — full body portraits + 3-angle turnaround sheets.",
      stageType: "character_generate",
    }),
  },
  {
    keywords: /(rewrite|regenerate|redo|new)\s*(the\s*)?(story|bible|plot|narrative)\b/i,
    agent: "Story Director",
    intent: "story_regenerate",
    action: () => ({
      reply: "Restarting the Story Director — generating a fresh story bible from your premise.",
      stageType: "story_bible_generate",
    }),
  },
  // Conversational beats — logged as a directive but no job triggered.
  {
    keywords: /(act\s*[123]|climax|romance|darker|lighter|suspense|twist|pacing|tone)/i,
    agent: "Story Director",
    intent: "story_note",
    action: (m) => ({
      reply: `Logged your story note — "${m.slice(0, 80)}". I'll apply it on the next story regenerate.`,
    }),
  },
  {
    keywords: /story\s*bible|bible|lore|world/i,
    agent: "Story Bible Agent",
    intent: "bible_note",
    action: () => ({
      reply: "Noted. Use \"regenerate the story\" if you want me to rewrite the bible from scratch.",
    }),
  },
  {
    keywords: /character|hero|protagonist|antagonist|villain/i,
    agent: "Character Director",
    intent: "character_note",
    action: (m) => ({
      reply: `Logged character note — "${m.slice(0, 80)}". Use "regenerate the characters" to apply.`,
    }),
  },
  {
    keywords: /environment|location|setting|forest|tokyo|rainy/i,
    agent: "Visualization Director",
    intent: "environment_note",
    action: (m) => ({
      reply: `Logged environment note — "${m.slice(0, 80)}". This will feed into the next visualization regenerate.`,
    }),
  },
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
  // Stage-aware fallback for ambiguous directives. The 6 UI stages map to
  // a default agent so a chat sent while viewing "characters" routes to the
  // Character Director by default.
  const STAGE_AGENT: Record<string, { agent: string; intent: string; stageType?: string }> = {
    story: { agent: "Story Director", intent: "story_note", stageType: "story_bible_generate" },
    characters: { agent: "Character Director", intent: "character_note", stageType: "character_generate" },
    storyboard: { agent: "Storyboard Composer", intent: "storyboard_note", stageType: "storyboard_generate" },
    visualization: { agent: "Visualization Director", intent: "visualization_note", stageType: "visualization_generate" },
    video: { agent: "Video Orchestrator", intent: "video_note" },
    export: { agent: "Export Agent", intent: "export_note" },
  };

  const keywordMatch = AGENT_ROUTES.find((r) => r.keywords.test(text));
  let agent: string;
  let intent: string;
  let reply: string;
  let stageType: string | undefined;

  if (keywordMatch) {
    const result = keywordMatch.action(text);
    agent = keywordMatch.agent;
    intent = keywordMatch.intent;
    reply = result.reply;
    stageType = "stageType" in result ? result.stageType : undefined;
  } else if (body.stage && STAGE_AGENT[body.stage]) {
    const hint = STAGE_AGENT[body.stage];
    agent = hint.agent;
    intent = hint.intent;
    reply = `${hint.agent} acknowledged your note for the ${body.stage} stage: "${text.slice(0, 80)}". I'll apply it on the next regenerate.`;
  } else {
    agent = "Story Director";
    intent = "general";
    reply = `Understood — "${text.slice(0, 80)}". Standing by for the next directive.`;
  }

  // If the matched action wants a real job, enqueue it (with credit debit
  // and dedupe just like the explicit POST routes). On any failure we still
  // record the chat reply so the user sees what went wrong.
  let jobId: string | undefined;
  let jobStatus: string | undefined;
  if (stageType) {
    try {
      const inflight = findInflightStage(p.id, stageType);
      if (inflight) {
        jobId = inflight.id;
        jobStatus = inflight.status;
        reply = `Already running — ${stageType} job ${inflight.id} is in flight.`;
      } else {
        // Pre-flight gate: characters/storyboard/viz require finalized story
        const requiresFinalized =
          stageType === "character_generate" ||
          stageType === "storyboard_generate" ||
          stageType === "visualization_generate";
        if (
          requiresFinalized &&
          !(p as ProjectRow & { story_finalized_at?: string | null }).story_finalized_at
        ) {
          reply = "Story must be finalized first — generate the story bible and let auto-pilot finalize it.";
        } else {
          debitCredits(u.sub, stageType, { id: p.id, type: "project" });
          const task = enqueueGenerationStage(stageType, p.id, u.sub, {});
          jobId = task.id;
          jobStatus = "queued";
          reply = `${reply} Queued as job ${task.id}.`;
        }
      }
    } catch (err) {
      const e = err as Error;
      reply = `Couldn't start ${stageType}: ${e.message}`;
    }
  }

  recordPlaygroundEvent({
    projectId: p.id,
    eventType: "agent_message",
    agent,
    message: reply,
    payload: { intent, jobId, stageType },
  });
  res.json({ ok: true, agent, intent, jobId, jobStatus, stageType });
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

/**
 * "Lock Canon Designs" — finalizes character designs and kicks off the rest
 * of the production pipeline (storyboard → visualization → production).
 *
 * The frontend "Lock Canon Designs" button is a project-wide action: it
 * locks ALL characters that have at least a portrait ready. A specific
 * characterId may also be passed for granular per-character locking.
 */
router.post("/:id/characters/approve-lock", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const p = loadProject((req.params.id as string), u.sub);
  if (!p) return notFound(res);
  const { characterId, visualSignature, referenceUrls } = (req.body || {}) as {
    characterId?: string;
    visualSignature?: string;
    referenceUrls?: string[];
  };

  // Build the list of characters to lock:
  //   - if characterId is supplied, lock that one
  //   - otherwise lock every character in the project that has a portrait
  let targets: { id: string; portrait_url: string | null }[];
  if (characterId) {
    const row = db
      .prepare<[string, string], { id: string; portrait_url: string | null }>(
        "SELECT id, portrait_url FROM characters WHERE id = ? AND project_id = ?",
      )
      .get(characterId, p.id);
    if (!row) {
      res.status(404).json({ error: "character not found in project" });
      return;
    }
    if (!row.portrait_url) {
      res.status(400).json({
        error: "Character has no portrait yet — wait for generation to finish before locking.",
        code: "CHARACTER_NOT_READY",
      });
      return;
    }
    targets = [row];
  } else {
    targets = db
      .prepare<[string], { id: string; portrait_url: string | null }>(
        "SELECT id, portrait_url FROM characters WHERE project_id = ? AND portrait_url IS NOT NULL",
      )
      .all(p.id);
    if (targets.length === 0) {
      res.status(400).json({
        error: "No characters with completed portraits to lock yet — wait for generation to finish.",
      });
      return;
    }
  }

  const locks = targets.map((t) =>
    approveLock({
      characterId: t.id,
      approvedBy: u.sub,
      visualSignature: visualSignature || "auto",
      referenceUrls: referenceUrls || (t.portrait_url ? [t.portrait_url] : []),
    }),
  );

  recordPlaygroundEvent({
    projectId: p.id,
    eventType: "character_locked",
    agent: "character_director",
    message: `${locks.length} character${locks.length === 1 ? "" : "s"} locked as canon — starting storyboard pipeline.`,
  });

  // Auto-chain into storyboard. enqueueStageOnce dedupes against any
  // in-flight task so a double-click is safe.
  const inflightSb = findInflightStage(p.id, "storyboard_generate");
  if (!inflightSb) {
    enqueueStageOnce({
      type: "storyboard_generate",
      stage: "storyboard_generate",
      projectId: p.id,
      userId: u.sub,
      payload: {},
    });
    recordPlaygroundEvent({
      projectId: p.id,
      eventType: "pipeline_resumed",
      agent: "production_director",
      message: "Storyboard pipeline auto-started after character lock.",
    });
  }

  res.json({ ok: true, locks, lockedCount: locks.length });
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
