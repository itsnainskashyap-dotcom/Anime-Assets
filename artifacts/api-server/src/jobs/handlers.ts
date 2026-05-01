import { v4 as uuid } from "uuid";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import db from "../db/index.js";
import { logger } from "../lib/logger.js";
import { recordAgentLog, recordPlaygroundEvent } from "../services/playgroundEvents.js";
import { updateMemory } from "../services/productionMemory.js";
import { generateText, generateJson } from "../providers/textProvider.js";
import { generateImage } from "../providers/imageProvider.js";
import { generateVideo } from "../providers/videoProvider.js";
import { generateMusic, generateTts } from "../providers/audioProviders.js";
import { validateVisual } from "../providers/visionProvider.js";
import { enqueueTask, type JobTaskRow } from "../services/queue.js";
import { saveBuffer, STORAGE_ROOT_PATH } from "../providers/storageProvider.js";
import { safeFetch } from "../lib/safeFetch.js";
import ffmpegPath from "ffmpeg-static";

// ─── Types representing the structured Story Bible Claude returns ────────
export interface StoryBibleData {
  title: string;
  animeType?: string;
  genre?: string[];
  synopsis?: string;
  themes?: string[];
  tone?: string;
  setting?: { world?: string; timeperiod?: string; mainLocations?: string[] };
  acts: Array<{
    actNumber: number;
    title: string;
    summary: string;
    emotionalArc?: string;
    keyEvents?: string[];
    estimatedDurationSeconds?: number;
  }>;
  characters: Array<{
    name: string;
    role?: string;
    age?: string;
    personality?: string[];
    appearance?: {
      hairColor?: string;
      hairStyle?: string;
      eyeColor?: string;
      skinTone?: string;
      height?: string;
      build?: string;
      outfit?: string;
      distinguishingFeatures?: string;
    };
    backstory?: string;
    arc?: string;
    voiceDescription?: string;
  }>;
  scenes: Array<{
    sceneNumber: number;
    actNumber?: number;
    title?: string;
    location?: string;
    timeOfDay?: string;
    summary?: string;
    shotType?: string;
    durationSeconds?: number;
    emotion?: string;
  }>;
}

function projectRow(projectId: string): {
  id: string;
  user_id: string;
  title: string;
  story_prompt: string | null;
  format: string | null;
  genre: string | null;
  voice_style: string | null;
} | null {
  return db
    .prepare(
      "SELECT id, user_id, title, story_prompt, format, genre, voice_style FROM projects WHERE id = ?",
    )
    .get(projectId) as ReturnType<typeof projectRow>;
}

function setProjectStage(projectId: string, stage: string, progress?: number): void {
  if (typeof progress === "number") {
    db.prepare(
      "UPDATE projects SET current_stage = ?, progress_percent = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    ).run(stage, Math.max(0, Math.min(100, Math.round(progress))), projectId);
  } else {
    db.prepare(
      "UPDATE projects SET current_stage = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    ).run(stage, projectId);
  }
}

// ─── STORY BIBLE ─────────────────────────────────────────────────────────
async function handleStoryBible(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id) throw new Error("story_bible_generate requires project_id");
  const project = projectRow(task.project_id);
  if (!project) throw new Error("project not found");

  recordAgentLog({
    projectId: task.project_id,
    agentName: "story_director",
    message: "Analysing story brief and building the production bible…",
  });
  setProjectStage(task.project_id, "story_bible", 5);

  const storyPrompt = (project.story_prompt || "").trim() || "A heroic anime tale to be invented.";
  const format = project.format || "short";
  const genre = project.genre || "shonen";
  const voiceStyle = project.voice_style || "english";

  const targetSeconds = format === "movie" ? 600 : format === "long" ? 300 : 60;

  const { data } = await generateJson<StoryBibleData>({
    systemPrompt:
      "You are the Story Director of an AI anime studio. Convert briefs into complete, production-ready story bibles. Be vivid and specific. Output strict JSON ONLY.",
    userPrompt: `Build a complete story bible for an anime production.

INPUT
- Working title: ${project.title}
- Anime style/genre: ${genre}
- Voiceover language style: ${voiceStyle}
- Total target duration: about ${targetSeconds} seconds
- User brief / story prompt:
"""
${storyPrompt}
"""

REQUIREMENTS
- Produce 2–4 acts whose total estimatedDurationSeconds adds up close to ${targetSeconds}.
- Produce 2–6 named characters with detailed appearance descriptions (hair, eyes, outfit, distinguishing features) — these will be used to lock visual consistency.
- Produce 4–10 scenes covering the full arc, each with a clear visual summary, shotType (wide/medium/closeup), location, timeOfDay, emotion, and durationSeconds (5–15 each).
- Make sceneNumber sequential starting at 1 and assign each to an actNumber.
- Themes: 2–4 short phrases. Synopsis: exactly 3 sentences.

JSON SCHEMA
{
  "title": string,
  "animeType": string,
  "genre": string[],
  "synopsis": string,
  "themes": string[],
  "tone": string,
  "setting": { "world": string, "timeperiod": string, "mainLocations": string[] },
  "acts": [{ "actNumber": number, "title": string, "summary": string, "emotionalArc": string, "keyEvents": string[], "estimatedDurationSeconds": number }],
  "characters": [{
    "name": string, "role": string, "age": string, "personality": string[],
    "appearance": { "hairColor": string, "hairStyle": string, "eyeColor": string, "skinTone": string, "height": string, "build": string, "outfit": string, "distinguishingFeatures": string },
    "backstory": string, "arc": string, "voiceDescription": string
  }],
  "scenes": [{ "sceneNumber": number, "actNumber": number, "title": string, "location": string, "timeOfDay": string, "summary": string, "shotType": string, "emotion": string, "durationSeconds": number }]
}`,
    maxTokens: 8192,
  });

  // Persist story bible.
  const bibleRow = db
    .prepare<[string], { id: string }>("SELECT id FROM story_bibles WHERE project_id = ?")
    .get(task.project_id);
  const bibleId = bibleRow?.id || uuid();
  if (bibleRow) {
    db.prepare(
      "UPDATE story_bibles SET status='ready', summary=?, themes=?, tone=?, arcs_json=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    ).run(data.synopsis || "", JSON.stringify(data.themes || []), data.tone || "", JSON.stringify(data), bibleId);
  } else {
    db.prepare(
      "INSERT INTO story_bibles (id, project_id, status, summary, themes, tone, arcs_json) VALUES (?, ?, 'ready', ?, ?, ?, ?)",
    ).run(bibleId, task.project_id, data.synopsis || "", JSON.stringify(data.themes || []), data.tone || "", JSON.stringify(data));
  }

  // Persist characters (only if not already created).
  const existingChars = db
    .prepare<[string], { name: string }>("SELECT name FROM characters WHERE project_id = ?")
    .all(task.project_id);
  const existingNames = new Set(existingChars.map((c) => c.name.toLowerCase()));
  for (const c of data.characters || []) {
    if (existingNames.has((c.name || "").toLowerCase())) continue;
    db.prepare(
      `INSERT INTO characters (id, project_id, name, role, description, appearance_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      uuid(),
      task.project_id,
      c.name,
      c.role || "supporting",
      c.backstory || "",
      JSON.stringify(c.appearance || {}),
    );
  }

  // Persist scenes (only if none exist).
  const sceneCount = (
    db.prepare<[string], { c: number }>("SELECT COUNT(*) AS c FROM scenes WHERE project_id = ?").get(task.project_id) as { c: number }
  ).c;
  if (sceneCount === 0) {
    for (const s of data.scenes || []) {
      db.prepare(
        `INSERT INTO scenes (id, project_id, scene_number, act_number, title, description, shot_type, duration_seconds, emotion, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned')`,
      ).run(
        uuid(),
        task.project_id,
        s.sceneNumber,
        s.actNumber ?? 1,
        s.title || `Scene ${s.sceneNumber}`,
        s.summary || "",
        s.shotType || "medium",
        Math.max(5, Math.min(15, s.durationSeconds || 10)),
        s.emotion || null,
      );
    }
  }

  updateMemory(
    task.project_id,
    "story_director",
    {
      storyArc: { acts: data.acts, themes: data.themes, synopsis: data.synopsis },
      visualStyle: { animeType: data.animeType, tone: data.tone },
    },
    "story_bible_ready",
  );

  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: "story_bible_ready",
    agent: "story_director",
    message: `Story bible ready: ${data.acts?.length || 0} acts, ${data.characters?.length || 0} characters, ${data.scenes?.length || 0} scenes.`,
    payload: { bibleId, charactersCount: data.characters?.length || 0, scenesCount: data.scenes?.length || 0 },
  });
  setProjectStage(task.project_id, "story_bible_ready", 15);

  return { bibleId, characters: data.characters?.length || 0, scenes: data.scenes?.length || 0 };
}

// ─── CHARACTERS ──────────────────────────────────────────────────────────
async function handleCharacterGenerate(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id || !task.user_id) throw new Error("character_generate requires project_id + user_id");
  setProjectStage(task.project_id, "characters", 25);

  const project = projectRow(task.project_id);
  if (!project) throw new Error("project not found");

  const characters = db
    .prepare<[string], {
      id: string;
      name: string;
      role: string | null;
      appearance_json: string | null;
      portrait_url: string | null;
    }>(
      "SELECT id, name, role, appearance_json, portrait_url FROM characters WHERE project_id = ?",
    )
    .all(task.project_id);

  if (characters.length === 0) {
    recordAgentLog({
      projectId: task.project_id,
      agentName: "character_director",
      level: "warn",
      message: "No characters in DB yet — generate the story bible first.",
    });
    return { skipped: true, reason: "no_characters" };
  }

  const animeStyle = project.genre || "modern anime";
  const generated: { id: string; name: string; portraitUrl: string }[] = [];
  let attempted = 0;
  let portraitFailures = 0;

  for (const char of characters) {
    if (char.portrait_url) continue;
    attempted++;
    recordAgentLog({
      projectId: task.project_id,
      agentName: "character_director",
      message: `Designing visual sheet for ${char.name}…`,
    });
    const appearance = char.appearance_json ? JSON.parse(char.appearance_json) : {};
    const sharedDesc = `${animeStyle} anime style, ${char.name}, ${char.role || "supporting character"}. Hair: ${appearance.hairColor || "dark"} ${appearance.hairStyle || ""}. Eyes: ${appearance.eyeColor || "expressive"}. Skin: ${appearance.skinTone || "natural"}. Build: ${appearance.build || "average"}. Outfit: ${appearance.outfit || "signature outfit"}. Distinguishing: ${appearance.distinguishingFeatures || ""}. Cinematic lighting, sharp linework, high quality cel-shading, no text, character isolated on neutral background.`;

    const angles: Array<{ field: "portrait_url" | "model_sheet_front_url" | "model_sheet_three_quarter_url" | "model_sheet_back_url"; label: string; aspect: string; }> = [
      { field: "portrait_url", label: "expressive portrait, head and shoulders, looking forward", aspect: "1:1" },
      { field: "model_sheet_front_url", label: "full body model sheet, front view, neutral pose, standing", aspect: "9:16" },
      { field: "model_sheet_three_quarter_url", label: "full body model sheet, three-quarter side view, neutral pose", aspect: "9:16" },
      { field: "model_sheet_back_url", label: "full body model sheet, back view, neutral pose", aspect: "9:16" },
    ];

    for (const a of angles) {
      const prompt = `${sharedDesc} ${a.label}.`;
      try {
        const img = await generateImage({
          prompt,
          aspectRatio: a.aspect,
          userId: task.user_id,
          projectId: task.project_id,
          assetType: `characters/${char.id}`,
          filename: `${a.field}.png`,
        });
        db.prepare(`UPDATE characters SET ${a.field} = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(img.url, char.id);
        recordPlaygroundEvent({
          projectId: task.project_id,
          eventType: "character_image_ready",
          agent: "character_director",
          message: `${char.name}: ${a.field.replace(/_url$/, "").replace(/_/g, " ")} ready.`,
          payload: { characterId: char.id, field: a.field, url: img.url },
        });
        if (a.field === "portrait_url") generated.push({ id: char.id, name: char.name, portraitUrl: img.url });
      } catch (err) {
        logger.error({ err, characterId: char.id, angle: a.field }, "Character image generation failed");
        if (a.field === "portrait_url") portraitFailures++;
      }
    }
  }

  if (attempted > 0 && generated.length === 0) {
    throw new Error(
      `Character generation failed for all ${attempted} characters (${portraitFailures} portrait failures). Aborting stage so dependent stages do not run with missing assets.`,
    );
  }

  setProjectStage(task.project_id, "characters_ready", 40);
  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: "characters_ready",
    agent: "character_director",
    message: `Generated visuals for ${generated.length} characters.`,
    payload: { generated },
  });

  return { generated };
}

// ─── STORYBOARD ──────────────────────────────────────────────────────────
async function handleStoryboard(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id || !task.user_id) throw new Error("storyboard_generate requires project_id");
  setProjectStage(task.project_id, "storyboard", 50);

  const project = projectRow(task.project_id);
  if (!project) throw new Error("project not found");

  const scenes = db
    .prepare<[string], {
      id: string;
      scene_number: number;
      title: string | null;
      description: string | null;
      shot_type: string | null;
      duration_seconds: number;
      emotion: string | null;
    }>(
      "SELECT id, scene_number, title, description, shot_type, duration_seconds, emotion FROM scenes WHERE project_id = ? ORDER BY scene_number ASC",
    )
    .all(task.project_id);

  if (scenes.length === 0) {
    return { skipped: true, reason: "no_scenes" };
  }

  const characters = db
    .prepare<[string], { id: string; name: string; portrait_url: string | null; model_sheet_front_url: string | null; appearance_json: string | null }>(
      "SELECT id, name, portrait_url, model_sheet_front_url, appearance_json FROM characters WHERE project_id = ?",
    )
    .all(task.project_id);

  const charRefs = characters
    .map((c) => c.portrait_url || c.model_sheet_front_url)
    .filter((u): u is string => Boolean(u))
    .map((u) => (u.startsWith("/storage/") ? `${process.env.PUBLIC_BASE_URL || ""}${u}` : u))
    .filter((u) => u.startsWith("http"));

  const animeStyle = project.genre || "modern anime";
  let scenesWithFrames = 0;

  for (const scene of scenes) {
    recordAgentLog({
      projectId: task.project_id,
      agentName: "storyboard_director",
      message: `Storyboarding scene ${scene.scene_number}: ${scene.title || ""}`,
    });

    const basePrompt = `${animeStyle} anime style. ${scene.shot_type || "medium"} shot. ${scene.description || scene.title || ""}. Mood: ${scene.emotion || "cinematic"}. Sharp linework, vivid colors, dynamic lighting, no text, no watermark.`;

    let startUrl: string | undefined;
    let endUrl: string | undefined;

    try {
      const start = await generateImage({
        prompt: `${basePrompt} Opening frame of the scene.`,
        aspectRatio: "16:9",
        referenceUrls: charRefs.slice(0, 3),
        userId: task.user_id,
        projectId: task.project_id,
        assetType: `scenes/${scene.id}`,
        filename: "start_frame.png",
      });
      startUrl = start.url;
    } catch (err) {
      logger.error({ err, sceneId: scene.id }, "Storyboard start_frame failed");
    }
    try {
      const end = await generateImage({
        prompt: `${basePrompt} Closing frame of the scene, slightly later moment.`,
        aspectRatio: "16:9",
        referenceUrls: charRefs.slice(0, 3),
        userId: task.user_id,
        projectId: task.project_id,
        assetType: `scenes/${scene.id}`,
        filename: "end_frame.png",
      });
      endUrl = end.url;
    } catch (err) {
      logger.error({ err, sceneId: scene.id }, "Storyboard end_frame failed");
    }

    // Persist scene visualization
    const sv = db
      .prepare<[string], { id: string }>("SELECT id FROM scene_visualizations WHERE scene_id = ?")
      .get(scene.id);
    if (sv) {
      db.prepare(
        "UPDATE scene_visualizations SET start_frame_url = ?, end_frame_url = ? WHERE id = ?",
      ).run(startUrl ?? null, endUrl ?? null, sv.id);
    } else {
      db.prepare(
        "INSERT INTO scene_visualizations (id, scene_id, start_frame_url, end_frame_url) VALUES (?, ?, ?, ?)",
      ).run(uuid(), scene.id, startUrl ?? null, endUrl ?? null);
    }

    // Create / update video chunk row.
    const existing = db
      .prepare<[string], { id: string }>("SELECT id FROM video_chunks WHERE scene_id = ? ORDER BY chunk_number ASC LIMIT 1")
      .get(scene.id);
    const chunkId = existing?.id || uuid();
    if (!existing) {
      db.prepare(
        `INSERT INTO video_chunks (id, project_id, scene_id, chunk_number, duration_seconds, status, prompt_text, start_frame_image_url, end_frame_image_url, generation_mode, standard_endpoint, provider_model_visible_name, provider_model_hidden_id)
         VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, 'standard', ?, 'Animax Ultra', ?)`,
      ).run(
        chunkId,
        task.project_id,
        scene.id,
        scene.scene_number,
        scene.duration_seconds,
        basePrompt,
        startUrl ?? null,
        endUrl ?? null,
        "/v1/ai/video/kling-v3-omni-pro",
        "kling-v3-omni-pro",
      );
    } else {
      db.prepare(
        "UPDATE video_chunks SET prompt_text = ?, start_frame_image_url = ?, end_frame_image_url = ?, status='queued', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
      ).run(basePrompt, startUrl ?? null, endUrl ?? null, chunkId);
    }

    db.prepare("UPDATE scenes SET status='storyboarded' WHERE id = ?").run(scene.id);
    if (startUrl || endUrl) scenesWithFrames++;

    recordPlaygroundEvent({
      projectId: task.project_id,
      eventType: "scene_storyboarded",
      agent: "storyboard_director",
      message: `Scene ${scene.scene_number} storyboarded.`,
      payload: { sceneId: scene.id, chunkId, startUrl, endUrl },
    });
  }

  if (scenes.length > 0 && scenesWithFrames === 0) {
    throw new Error(
      `Storyboard frame generation failed for all ${scenes.length} scenes; aborting so production pipeline does not run with empty frames.`,
    );
  }

  // Visualization pack record
  const vp = db
    .prepare<[string], { id: string }>("SELECT id FROM visualization_packs WHERE project_id = ?")
    .get(task.project_id);
  if (vp) {
    db.prepare("UPDATE visualization_packs SET status='ready' WHERE id = ?").run(vp.id);
  } else {
    db.prepare(
      "INSERT INTO visualization_packs (id, project_id, status, json) VALUES (?, ?, 'ready', '{}')",
    ).run(uuid(), task.project_id, );
  }

  setProjectStage(task.project_id, "storyboard_ready", 60);
  return { scenes: scenes.length };
}

// ─── PRODUCTION PIPELINE ─────────────────────────────────────────────────
async function handleProductionPipeline(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id || !task.user_id) throw new Error("production_pipeline requires project_id");

  const chunks = db
    .prepare<[string], { id: string; status: string }>(
      "SELECT id, status FROM video_chunks WHERE project_id = ? AND status IN ('queued','failed') ORDER BY chunk_number ASC",
    )
    .all(task.project_id);

  if (chunks.length === 0) {
    recordAgentLog({ projectId: task.project_id, agentName: "production_director", message: "No chunks to produce — storyboard first." });
    return { skipped: true };
  }

  // Stable per-attempt key so concurrent production_pipeline runs don't queue
  // duplicate chunk/export tasks. Reuses chunk attempt_number as the cycle id.
  const chunkAttempts = db
    .prepare<[string], { id: string; attempt_number: number }>(
      "SELECT id, attempt_number FROM video_chunks WHERE project_id = ?",
    )
    .all(task.project_id);
  const attemptByChunk = new Map(chunkAttempts.map((c) => [c.id, c.attempt_number ?? 0]));

  const chunkTaskIds: string[] = [];
  for (const c of chunks) {
    const cycle = attemptByChunk.get(c.id) ?? 0;
    const t = enqueueTask({
      type: "video_chunk_generate",
      stage: "video_chunk_generate",
      projectId: task.project_id,
      userId: task.user_id,
      chunkId: c.id,
      payload: { chunkId: c.id },
      idempotencyKey: `${task.project_id}:chunk:${c.id}:cycle:${cycle}`,
    });
    chunkTaskIds.push(t.id);
  }

  // Final export task depends on all chunk tasks. Cycle is the max attempt
  // across chunks so a fresh production cycle gets a fresh export.
  const exportCycle = Math.max(0, ...chunkAttempts.map((c) => c.attempt_number ?? 0));
  const exportTask = enqueueTask({
    type: "export_project",
    stage: "export_project",
    projectId: task.project_id,
    userId: task.user_id,
    payload: {},
    idempotencyKey: `${task.project_id}:export:cycle:${exportCycle}`,
    dependsOn: chunkTaskIds,
  });

  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: "production_planned",
    agent: "production_director",
    message: `Queued ${chunks.length} video chunks + final export.`,
    payload: { chunkTaskIds, exportTaskId: exportTask.id },
  });

  return { chunkTaskIds, exportTaskId: exportTask.id };
}

// ─── VIDEO CHUNK ─────────────────────────────────────────────────────────
async function handleVideoChunk(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id || !task.user_id) throw new Error("video_chunk_generate requires project_id");
  const payload = task.payload_json ? (JSON.parse(task.payload_json) as { chunkId?: string }) : {};
  const chunkId = task.chunk_id || payload.chunkId;
  if (!chunkId) throw new Error("chunkId required");

  const chunk = db
    .prepare<[string], {
      id: string;
      project_id: string;
      scene_id: string | null;
      chunk_number: number;
      duration_seconds: number;
      prompt_text: string | null;
      start_frame_image_url: string | null;
      end_frame_image_url: string | null;
    }>(
      "SELECT id, project_id, scene_id, chunk_number, duration_seconds, prompt_text, start_frame_image_url, end_frame_image_url FROM video_chunks WHERE id = ?",
    )
    .get(chunkId);
  if (!chunk) throw new Error("chunk not found");

  db.prepare("UPDATE video_chunks SET status='generating', attempt_number = attempt_number + 1 WHERE id = ?").run(chunkId);
  recordAgentLog({
    projectId: task.project_id,
    agentName: "video_director",
    message: `Producing chunk ${chunk.chunk_number} (${chunk.duration_seconds}s)…`,
  });

  // Resolve start frame URL to absolute (for Magnific to fetch).
  const publicBase = process.env.PUBLIC_BASE_URL || "";
  const toAbsolute = (u: string | null) => {
    if (!u) return undefined;
    if (u.startsWith("http")) return u;
    if (u.startsWith("/storage/") && publicBase) return `${publicBase}${u}`;
    return undefined;
  };

  try {
    const result = await generateVideo({
      prompt: chunk.prompt_text || "",
      durationSeconds: chunk.duration_seconds,
      aspectRatio: "16:9",
      startImageUrl: toAbsolute(chunk.start_frame_image_url),
      endImageUrl: toAbsolute(chunk.end_frame_image_url),
      userId: task.user_id,
      projectId: task.project_id,
      chunkId,
    });

    if (result.videoUrl) {
      db.prepare(
        "UPDATE video_chunks SET status='ready', video_url=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
      ).run(result.videoUrl, chunkId);
      recordPlaygroundEvent({
        projectId: task.project_id,
        eventType: "chunk_ready",
        agent: "video_director",
        message: `Chunk ${chunk.chunk_number} ready.`,
        payload: { chunkId, videoUrl: result.videoUrl },
      });

      // Enqueue validation as a follow-up.
      enqueueTask({
        type: "validation",
        stage: "validation",
        projectId: task.project_id,
        userId: task.user_id,
        chunkId,
        payload: { chunkId },
      });
      return { chunkId, videoUrl: result.videoUrl, status: result.status };
    }

    // Provider returned non-final status — keep chunk in processing state and
    // throw so the queue retries (with backoff) instead of marking the task
    // completed and unblocking dependent export prematurely.
    db.prepare("UPDATE video_chunks SET status='processing' WHERE id = ?").run(chunkId);
    throw new Error(
      `Video generation not yet completed (status=${result.status}, jobId=${result.jobId ?? "n/a"})`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.prepare("UPDATE video_chunks SET status='failed', error_message=? WHERE id = ?").run(msg, chunkId);
    throw err;
  }
}

// ─── VALIDATION ──────────────────────────────────────────────────────────
async function handleValidation(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id) throw new Error("validation requires project_id");
  const chunkId = task.chunk_id || (task.payload_json ? JSON.parse(task.payload_json).chunkId : undefined);
  if (!chunkId) throw new Error("chunkId required");

  const chunk = db
    .prepare<[string], { id: string; prompt_text: string | null; start_frame_image_url: string | null }>(
      "SELECT id, prompt_text, start_frame_image_url FROM video_chunks WHERE id = ?",
    )
    .get(chunkId);
  if (!chunk) throw new Error("chunk not found");

  const publicBase = process.env.PUBLIC_BASE_URL || "";
  const imageUrl = chunk.start_frame_image_url
    ? chunk.start_frame_image_url.startsWith("http")
      ? chunk.start_frame_image_url
      : publicBase ? `${publicBase}${chunk.start_frame_image_url}` : undefined
    : undefined;

  const r = await validateVisual({ prompt: chunk.prompt_text || "Generic anime scene", imageUrl });
  db.prepare(
    "INSERT INTO chunk_validations (id, chunk_id, validator, passed, score, details_json) VALUES (?, ?, 'claude_vision', ?, ?, ?)",
  ).run(uuid(), chunkId, r.passed ? 1 : 0, r.score, JSON.stringify(r.details));
  db.prepare("UPDATE video_chunks SET quality_score = ?, validation_json = ? WHERE id = ?").run(
    r.score,
    JSON.stringify(r),
    chunkId,
  );
  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: "chunk_validated",
    agent: "validator",
    message: `Chunk validated — passed=${r.passed} score=${r.score.toFixed(2)}`,
    payload: { chunkId, passed: r.passed, score: r.score },
  });
  return { chunkId, passed: r.passed, score: r.score };
}

// ─── EXPORT (ffmpeg concat) ──────────────────────────────────────────────
async function handleExport(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id || !task.user_id) throw new Error("export_project requires project_id");
  setProjectStage(task.project_id, "exporting", 90);

  const chunks = db
    .prepare<[string], { id: string; chunk_number: number; video_url: string | null }>(
      "SELECT id, chunk_number, video_url FROM video_chunks WHERE project_id = ? AND video_url IS NOT NULL ORDER BY chunk_number ASC",
    )
    .all(task.project_id);

  if (chunks.length === 0) {
    setProjectStage(task.project_id, "export_failed", 90);
    return { skipped: true, reason: "no_video_chunks" };
  }

  const workDir = path.join(STORAGE_ROOT_PATH, task.user_id, task.project_id, "exports");
  fs.mkdirSync(workDir, { recursive: true });

  const localPaths: string[] = [];
  for (const c of chunks) {
    if (!c.video_url) continue;
    if (c.video_url.startsWith("/storage/")) {
      const local = path.join(STORAGE_ROOT_PATH, c.video_url.replace(/^\/storage\//, ""));
      if (fs.existsSync(local)) {
        localPaths.push(local);
        continue;
      }
    }
    // Download remote chunk to local
    try {
      const res = await safeFetch(c.video_url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const target = path.join(workDir, `chunk_${c.chunk_number}.mp4`);
      fs.writeFileSync(target, buf);
      localPaths.push(target);
    } catch (err) {
      logger.warn({ err, chunkId: c.id }, "Failed to download chunk for export");
    }
  }

  if (localPaths.length === 0) {
    setProjectStage(task.project_id, "export_failed", 90);
    return { skipped: true, reason: "no_local_chunks" };
  }

  const listFile = path.join(workDir, `concat_${Date.now()}.txt`);
  fs.writeFileSync(listFile, localPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
  const outputName = `final_${Date.now()}.mp4`;
  const outputPath = path.join(workDir, outputName);

  const ffmpegBin = (ffmpegPath as unknown as string) || "ffmpeg";
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegBin, ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outputPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("exit", (code: number | null) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });

  const stat = fs.statSync(outputPath);
  const url = `/storage/${task.user_id}/${task.project_id}/exports/${outputName}`;
  db.prepare(
    "INSERT INTO exported_files (id, project_id, type, url, size_bytes) VALUES (?, ?, 'mp4', ?, ?)",
  ).run(uuid(), task.project_id, url, stat.size);
  db.prepare(
    "UPDATE projects SET status='completed', current_stage='completed', progress_percent=100, thumbnail_url = COALESCE(thumbnail_url, ?), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
  ).run(null, task.project_id);

  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: "export_ready",
    agent: "export_agent",
    message: `Final video ready (${(stat.size / 1024 / 1024).toFixed(1)} MB).`,
    payload: { url, sizeBytes: stat.size },
  });

  // Notification
  db.prepare(
    "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, 'export_ready', 'Your anime is ready', 'Your final video has finished rendering.', ?)",
  ).run(uuid(), task.user_id, `/app/projects/${task.project_id}`);

  return { url, sizeBytes: stat.size };
}

// ─── SONG ────────────────────────────────────────────────────────────────
async function handleSong(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id || !task.user_id) throw new Error("song_generate requires project_id");
  const payload = task.payload_json ? JSON.parse(task.payload_json) as { prompt?: string; lyricsOnly?: boolean } : {};

  recordAgentLog({ projectId: task.project_id, agentName: "song_director", message: "Composing song…" });

  const { data } = await generateJson<{ title: string; lyrics: string; mood: string }>({
    systemPrompt: "You are a J-pop / anime OST lyricist. Output strict JSON: { title, lyrics, mood }.",
    userPrompt: `Create song lyrics for an anime production.\nProject context / brief:\n${payload.prompt || "Theme song for the project."}`,
    maxTokens: 2048,
  });

  const songId = uuid();
  db.prepare(
    "INSERT INTO song_projects (id, project_id, title, lyrics, mood, status) VALUES (?, ?, ?, ?, ?, 'lyrics_ready')",
  ).run(songId, task.project_id, data.title, data.lyrics, data.mood);

  let audioUrl = "";
  try {
    const music = await generateMusic(`${data.mood} anime OST instrumental, cinematic, high production quality. ${data.title}.`);
    audioUrl = music.audioUrl;
  } catch (err) {
    logger.warn({ err }, "Music generation failed for song");
  }

  db.prepare("UPDATE song_projects SET audio_url = ?, status = ? WHERE id = ?").run(
    audioUrl,
    audioUrl ? "ready" : "music_failed",
    songId,
  );
  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: "song_ready",
    agent: "song_director",
    message: `Song "${data.title}" composed.`,
    payload: { songId, audioUrl },
  });

  return { songId, audioUrl, title: data.title };
}

// ─── CLEANUP / NOOP ──────────────────────────────────────────────────────
async function handleCleanup(): Promise<Record<string, unknown>> {
  const r = db
    .prepare(
      "DELETE FROM cleanup_queue WHERE delete_after IS NOT NULL AND delete_after < strftime('%Y-%m-%dT%H:%M:%fZ','now')",
    )
    .run();
  return { cleaned: r.changes };
}

export const HANDLERS = {
  story_bible_generate: handleStoryBible,
  character_generate: handleCharacterGenerate,
  storyboard_generate: handleStoryboard,
  visualization_generate: handleStoryboard, // alias — visualization is part of storyboard
  production_pipeline: handleProductionPipeline,
  video_chunk_generate: handleVideoChunk,
  validation: handleValidation,
  export_project: handleExport,
  song_generate: handleSong,
  cleanup: handleCleanup,
  notification: async () => ({ noop: true }),
  reference_video_trim: async (task: JobTaskRow) => ({ noop: true, taskId: task.id }),
} satisfies Record<string, (task: JobTaskRow) => Promise<Record<string, unknown>>>;

// Helper to keep static type narrowing simple in worker
export async function runHandler(stage: string, task: JobTaskRow): Promise<Record<string, unknown>> {
  const fn = (HANDLERS as Record<string, (task: JobTaskRow) => Promise<Record<string, unknown>>>)[stage];
  if (!fn) {
    throw new Error(`No handler registered for stage "${stage}" (taskId=${task.id})`);
  }
  return fn(task);
}
