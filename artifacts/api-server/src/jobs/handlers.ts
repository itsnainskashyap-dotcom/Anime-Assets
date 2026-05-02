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
import { generateMusic, generateTts, applyLipSync } from "../providers/audioProviders.js";
import { notify } from "../services/notifications.js";
import { validateVisual } from "../providers/visionProvider.js";
import { enqueueTask, enqueueStageOnce, type JobTaskRow } from "../services/queue.js";
import { saveBuffer, STORAGE_ROOT_PATH } from "../providers/storageProvider.js";
import { safeFetch } from "../lib/safeFetch.js";
import { pool } from "../lib/concurrency.js";
import ffmpegPath from "ffmpeg-static";
import { compileChunkPrompt } from "../services/promptCompiler.js";
import { buildVisualizationPack } from "../services/visualizationDirector.js";
import { runChunkStoryboard } from "../services/storyboardComposer.js";
import { trimReferenceVideoTo10s } from "../services/referenceVideo.js";
import { generateAudioForChunk } from "../services/audioDirector.js";
import { runCapabilityProbe } from "../services/capabilityTester.js";

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
  estimated_seconds: number | null;
  language: string | null;
} | null {
  return db
    .prepare(
      "SELECT id, user_id, title, story_prompt, format, genre, voice_style, estimated_seconds, language FROM projects WHERE id = ?",
    )
    .get(projectId) as ReturnType<typeof projectRow>;
}

function languageInstruction(lang: string): string {
  switch ((lang || "en").toLowerCase()) {
    case "hi":
      return "Write all character dialogue lines in Hindi (Devanagari script). Character names should be Hindi/Indian. Story narration and scene descriptions should be in English but dialogue in Hindi.";
    case "hi-en":
      return "Write all character dialogue lines in Hinglish (Roman-script Hindi-English mix, e.g. 'Tum mere saath aaoge?' or 'Yaar, kuch toh kar!' — NOT Devanagari). Character names can be Indian or mixed cultural style.";
    case "es":
      return "Write all character dialogue lines in Spanish. Character names should be Spanish/Latin American. Story narration in English, dialogue in Spanish.";
    case "ja":
      return "Write all character dialogue lines in Japanese (romaji transliteration is fine, e.g. 'Watashi wa koko ni iru'). Character names should be Japanese. Narration in English, dialogue in Japanese.";
    case "ko":
      return "Write all character dialogue lines in Korean (or romanized Korean). Character names should be Korean. Narration in English, dialogue in Korean.";
    case "fr":
      return "Write all character dialogue lines in French. Character names can be French. Narration in English, dialogue in French.";
    case "pt":
      return "Write all character dialogue lines in Portuguese (Brazilian). Character names can be Portuguese/Brazilian. Narration in English, dialogue in Portuguese.";
    case "zh":
      return "Write all character dialogue lines in Mandarin Chinese (pinyin romanization is acceptable). Character names should be Chinese. Narration in English, dialogue in Chinese.";
    case "ar":
      return "Write all character dialogue lines in Arabic (romanized/transliterated is fine). Character names should be Arabic. Narration in English, dialogue in Arabic.";
    default:
      return "Write all character dialogue lines in English. Character names can be any cultural style appropriate to the story.";
  }
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
  const projectLang = project.language || "en";
  const langInstr = languageInstruction(projectLang);

  // Prefer the exact target the user picked at project creation. Fall back to
  // a sane per-format default if the column is empty (older projects).
  const fallbackByFormat = format === "series" ? 10800 : format === "episode" ? 1320 : 180;
  const targetSeconds = project.estimated_seconds && project.estimated_seconds > 0
    ? project.estimated_seconds
    : fallbackByFormat;

  // Scene budget + per-scene duration band scale with the target. The
  // storyboard step later splits long scenes into 10s video chunks, so a
  // long per-scene duration is fine — it just produces more chunks.
  //  • short  (≤180s)   → scenes 5..20s, count 4..15
  //  • episode(≤1800s)  → scenes 30..90s, count 12..30
  //  • series (>1800s)  → scenes 60..300s, count 25..40
  let perSceneMin: number;
  let perSceneMax: number;
  let sceneCountMin: number;
  let sceneCountMax: number;
  if (targetSeconds <= 180) {
    perSceneMin = 5; perSceneMax = 20;
    sceneCountMin = 4; sceneCountMax = 15;
  } else if (targetSeconds <= 1800) {
    perSceneMin = 30; perSceneMax = 90;
    sceneCountMin = 12; sceneCountMax = 30;
  } else {
    perSceneMin = 60; perSceneMax = 300;
    sceneCountMin = 25; sceneCountMax = 40;
  }
  // Aim for the target by averaging scenes; constrain to the band.
  const desiredAvgScene = Math.max(perSceneMin, Math.min(perSceneMax, Math.round(targetSeconds / sceneCountMin)));
  const sceneBudget = Math.max(sceneCountMin, Math.min(sceneCountMax, Math.round(targetSeconds / desiredAvgScene)));
  const sceneMin = Math.max(sceneCountMin, sceneBudget - 2);
  const sceneMax = Math.min(sceneCountMax, sceneBudget + 4);
  const actMax = targetSeconds <= 120 ? 3 : targetSeconds <= 600 ? 4 : targetSeconds <= 1800 ? 5 : 8;

  // Ensure the story_bibles row exists so we can UPDATE partial_output during streaming.
  // (The route handler usually creates it, but guard for edge-cases.)
  const existingBibleRow = db.prepare<[string], { id: string }>("SELECT id FROM story_bibles WHERE project_id = ?").get(task.project_id);
  if (!existingBibleRow) {
    db.prepare("INSERT INTO story_bibles (id, project_id, status) VALUES (?, ?, 'generating')").run(uuid(), task.project_id);
  }

  // Stream tokens → save partial output to DB every 1.5 s so the frontend
  // can display a live typewriter effect while Claude is still writing.
  let partialBuf = "";
  let lastPartialSave = 0;
  const onToken = (chunk: string): void => {
    partialBuf += chunk;
    const now = Date.now();
    if (now - lastPartialSave > 1500) {
      lastPartialSave = now;
      try {
        db.prepare("UPDATE story_bibles SET partial_output=? WHERE project_id=?")
          .run(partialBuf, task.project_id);
      } catch { /* non-fatal */ }
    }
  };

  const { data } = await generateJson<StoryBibleData>({
    systemPrompt:
      "You are the Story Director of an AI anime studio. Convert briefs into complete, production-ready story bibles. Be vivid and specific. Output strict JSON ONLY.",
    onToken,
    userPrompt: `Build a complete story bible for an anime production.

INPUT
- Working title: ${project.title}
- Anime style/genre: ${genre}
- Directorial voice style: ${voiceStyle}
- Output language: ${projectLang} — ${langInstr}
- Total target duration: about ${targetSeconds} seconds
- User brief / story prompt:
"""
${storyPrompt}
"""

REQUIREMENTS
- Produce 2–${actMax} acts whose total estimatedDurationSeconds adds up to EXACTLY ${targetSeconds} (±5%).
- Produce 2–6 named characters with FULLY DETAILED appearance (hair, eyes, outfit, distinguishing features) — visual consistency lock. Each character MUST have a sampleDialogue with 2–3 lines in the OUTPUT LANGUAGE.
- Produce ${sceneMin}–${sceneMax} scenes covering the full arc. Each scene MUST have: visual summary, shotType (wide/medium/closeup/extreme-closeup), location, timeOfDay, emotion, durationSeconds (${perSceneMin}–${perSceneMax} each), emotionalBeats (2–3 bullet points of character internal state changes), atmosphere (lighting, sound design, mood details for the animator), and keyDialogue (1–2 lines of actual spoken dialogue in the OUTPUT LANGUAGE, in quotes).
- The SUM of all scene durationSeconds MUST equal ${targetSeconds} (±5%). Scale scene count to fill the time budget fully — no gaps.
- sceneNumber is sequential from 1; each scene is assigned to an actNumber.
- Themes: 2–4 short phrases. Synopsis: exactly 3 rich sentences.
- ALL text fields (synopsis, act summaries, scene summaries, dialogue) MUST be in the output language: ${projectLang}.

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
    "backstory": string, "arc": string, "voiceDescription": string, "sampleDialogue": string[]
  }],
  "scenes": [{
    "sceneNumber": number, "actNumber": number, "title": string, "location": string,
    "timeOfDay": string, "summary": string, "shotType": string, "emotion": string,
    "durationSeconds": number, "emotionalBeats": string[], "atmosphere": string, "keyDialogue": string[]
  }]
}`,
    maxTokens: 32768,
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
  // Clear streaming buffer — generation is complete.
  db.prepare("UPDATE story_bibles SET partial_output=NULL WHERE project_id=?").run(task.project_id);

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
        Math.max(perSceneMin, Math.min(perSceneMax, s.durationSeconds || perSceneMin)),
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

  // V17 §5.3 / §7.1 — Story Finalization gate.
  // Characters MUST NOT auto-build immediately after the story bible is ready.
  // The user must explicitly review the story and click "Finalize Story" in
  // the UI (which sets projects.story_finalized_at). Character generation is
  // now triggered exclusively by an authenticated POST from the user.
  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: "awaiting_finalization",
    agent: "Story Director",
    message: "Story is ready for your review. Finalize it to unlock the Character Studio.",
  });

  return { bibleId, characters: data.characters?.length || 0, scenes: data.scenes?.length || 0 };
}

// ─── CHARACTERS ──────────────────────────────────────────────────────────
async function handleCharacterGenerate(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id || !task.user_id) throw new Error("character_generate requires project_id + user_id");

  // V17 §5.3 / §7.1 — defense-in-depth: even if a task somehow gets enqueued
  // (legacy queue rows, admin retry, etc.) it must NOT run unless the user
  // has explicitly finalized the story. The HTTP route also enforces this.
  const finalRow = db
    .prepare("SELECT story_finalized_at FROM projects WHERE id = ?")
    .get(task.project_id) as { story_finalized_at?: string | null } | undefined;
  if (!finalRow?.story_finalized_at) {
    throw new Error("STORY_NOT_FINALIZED: Character generation is gated until the user finalizes the story.");
  }

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
  const publicBase = process.env.PUBLIC_BASE_URL || "";
  // Convert a stored asset URL into something the upstream image API can
  // actually fetch. If PUBLIC_BASE_URL isn't set, relative /storage/ paths
  // are useless to the upstream service — drop them rather than passing a
  // broken reference and silently degrading consistency.
  const toAbsoluteUrl = (u: string | null): string | null => {
    if (!u) return null;
    if (u.startsWith("http")) return u;
    if (u.startsWith("/storage/")) return publicBase ? `${publicBase}${u}` : null;
    return null;
  };

  const generated: { id: string; name: string; portraitUrl: string }[] = [];
  let portraitFailures = 0;
  const todo = characters.filter((c) => !c.portrait_url);
  const attempted = todo.length;

  if (attempted === 0) {
    recordAgentLog({
      projectId: task.project_id,
      agentName: "character_director",
      message: "All characters already have portraits — skipping image generation.",
    });
  } else {
    recordAgentLog({
      projectId: task.project_id,
      agentName: "character_director",
      message: `Designing visual sheets for ${attempted} character(s) in parallel…`,
    });
  }

  // ── PIPELINED character generation ────────────────────────────────────
  // For each character: generate the portrait THEN immediately kick off all
  // 3 model-sheet angles in parallel using that portrait as a reference image.
  // Running multiple character pipelines concurrently (up to CHAR_CONCURRENCY)
  // means Character 1's sheets can start while Character 2's portrait is still
  // generating — user sees fully-complete character cards appearing one by one.
  const CHAR_CONCURRENCY = 2; // portrait + up to 3 sheets per char = max 8 concurrent

  const SHEET_ANGLES: Array<{
    field: "model_sheet_front_url" | "model_sheet_three_quarter_url" | "model_sheet_back_url";
    label: string;
    aspect: string;
  }> = [
    { field: "model_sheet_front_url",           label: "full body, front view, neutral standing pose, EXACT same face, hair, outfit and proportions as the reference portrait above",        aspect: "9:16" },
    { field: "model_sheet_three_quarter_url",   label: "full body, three-quarter side view, neutral standing pose, EXACT same face, hair, outfit and proportions as the reference portrait above", aspect: "9:16" },
    { field: "model_sheet_back_url",            label: "full body, back view, neutral standing pose, EXACT same hair, outfit and proportions as the reference portrait above",                aspect: "9:16" },
  ];

  await pool(todo, CHAR_CONCURRENCY, async (char) => {
    const appearance = char.appearance_json ? JSON.parse(char.appearance_json) : {};
    const sharedDesc = `${animeStyle} anime style, ${char.name}, ${char.role || "supporting character"}. Hair: ${appearance.hairColor || "dark"} ${appearance.hairStyle || ""}. Eyes: ${appearance.eyeColor || "expressive"}. Skin: ${appearance.skinTone || "natural"}. Build: ${appearance.build || "average"}. Outfit: ${appearance.outfit || "signature outfit"}. Distinguishing: ${appearance.distinguishingFeatures || ""}. Cinematic lighting, sharp linework, high quality cel-shading, no text, character isolated on neutral background.`;

    // ── Step 1: Portrait ─────────────────────────────────────────────────
    let portraitUrl: string | null = null;
    try {
      const img = await generateImage({
        prompt: `${sharedDesc} expressive portrait, head and shoulders, looking directly forward, clean neutral background.`,
        aspectRatio: "1:1",
        userId: task.user_id!,
        projectId: task.project_id!,
        assetType: `characters/${char.id}`,
        filename: "portrait_url.png",
      });
      db.prepare(
        "UPDATE characters SET portrait_url = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
      ).run(img.url, char.id);
      recordPlaygroundEvent({
        projectId: task.project_id!,
        eventType: "character_image_ready",
        agent: "character_director",
        message: `${char.name}: portrait ready.`,
        payload: { characterId: char.id, field: "portrait_url", url: img.url },
      });
      generated.push({ id: char.id, name: char.name, portraitUrl: img.url });
      portraitUrl = img.url;
    } catch (err) {
      logger.error({ err, characterId: char.id, angle: "portrait_url" }, "Character portrait generation failed");
      portraitFailures++;
      return; // Skip model sheets if portrait failed
    }

    // ── Step 2: 3 model-sheet angles in parallel using portrait as ref ───
    // The portrait is fetched once, base64-encoded, and cached by buildReferenceImages.
    const refUrl = toAbsoluteUrl(portraitUrl);
    const referenceUrls = refUrl ? [refUrl] : [];

    await Promise.all(SHEET_ANGLES.map(async (angle) => {
      try {
        const img = await generateImage({
          prompt: `${sharedDesc} ${angle.label}.`,
          aspectRatio: angle.aspect,
          referenceUrls,
          userId: task.user_id!,
          projectId: task.project_id!,
          assetType: `characters/${char.id}`,
          filename: `${angle.field}.png`,
        });
        db.prepare(
          `UPDATE characters SET ${angle.field} = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
        ).run(img.url, char.id);
        recordPlaygroundEvent({
          projectId: task.project_id!,
          eventType: "character_image_ready",
          agent: "character_director",
          message: `${char.name}: ${angle.field.replace(/_url$/, "").replace(/_/g, " ")} ready.`,
          payload: { characterId: char.id, field: angle.field, url: img.url },
        });
      } catch (err) {
        logger.error({ err, characterId: char.id, angle: angle.field }, "Character model-sheet generation failed");
      }
    }));
  });

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

  // Auto-chain: kick off storyboard once character generation finishes (dedupe in-flight).
  // We enqueue even if some portraits failed — visualization can proceed with partial assets;
  // failed portraits will simply not be available as Element references in chunk videos.
  enqueueStageOnce({
    type: "storyboard_generate",
    stage: "storyboard_generate",
    projectId: task.project_id,
    userId: task.user_id!,
    payload: {},
  });

  return { generated };
}

// ─── STORYBOARD (skeleton: split scenes into 10s chunks) ─────────────────
async function handleStoryboard(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id || !task.user_id) throw new Error("storyboard_generate requires project_id");
  setProjectStage(task.project_id, "storyboard", 50);

  const scenes = db
    .prepare<[string], {
      id: string;
      scene_number: number;
      title: string | null;
      description: string | null;
      duration_seconds: number;
    }>(
      "SELECT id, scene_number, title, description, duration_seconds FROM scenes WHERE project_id = ? ORDER BY scene_number ASC",
    )
    .all(task.project_id);

  if (scenes.length === 0) return { skipped: true, reason: "no_scenes" };

  let totalChunks = 0;
  let globalChunkNo = 0;
  for (const scene of scenes) {
    const sceneDur = Math.max(5, scene.duration_seconds || 10);
    // Spec: 10-second chunks. A scene >10s is split into ⌈sceneDur/10⌉ chunks.
    const numChunks = Math.max(1, Math.ceil(sceneDur / 10));

    for (let i = 0; i < numChunks; i++) {
      globalChunkNo++;
      const chunkDur = i === numChunks - 1 ? sceneDur - i * 10 : 10;
      // Use upsert pattern: keep existing chunk row if scene_id+chunk_index already set.
      const existing = db
        .prepare<[string, number], { id: string }>(
          "SELECT id FROM video_chunks WHERE scene_id = ? AND chunk_number = ?",
        )
        .get(scene.id, globalChunkNo);
      if (!existing) {
        db.prepare(
          `INSERT INTO video_chunks (id, project_id, scene_id, chunk_number, duration_seconds, status, generation_mode, standard_endpoint, reference_endpoint, provider_model_visible_name, provider_model_hidden_id)
           VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, 'Animax Ultra', ?)`,
        ).run(
          uuid(),
          task.project_id,
          scene.id,
          globalChunkNo,
          chunkDur,
          globalChunkNo === 1 ? "standard" : "reference_video",
          "/v1/ai/video/kling-v3-omni-pro",
          "/v1/ai/reference-to-video/kling-v3-omni-pro",
          "kling-v3-omni-pro",
        );
        totalChunks++;
      }
    }
    db.prepare("UPDATE scenes SET status='storyboarded' WHERE id = ?").run(scene.id);
  }

  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: "storyboard_ready",
    agent: "storyboard_director",
    message: `Storyboard skeleton ready — ${scenes.length} scenes split into ${totalChunks} chunks (10s each).`,
    payload: { sceneCount: scenes.length, chunkCount: totalChunks },
  });
  setProjectStage(task.project_id, "storyboard_ready", 55);

  // Auto-enqueue visualization stage so the next pipeline step runs (dedupe in-flight).
  enqueueStageOnce({
    type: "visualization_generate",
    stage: "visualization_generate",
    projectId: task.project_id,
    userId: task.user_id,
    payload: {},
  });
  return { scenes: scenes.length, chunks: totalChunks };
}

// ─── VISUALIZATION (full 5-image pack per scene) ─────────────────────────
async function handleVisualization(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id || !task.user_id) throw new Error("visualization_generate requires project_id");
  setProjectStage(task.project_id, "visualization", 60);

  const project = projectRow(task.project_id);
  if (!project) throw new Error("project not found");

  const scenes = db
    .prepare<[string], {
      id: string;
      scene_number: number;
      title: string | null;
      description: string | null;
      shot_type: string | null;
      emotion: string | null;
      duration_seconds: number;
    }>(
      "SELECT id, scene_number, title, description, shot_type, emotion, duration_seconds FROM scenes WHERE project_id = ? ORDER BY scene_number ASC",
    )
    .all(task.project_id);
  if (scenes.length === 0) return { skipped: true, reason: "no_scenes" };

  const characters = db
    .prepare<[string], { portrait_url: string | null; model_sheet_front_url: string | null }>(
      "SELECT portrait_url, model_sheet_front_url FROM characters WHERE project_id = ?",
    )
    .all(task.project_id);
  const publicBase = process.env.PUBLIC_BASE_URL || "";
  const charRefs = characters
    .map((c) => c.portrait_url || c.model_sheet_front_url)
    .filter((u): u is string => Boolean(u))
    .map((u) => (u.startsWith("/storage/") ? `${publicBase}${u}` : u))
    .filter((u) => u.startsWith("http"));

  const animeStyle = project.genre || "modern anime";
  let scenesWithFrames = 0;

  // Build packs in parallel batches. Each scene internally already
  // parallelizes its 6 image calls, so cap scene-level concurrency to 2 to
  // avoid overwhelming the upstream image API (peak in-flight ~12 images).
  const SCENE_CONCURRENCY = 2;
  await pool(scenes, SCENE_CONCURRENCY, async (scene, idx) => {
    const pack = await buildVisualizationPack({
      projectId: task.project_id!,
      userId: task.user_id!,
      scene,
      characterRefs: charRefs,
      animeStyle,
      isFirstScene: idx === 0,
    });
    if (pack.startFrameUrl || pack.endFrameUrl) scenesWithFrames++;

    // Update all chunks of this scene with their visualization assets.
    const chunks = db
      .prepare<[string], { id: string; chunk_number: number }>(
        "SELECT id, chunk_number FROM video_chunks WHERE scene_id = ? ORDER BY chunk_number ASC",
      )
      .all(scene.id);
    for (const c of chunks) {
      db.prepare(
        `UPDATE video_chunks
         SET seed_frame_image_url = ?, start_frame_image_url = ?, end_frame_image_url = ?,
             scene_board_image_url = ?, element_1_url = ?, element_2_url = ?, status = 'queued',
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`,
      ).run(
        pack.seedFrameUrl,
        pack.startFrameUrl,
        pack.endFrameUrl,
        pack.sceneBoardUrl,
        pack.element1Url,
        pack.element2Url,
        c.id,
      );
    }
  });

  if (scenes.length > 0 && scenesWithFrames === 0) {
    throw new Error(
      `Visualization image generation failed for all ${scenes.length} scenes; aborting.`,
    );
  }

  const vp = db
    .prepare<[string], { id: string }>("SELECT id FROM visualization_packs WHERE project_id = ?")
    .get(task.project_id);
  if (vp) {
    db.prepare("UPDATE visualization_packs SET status='ready' WHERE id = ?").run(vp.id);
  } else {
    db.prepare(
      "INSERT INTO visualization_packs (id, project_id, status, json) VALUES (?, ?, 'ready', '{}')",
    ).run(uuid(), task.project_id);
  }

  setProjectStage(task.project_id, "visualization_ready", 70);

  // Auto-enqueue production pipeline so chunk videos start generating end-to-end
  // (dedupe in-flight to prevent duplicate Kling video calls = wasted credits).
  enqueueStageOnce({
    type: "production_pipeline",
    stage: "production_pipeline",
    projectId: task.project_id,
    userId: task.user_id,
    payload: {},
  });

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
  const storyboardTaskIds: string[] = [];
  // Sequential: each chunk depends on the previous one so chunk N can use the
  // previous chunk's video as its reference for reference-to-video mode.
  // ALSO: every chunk gets a MANDATORY storyboard task that the video task
  // depends on — the video step is gated on its own storyboard being ready.
  let prevTaskId: string | undefined;
  for (const c of chunks) {
    const cycle = attemptByChunk.get(c.id) ?? 0;

    // Reset any previous storyboard so a re-run regenerates a fresh sheet.
    db.prepare(
      `UPDATE video_chunks
         SET storyboard_status = 'pending', storyboard_error_message = NULL
       WHERE id = ?`,
    ).run(c.id);

    const sb = enqueueTask({
      type: "chunk_storyboard_generate",
      stage: "chunk_storyboard_generate",
      projectId: task.project_id,
      userId: task.user_id,
      chunkId: c.id,
      payload: { chunkId: c.id },
      idempotencyKey: `${task.project_id}:storyboard:${c.id}:cycle:${cycle}`,
    });
    storyboardTaskIds.push(sb.id);

    const dependsOn = [sb.id];
    if (prevTaskId) dependsOn.push(prevTaskId);

    const t = enqueueTask({
      type: "video_chunk_generate",
      stage: "video_chunk_generate",
      projectId: task.project_id,
      userId: task.user_id,
      chunkId: c.id,
      payload: { chunkId: c.id },
      idempotencyKey: `${task.project_id}:chunk:${c.id}:cycle:${cycle}`,
      dependsOn,
    });
    chunkTaskIds.push(t.id);
    prevTaskId = t.id;
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
    message: `Queued ${chunks.length} storyboards + ${chunks.length} video chunks + final export.`,
    payload: { storyboardTaskIds, chunkTaskIds, exportTaskId: exportTask.id },
  });

  return { storyboardTaskIds, chunkTaskIds, exportTaskId: exportTask.id };
}

// ─── CHUNK STORYBOARD ────────────────────────────────────────────────────
// Plans 6–12 cinematic shots and renders them as ONE composite anime grid
// image per 10s chunk. The video_chunk_generate task is dependsOn-gated on
// this stage, so video generation cannot run without a storyboard sheet.
async function handleChunkStoryboard(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id || !task.user_id) {
    throw new Error("chunk_storyboard_generate requires project_id");
  }
  const payload = task.payload_json
    ? (JSON.parse(task.payload_json) as { chunkId?: string })
    : {};
  const chunkId = task.chunk_id || payload.chunkId;
  if (!chunkId) throw new Error("chunk_storyboard_generate requires chunkId");

  const r = await runChunkStoryboard(chunkId);
  return {
    chunkId,
    storyboardImageUrl: r.imageUrl,
    shotCount: r.shotCount,
    generationModel: r.generationModel,
    generationTimeMs: r.generationTimeMs,
  };
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
      generation_mode: string | null;
      reference_video_url: string | null;
      reference_video_trimmed_url: string | null;
      start_frame_image_url: string | null;
      end_frame_image_url: string | null;
      seed_frame_image_url: string | null;
      storyboard_image_url: string | null;
      storyboard_status: string | null;
    }>(
      "SELECT id, project_id, scene_id, chunk_number, duration_seconds, prompt_text, generation_mode, reference_video_url, reference_video_trimmed_url, start_frame_image_url, end_frame_image_url, seed_frame_image_url, storyboard_image_url, storyboard_status FROM video_chunks WHERE id = ?",
    )
    .get(chunkId);
  if (!chunk) throw new Error("chunk not found");

  // Storyboard is MANDATORY: the production_pipeline gates video on its own
  // storyboard task via dependsOn, so reaching this handler without a ready
  // storyboard means something bypassed the queue. Fail loudly.
  if (chunk.storyboard_status !== "ready" || !chunk.storyboard_image_url) {
    throw new Error(
      `video_chunk_generate: chunk ${chunk.chunk_number} has no ready storyboard ` +
        `(status=${chunk.storyboard_status || "missing"}). Run chunk_storyboard_generate first.`,
    );
  }

  db.prepare("UPDATE video_chunks SET status='generating', attempt_number = attempt_number + 1 WHERE id = ?").run(chunkId);
  recordAgentLog({
    projectId: task.project_id,
    agentName: "video_director",
    message: `Producing chunk ${chunk.chunk_number} (${chunk.duration_seconds}s, mode=${chunk.generation_mode || "standard"})…`,
  });

  // Resolve URL helper.
  const publicBase = process.env.PUBLIC_BASE_URL || "";
  const toAbsolute = (u: string | null | undefined) => {
    if (!u) return undefined;
    if (u.startsWith("http")) return u;
    if (u.startsWith("/storage/") && publicBase) return `${publicBase}${u}`;
    return undefined;
  };

  // Look up the previous chunk's video for reference-video continuity (chunk N>1).
  let prevChunkVideoUrl: string | undefined;
  let prevChunkEndFrameUrl: string | undefined;
  let prevChunkId: string | undefined;
  let prevChunkAlreadyTrimmedUrl: string | null = null;
  if (chunk.chunk_number > 1) {
    const prev = db
      .prepare<[string, number], { id: string; video_url: string | null; end_frame_image_url: string | null; reference_video_trimmed_url: string | null }>(
        "SELECT id, video_url, end_frame_image_url, reference_video_trimmed_url FROM video_chunks WHERE project_id = ? AND chunk_number = ?",
      )
      .get(task.project_id, chunk.chunk_number - 1);
    prevChunkId = prev?.id;
    prevChunkAlreadyTrimmedUrl = prev?.reference_video_trimmed_url || null;
    prevChunkVideoUrl = toAbsolute(prevChunkAlreadyTrimmedUrl || prev?.video_url || null);
    prevChunkEndFrameUrl = toAbsolute(prev?.end_frame_image_url || null);
  }

  // Compile the prompt with the official compiler (handles @Video1, char locks).
  const scene = chunk.scene_id
    ? db
        .prepare<[string], { id: string; scene_number: number; title: string | null; description: string | null; shot_type: string | null; emotion: string | null; duration_seconds: number }>(
          "SELECT id, scene_number, title, description, shot_type, emotion, duration_seconds FROM scenes WHERE id = ?",
        )
        .get(chunk.scene_id)
    : undefined;

  let mode: "standard" | "reference_video" = (chunk.generation_mode === "reference_video" ? "reference_video" : "standard");
  // If chunk_number > 1 and we have a previous video, force reference_video mode.
  if (chunk.chunk_number > 1 && prevChunkVideoUrl) mode = "reference_video";

  const project = projectRow(task.project_id);

  // ── Resolve identity-lock characters (Kling `elements[]`) ─────────────
  // Kling Omni Pro caps `image_urls.length + elements.length` at 4. We reserve
  // up to 1 slot for scene_board (image_urls), leaving 3 for character locks.
  // Characters appear in deterministic order: 'lead' role first, then by name.
  const charLineup = db
    .prepare<
      [string],
      {
        id: string;
        name: string;
        role: string | null;
        portrait_url: string | null;
        model_sheet_front_url: string | null;
        model_sheet_three_quarter_url: string | null;
        model_sheet_back_url: string | null;
      }
    >(
      `SELECT id, name, role, portrait_url, model_sheet_front_url, model_sheet_three_quarter_url, model_sheet_back_url
       FROM characters WHERE project_id = ?
       ORDER BY CASE WHEN LOWER(COALESCE(role,'')) IN ('lead','protagonist','main') THEN 0 ELSE 1 END, name ASC`,
    )
    .all(task.project_id);

  const elementChars: import("../services/promptCompiler.js").ElementCharacter[] = [];
  const elementsApi: import("../providers/videoProvider.js").VideoElement[] = [];
  for (const c of charLineup) {
    const refs = [
      toAbsolute(c.model_sheet_front_url),
      toAbsolute(c.model_sheet_three_quarter_url),
      toAbsolute(c.model_sheet_back_url),
      toAbsolute(c.portrait_url),
    ].filter((u): u is string => !!u);
    const frontal = toAbsolute(c.model_sheet_front_url) || toAbsolute(c.portrait_url);
    if (refs.length === 0 && !frontal) continue;
    elementsApi.push({
      reference_image_urls: refs.length > 0 ? refs : (frontal ? [frontal] : []),
      ...(frontal ? { frontal_image_url: frontal } : {}),
    });
    elementChars.push({
      characterName: c.name,
      shortDescription: c.role || undefined,
    });
    if (elementsApi.length >= 3) break;
  }

  // ── Resolve style/scene image refs (Kling `image_urls[]`) ─────────────
  const sceneViz = chunk.scene_id
    ? db
        .prepare<
          [string],
          { scene_board_url: string | null; element_urls: string | null }
        >("SELECT scene_board_url, element_urls FROM scene_visualizations WHERE scene_id = ?")
        .get(chunk.scene_id)
    : undefined;

  const elementUrls: string[] = (() => {
    if (!sceneViz?.element_urls) return [];
    try {
      const parsed = JSON.parse(sceneViz.element_urls);
      return Array.isArray(parsed)
        ? parsed.filter((u): u is string => typeof u === "string")
        : [];
    } catch {
      return [];
    }
  })();

  const imageRefsApi: string[] = [];
  const imageRefLabels: import("../services/promptCompiler.js").ImageRef[] = [];
  const pushImageRef = (url: string | undefined, label: string) => {
    if (!url) return;
    if (imageRefsApi.includes(url)) return;
    imageRefsApi.push(url);
    imageRefLabels.push({ label });
  };
  // The chunk's own storyboard sheet is the highest-priority reference: it
  // already encodes shot composition, camera angles and on-model characters
  // for THIS specific 10s beat. Push it first so the budget trim below keeps
  // it in even when characters fill most of the slots.
  const storyboardAbs = toAbsolute(chunk.storyboard_image_url);
  if (chunk.storyboard_image_url && !storyboardAbs) {
    // The storyboard exists but we cannot resolve it to a URL the upstream
    // video API can fetch. This usually means PUBLIC_BASE_URL is unset for a
    // local /storage/ path. Loud-log so we never silently degrade the most
    // important per-chunk reference.
    logger.warn(
      { chunkId: chunk.id, storyboardUrl: chunk.storyboard_image_url, publicBase },
      "video_chunk_generate: storyboard image cannot be made absolute (PUBLIC_BASE_URL?), skipping reference",
    );
  }
  pushImageRef(storyboardAbs, "chunk storyboard sheet");
  pushImageRef(toAbsolute(sceneViz?.scene_board_url || null), "scene composition board");
  pushImageRef(toAbsolute(elementUrls[0]), "scene element 1");
  pushImageRef(toAbsolute(elementUrls[1]), "scene element 2");
  pushImageRef(toAbsolute(chunk.seed_frame_image_url), "continuity seed frame");

  // Trim image_urls so total refs (image_urls + elements) <= 4.
  const totalRefBudget = 4;
  const remainingForImages = Math.max(0, totalRefBudget - elementsApi.length);
  const imageUrlsTrimmed = imageRefsApi.slice(0, remainingForImages);
  const imageRefLabelsTrimmed = imageRefLabels.slice(0, remainingForImages);

  const compiled = scene
    ? compileChunkPrompt({
        projectId: task.project_id,
        scene: {
          id: scene.id,
          scene_number: scene.scene_number,
          title: scene.title,
          description: scene.description,
          shot_type: scene.shot_type,
          emotion: scene.emotion,
          duration_seconds: scene.duration_seconds,
        },
        chunk: { id: chunk.id, chunk_number: chunk.chunk_number, duration_seconds: chunk.duration_seconds },
        mode,
        prevChunkVideoUrl,
        prevChunkEndFrameUrl,
        animeStyle: project?.genre || "modern anime",
        elementCharacters: elementChars.slice(0, elementsApi.length),
        imageRefs: imageRefLabelsTrimmed,
      })
    : null;

  const finalPrompt = compiled?.prompt || chunk.prompt_text || "";
  const negative = compiled?.negativePrompt;

  // Persist compiled prompt + mode + char count.
  db.prepare(
    "UPDATE video_chunks SET prompt_text = ?, negative_prompt_text = ?, prompt_char_count = ?, generation_mode = ?, reference_video_url = COALESCE(?, reference_video_url) WHERE id = ?",
  ).run(
    finalPrompt,
    negative || null,
    finalPrompt.length,
    mode,
    mode === "reference_video" ? prevChunkVideoUrl ?? chunk.reference_video_url : null,
    chunkId,
  );

  try {
    // For reference-video mode, ensure the reference is trimmed to ≤10s.
    // We trim INLINE (not via a follow-up task) so chunk N never consumes an
    // untrimmed reference. The reference_video_trim follow-up still runs for
    // visibility / re-trimming when the previous chunk produces longer output.
    let referenceVideoUrl: string | undefined;
    if (mode === "reference_video") {
      // Two reference sources are possible:
      //   (a) prev chunk's video (chunk_number > 1, the common path) — its
      //       trimmed URL lives on the PREV chunk's row.
      //   (b) an externally-attached `chunk.reference_video_url` whose trim
      //       lives on this chunk's own row (`reference_video_trimmed_url`).
      // We pick (a) when available and trim onto prev's row to stay consistent
      // with the lookup at line ~639, otherwise fall back to (b).
      const ownTrimmed = chunk.reference_video_trimmed_url || null;
      const ownExternal = chunk.reference_video_url || null;

      if (prevChunkId && prevChunkVideoUrl) {
        if (prevChunkAlreadyTrimmedUrl) {
          referenceVideoUrl = toAbsolute(prevChunkAlreadyTrimmedUrl) || prevChunkVideoUrl;
        } else {
          try {
            const trim = await trimReferenceVideoTo10s({
              sourceUrl: prevChunkVideoUrl,
              userId: task.user_id,
              projectId: task.project_id,
              chunkId: prevChunkId,
            });
            referenceVideoUrl = toAbsolute(trim.url) || trim.url;
            // Persist on PREV chunk's row so the async follow-up trim is a
            // no-op (handleReferenceVideoTrim short-circuits when set).
            db.prepare(
              "UPDATE video_chunks SET reference_video_trimmed_url = ? WHERE id = ?",
            ).run(trim.url, prevChunkId);
          } catch (err) {
            logger.warn(
              { err, chunkId: chunk.id, prevChunkId },
              "Inline reference trim of prev chunk failed; using raw reference",
            );
            referenceVideoUrl = prevChunkVideoUrl;
          }
        }
      } else if (ownTrimmed || ownExternal) {
        const candidate = toAbsolute(ownTrimmed || ownExternal);
        if (!candidate) throw new Error("reference_video mode requires a reference video URL");
        if (!ownTrimmed && ownExternal) {
          try {
            const trim = await trimReferenceVideoTo10s({
              sourceUrl: candidate,
              userId: task.user_id,
              projectId: task.project_id,
              chunkId: chunk.id,
            });
            referenceVideoUrl = toAbsolute(trim.url) || trim.url;
            db.prepare(
              "UPDATE video_chunks SET reference_video_trimmed_url = ? WHERE id = ?",
            ).run(trim.url, chunk.id);
          } catch (err) {
            logger.warn({ err, chunkId: chunk.id }, "Inline external-ref trim failed; using raw reference");
            referenceVideoUrl = candidate;
          }
        } else {
          referenceVideoUrl = candidate;
        }
      } else {
        throw new Error("reference_video mode requires a previous chunk video URL");
      }
    }

    const result = await generateVideo({
      prompt: finalPrompt,
      durationSeconds: Math.min(chunk.duration_seconds, 10),
      aspectRatio: "16:9",
      startImageUrl: toAbsolute(chunk.start_frame_image_url),
      endImageUrl: mode === "standard" ? toAbsolute(chunk.end_frame_image_url) : undefined,
      referenceVideoUrl,
      imageUrls: imageUrlsTrimmed,
      elements: elementsApi,
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
        message: `Chunk ${chunk.chunk_number} ready (mode=${mode}).`,
        payload: { chunkId, videoUrl: result.videoUrl, mode },
      });

      // Enqueue validation + audio (Audio Director) as follow-ups.
      enqueueTask({
        type: "validation",
        stage: "validation",
        projectId: task.project_id,
        userId: task.user_id,
        chunkId,
        payload: { chunkId },
      });
      enqueueTask({
        type: "audio_chunk_generate",
        stage: "audio_chunk_generate",
        projectId: task.project_id,
        userId: task.user_id,
        chunkId,
        payload: { chunkId },
      });

      // If this chunk's output may be > 10s (rare, depends on provider), schedule a trim
      // so it can be used as the reference for the next chunk.
      enqueueTask({
        type: "reference_video_trim",
        stage: "reference_video_trim",
        projectId: task.project_id,
        userId: task.user_id,
        chunkId,
        payload: { chunkId, sourceUrl: result.videoUrl, forNextChunkNumber: chunk.chunk_number + 1 },
      });
      return { chunkId, videoUrl: result.videoUrl, status: result.status, mode };
    }

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

  // ── Variants: 720p + 9:16 ─────────────────────────────────────────────
  const variantOutputs: Array<{ url: string; localPath: string; type: string; sizeBytes: number; filename: string }> = [
    { url, localPath: outputPath, type: "mp4", sizeBytes: stat.size, filename: outputName },
  ];

  async function runFfmpeg(args: string[], label: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegBin, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      proc.on("error", reject);
      proc.on("exit", (code: number | null) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg ${label} exited ${code}: ${stderr.slice(-300)}`));
      });
    });
  }

  try {
    const v720Name = `final_720p_${Date.now()}.mp4`;
    const v720Path = path.join(workDir, v720Name);
    await runFfmpeg(
      ["-y", "-i", outputPath, "-vf", "scale=-2:720", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "aac", v720Path],
      "720p",
    );
    const s = fs.statSync(v720Path);
    const u = `/storage/${task.user_id}/${task.project_id}/exports/${v720Name}`;
    db.prepare("INSERT INTO exported_files (id, project_id, type, url, size_bytes) VALUES (?, ?, 'mp4_720p', ?, ?)").run(
      uuid(), task.project_id, u, s.size,
    );
    variantOutputs.push({ url: u, localPath: v720Path, type: "mp4_720p", sizeBytes: s.size, filename: v720Name });
  } catch (err) {
    logger.warn({ err }, "Export variant 720p failed");
  }

  try {
    const v916Name = `final_9x16_${Date.now()}.mp4`;
    const v916Path = path.join(workDir, v916Name);
    await runFfmpeg(
      [
        "-y", "-i", outputPath,
        "-vf", "crop=ih*9/16:ih,scale=1080:1920",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        "-c:a", "aac",
        v916Path,
      ],
      "9:16",
    );
    const s = fs.statSync(v916Path);
    const u = `/storage/${task.user_id}/${task.project_id}/exports/${v916Name}`;
    db.prepare("INSERT INTO exported_files (id, project_id, type, url, size_bytes) VALUES (?, ?, 'mp4_9x16', ?, ?)").run(
      uuid(), task.project_id, u, s.size,
    );
    variantOutputs.push({ url: u, localPath: v916Path, type: "mp4_9x16", sizeBytes: s.size, filename: v916Name });
  } catch (err) {
    logger.warn({ err }, "Export variant 9:16 failed");
  }

  // ── SRT subtitles ─────────────────────────────────────────────────────
  let srtPath: string | null = null;
  try {
    // Build a chunk_number → cumulative-start-offset map using each chunk's
    // actual duration_seconds (clamped to ≤10 since we only ever emit ≤10s
    // segments). This avoids drift when a chunk is shorter than 10s
    // (e.g. the final chunk of a scene with sceneDur not divisible by 10).
    const chunks = db
      .prepare<[string], { chunk_number: number; duration_seconds: number }>(
        "SELECT chunk_number, duration_seconds FROM video_chunks WHERE project_id = ? ORDER BY chunk_number ASC",
      )
      .all(task.project_id);
    const offsetByChunk = new Map<number, number>();
    let acc = 0;
    for (const c of chunks) {
      offsetByChunk.set(c.chunk_number, acc);
      const dur = Math.min(Math.max(c.duration_seconds || 10, 1), 10);
      acc += dur;
    }

    const audioPlans = db
      .prepare<[string], { chunk_number: number; plan_json: string }>(
        `SELECT vc.chunk_number, ap.plan_json
         FROM chunk_audio_plans ap
         JOIN video_chunks vc ON vc.id = ap.chunk_id
         WHERE vc.project_id = ?
         ORDER BY vc.chunk_number ASC, ap.created_at DESC`,
      )
      .all(task.project_id);
    function fmtTs(seconds: number): string {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
    }
    const lines: string[] = [];
    let cueNum = 1;
    const seenChunks = new Set<number>();
    for (const row of audioPlans) {
      if (seenChunks.has(row.chunk_number)) continue;
      seenChunks.add(row.chunk_number);
      const offset = offsetByChunk.get(row.chunk_number) ?? (row.chunk_number - 1) * 10;
      let plan: { dialogue?: Array<{ speaker?: string; line?: string; startSec?: number; endSec?: number }> } = {};
      try { plan = JSON.parse(row.plan_json); } catch { /* ignore */ }
      for (const d of plan.dialogue || []) {
        const start = offset + (typeof d.startSec === "number" ? d.startSec : 0);
        const end = offset + (typeof d.endSec === "number" ? d.endSec : (d.startSec || 0) + 2);
        lines.push(`${cueNum}`);
        lines.push(`${fmtTs(start)} --> ${fmtTs(end)}`);
        lines.push(`${d.speaker ? `${d.speaker}: ` : ""}${(d.line || "").trim()}`);
        lines.push("");
        cueNum++;
      }
    }
    if (lines.length) {
      const srtName = `subtitles_${Date.now()}.srt`;
      srtPath = path.join(workDir, srtName);
      fs.writeFileSync(srtPath, lines.join("\n"), "utf8");
      const u = `/storage/${task.user_id}/${task.project_id}/exports/${srtName}`;
      db.prepare("INSERT INTO exported_files (id, project_id, type, url, size_bytes) VALUES (?, ?, 'srt', ?, ?)").run(
        uuid(), task.project_id, u, fs.statSync(srtPath).size,
      );
      variantOutputs.push({ url: u, localPath: srtPath, type: "srt", sizeBytes: fs.statSync(srtPath).size, filename: srtName });
    }
  } catch (err) {
    logger.warn({ err }, "SRT generation failed");
  }

  // ── ZIP all artefacts ─────────────────────────────────────────────────
  let zipUrl: string | null = null;
  try {
    const archiver = (await import("archiver")).default;
    const zipName = `bundle_${Date.now()}.zip`;
    const zipPath = path.join(workDir, zipName);
    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(zipPath);
      const arc = archiver("zip", { zlib: { level: 6 } });
      out.on("close", () => resolve());
      out.on("error", reject);
      arc.on("error", reject);
      arc.pipe(out);
      for (const v of variantOutputs) {
        if (fs.existsSync(v.localPath)) arc.file(v.localPath, { name: v.filename });
      }
      arc.finalize();
    });
    const zipStat = fs.statSync(zipPath);
    zipUrl = `/storage/${task.user_id}/${task.project_id}/exports/${zipName}`;
    db.prepare("INSERT INTO exported_files (id, project_id, type, url, size_bytes) VALUES (?, ?, 'zip', ?, ?)").run(
      uuid(), task.project_id, zipUrl, zipStat.size,
    );
  } catch (err) {
    logger.warn({ err }, "ZIP packaging failed");
  }

  db.prepare(
    "UPDATE projects SET status='completed', current_stage='completed', progress_percent=100, thumbnail_url = COALESCE(thumbnail_url, ?), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
  ).run(null, task.project_id);

  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: "export_ready",
    agent: "export_agent",
    message: `Final video ready (${(stat.size / 1024 / 1024).toFixed(1)} MB) with ${variantOutputs.length} files.`,
    payload: { url, sizeBytes: stat.size, variants: variantOutputs.map((v) => ({ url: v.url, type: v.type, sizeBytes: v.sizeBytes })), zipUrl },
  });

  notify(task.user_id, {
    type: "export_ready",
    title: "Your anime is ready",
    body: "Your final video has finished rendering.",
    link: `/app/projects/${task.project_id}`,
    projectId: task.project_id,
  });

  return { url, sizeBytes: stat.size, variants: variantOutputs.map((v) => ({ url: v.url, type: v.type, sizeBytes: v.sizeBytes })), zipUrl };
}

// ─── SONG STUDIO ─────────────────────────────────────────────────────────
interface SongRow {
  id: string;
  project_id: string;
  user_id: string;
  title: string | null;
  concept: string | null;
  language: string | null;
  duration_seconds: number | null;
  status: string;
  music_url: string | null;
  final_video_url: string | null;
}

function loadSongForTask(task: JobTaskRow): SongRow {
  const payload = (task.payload_json ? JSON.parse(task.payload_json) : {}) as { songId?: string };
  if (!payload.songId) throw new Error("songId required in payload");
  if (!task.user_id || !task.project_id) {
    throw new Error("song stage requires authenticated user_id + project_id on the task");
  }
  const r = db
    .prepare<[string, string, string], SongRow>(
      "SELECT * FROM song_projects WHERE id = ? AND user_id = ? AND project_id = ?",
    )
    .get(payload.songId, task.user_id, task.project_id);
  if (!r) throw new Error(`song ${payload.songId} not found or not owned by this user/project`);
  return r;
}

function loadOwnedSongById(songId: string, userId: string, projectId: string): SongRow {
  const r = db
    .prepare<[string, string, string], SongRow>(
      "SELECT * FROM song_projects WHERE id = ? AND user_id = ? AND project_id = ?",
    )
    .get(songId, userId, projectId);
  if (!r) throw new Error(`song ${songId} not found or not owned by this user/project`);
  return r;
}

// Song Bible + Lyrics Timing Agent — produces titled lyrics with per-line timing.
async function handleSongLyricsGenerate(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id) throw new Error("song_lyrics_generate requires project_id");
  const song = loadSongForTask(task);
  recordAgentLog({ projectId: task.project_id, agentName: "song_bible", message: "Drafting song bible + lyrics…" });

  const totalSec = Math.max(15, Math.min(180, song.duration_seconds ?? 60));
  const language = (song.language || "en").toLowerCase();
  const isHinglish = language.startsWith("hi");

  const { data } = await generateJson<{
    title: string;
    mood: string;
    bible: { theme: string; vocalStyle: string; musicStyle: string; visualStyle: string };
    lines: Array<{ lineNumber: number; text: string; startSec: number; endSec: number }>;
  }>({
    systemPrompt: `You are the Song Bible Agent + Lyrics Timing Agent for an anime music studio.
Produce a strict JSON object with: title (string), mood (string), bible {theme, vocalStyle, musicStyle, visualStyle}, lines (array of {lineNumber, text, startSec, endSec}).
- Lyrics must fill ${totalSec}s of audio with line timestamps in seconds.
- Each line is 2–6 seconds long, no overlaps, lineNumber 1..N in order.
${isHinglish ? "- Lyrics in Roman-script Hinglish (e.g. \"Tum mere saath aaoge\"), NOT Devanagari." : "- Lyrics in clear English suitable for an anime OST."}`,
    userPrompt: `Song concept:
${song.concept || song.title || "Theme song for the anime project."}

Song title hint: ${song.title || "auto"}
Total duration: ${totalSec}s
Language: ${language}`,
    maxTokens: 2048,
  });

  const finalTitle = data.title || song.title || "Untitled OST";
  db.prepare("UPDATE song_projects SET title = ?, status = 'lyrics_ready', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(
    finalTitle,
    song.id,
  );
  db.prepare("DELETE FROM song_lyrics WHERE song_id = ?").run(song.id);
  const insLine = db.prepare(
    "INSERT INTO song_lyrics (id, song_id, line_number, text, start_seconds, end_seconds) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const line of data.lines || []) {
    insLine.run(uuid(), song.id, line.lineNumber, line.text, line.startSec, line.endSec);
  }
  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: "song_lyrics_ready",
    agent: "lyrics_timing",
    message: `Lyrics ready for "${finalTitle}" (${(data.lines || []).length} lines).`,
    payload: { songId: song.id, lineCount: (data.lines || []).length, mood: data.mood, bible: data.bible },
  });
  notify(song.user_id, {
    type: "song_lyrics_ready",
    title: "Lyrics ready",
    body: `Song "${finalTitle}" lyrics composed.`,
    link: `/app/projects/${task.project_id}/song`,
    projectId: task.project_id,
  });
  return { songId: song.id, lineCount: (data.lines || []).length, mood: data.mood };
}

async function handleSongMusicGenerate(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id) throw new Error("song_music_generate requires project_id");
  const song = loadSongForTask(task);
  recordAgentLog({ projectId: task.project_id, agentName: "song_music", message: "Generating music track…" });
  const totalSec = Math.max(15, Math.min(180, song.duration_seconds ?? 60));
  const lyrics = db
    .prepare<[string], { text: string }>("SELECT text FROM song_lyrics WHERE song_id = ? ORDER BY line_number ASC")
    .all(song.id)
    .map((r) => r.text)
    .join(" / ");
  const prompt = `${totalSec}s anime OST instrumental, cinematic, high production quality. Title: ${song.title || "Untitled"}. Lyrical mood reference: ${lyrics.slice(0, 400)}`;
  let musicUrl = "";
  try {
    const r = await generateMusic(prompt);
    musicUrl = r.audioUrl;
  } catch (err) {
    logger.warn({ err }, "Song music generation failed");
  }
  db.prepare("UPDATE song_projects SET music_url = ?, status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(
    musicUrl,
    musicUrl ? "music_ready" : "music_failed",
    song.id,
  );
  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: musicUrl ? "song_music_ready" : "song_music_failed",
    agent: "song_music",
    message: musicUrl ? "Song track generated." : "Song track generation failed.",
    payload: { songId: song.id, musicUrl },
  });
  return { songId: song.id, musicUrl };
}

// Song Video Agent — splits the song into 10s chunks and queues per-chunk video.
async function handleSongVideoGenerate(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id) throw new Error("song_video_generate requires project_id");
  const song = loadSongForTask(task);
  const totalSec = Math.max(15, Math.min(180, song.duration_seconds ?? 60));
  const chunkSec = 10;
  const chunkCount = Math.ceil(totalSec / chunkSec);

  db.prepare("DELETE FROM song_video_chunks WHERE song_id = ?").run(song.id);
  const ins = db.prepare(
    "INSERT INTO song_video_chunks (id, song_id, chunk_number, status) VALUES (?, ?, ?, 'queued')",
  );
  const enqueued: string[] = [];
  for (let i = 1; i <= chunkCount; i++) {
    const id = uuid();
    ins.run(id, song.id, i);
    const t = enqueueTask({
      type: "song_chunk_video",
      stage: "song_chunk_video",
      projectId: song.project_id,
      userId: song.user_id,
      payload: { songId: song.id, songChunkId: id, chunkNumber: i, totalChunks: chunkCount },
      idempotencyKey: `song:${song.id}:chunk:${i}`,
    });
    enqueued.push(t.id);
  }
  db.prepare("UPDATE song_projects SET status = 'video_generating', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(song.id);
  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: "song_video_queued",
    agent: "song_video",
    message: `Queued ${chunkCount} song video chunks.`,
    payload: { songId: song.id, chunkCount },
  });
  return { songId: song.id, chunkCount, queuedTaskIds: enqueued };
}

async function handleSongChunkVideo(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id) throw new Error("song_chunk_video requires project_id");
  const payload = (task.payload_json ? JSON.parse(task.payload_json) : {}) as {
    songId?: string;
    songChunkId?: string;
    chunkNumber?: number;
    totalChunks?: number;
  };
  if (!payload.songId || !payload.songChunkId || !payload.chunkNumber) {
    throw new Error("song_chunk_video missing payload fields");
  }
  if (!task.user_id || !task.project_id) {
    throw new Error("song_chunk_video requires authenticated user_id + project_id on the task");
  }
  const song = loadOwnedSongById(payload.songId, task.user_id, task.project_id);
  const startSec = (payload.chunkNumber - 1) * 10;
  const endSec = startSec + 10;
  const lyricsForChunk = db
    .prepare<[string, number, number], { text: string }>(
      "SELECT text FROM song_lyrics WHERE song_id = ? AND start_seconds < ? AND end_seconds > ? ORDER BY line_number ASC",
    )
    .all(song.id, endSec, startSec)
    .map((r) => r.text)
    .join(" / ");
  const prompt = `Anime music video, ${song.title || "Untitled"}, cinematic anime style. Chunk ${payload.chunkNumber}/${payload.totalChunks}. Lyrics in this segment: ${lyricsForChunk || "instrumental beat"}.`;

  let videoUrl = "";
  try {
    const v = await generateVideo({
      prompt,
      durationSeconds: 10,
      aspectRatio: "16:9",
      generateAudio: false,
    });
    videoUrl = v.videoUrl || "";
  } catch (err) {
    logger.warn({ err, songId: song.id, chunk: payload.chunkNumber }, "Song chunk video failed");
  }
  db.prepare("UPDATE song_video_chunks SET status = ?, video_url = ? WHERE id = ?").run(
    videoUrl ? "completed" : "failed",
    videoUrl,
    payload.songChunkId,
  );
  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: videoUrl ? "song_chunk_ready" : "song_chunk_failed",
    agent: "song_video",
    message: `Song chunk ${payload.chunkNumber}/${payload.totalChunks} ${videoUrl ? "ready" : "failed"}.`,
    payload: { songId: song.id, chunkNumber: payload.chunkNumber, videoUrl },
  });
  return { songId: song.id, chunkNumber: payload.chunkNumber, videoUrl };
}

async function handleSongLipsync(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id) throw new Error("song_lipsync requires project_id");
  const song = loadSongForTask(task);
  if (!song.music_url) {
    return { skipped: true, reason: "no_music_url" };
  }
  const chunks = db
    .prepare<[string], { id: string; chunk_number: number; video_url: string | null }>(
      "SELECT id, chunk_number, video_url FROM song_video_chunks WHERE song_id = ? AND video_url IS NOT NULL AND video_url != '' ORDER BY chunk_number ASC",
    )
    .all(song.id);
  let updated = 0;
  for (const c of chunks) {
    try {
      const r = await applyLipSync(c.video_url!, song.music_url);
      if (r.videoUrl && r.videoUrl !== c.video_url) {
        db.prepare("UPDATE song_video_chunks SET video_url = ? WHERE id = ?").run(r.videoUrl, c.id);
        updated++;
      }
    } catch (err) {
      logger.warn({ err, songId: song.id, chunk: c.chunk_number }, "Song chunk lipsync failed");
    }
  }
  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: "song_lipsync_done",
    agent: "lipsync",
    message: `Lip-sync pass complete (${updated}/${chunks.length} chunks updated).`,
    payload: { songId: song.id, updated, total: chunks.length },
  });
  return { songId: song.id, updated, total: chunks.length };
}

async function handleSongExport(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id || !task.user_id) throw new Error("song_export requires project_id");
  const song = loadSongForTask(task);
  const chunks = db
    .prepare<[string], { chunk_number: number; video_url: string | null }>(
      "SELECT chunk_number, video_url FROM song_video_chunks WHERE song_id = ? ORDER BY chunk_number ASC",
    )
    .all(song.id);
  const ready = chunks.filter((c) => c.video_url);
  if (ready.length === 0) {
    return { skipped: true, reason: "no_chunks_ready" };
  }

  // Write SRT from lyrics
  const lyrics = db
    .prepare<[string], { line_number: number; text: string; start_seconds: number; end_seconds: number }>(
      "SELECT line_number, text, start_seconds, end_seconds FROM song_lyrics WHERE song_id = ? ORDER BY line_number ASC",
    )
    .all(song.id);
  const fmt = (s: number): string => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s - Math.floor(s)) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  };
  const srt = lyrics
    .map((l) => `${l.line_number}\n${fmt(l.start_seconds)} --> ${fmt(l.end_seconds)}\n${l.text}\n`)
    .join("\n");
  const srtSaved = await saveBuffer(Buffer.from(srt, "utf8"), {
    userId: task.user_id,
    projectId: task.project_id,
    assetType: `songs/${song.id}`,
    filename: "lyrics.srt",
    contentType: "text/plain",
  });

  // Persist a "final url" pointer to the first chunk for now (full FFmpeg stitch is in handleExport).
  const finalUrl = ready[0]?.video_url || "";
  db.prepare("UPDATE song_projects SET final_video_url = ?, status = 'completed', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(
    finalUrl,
    song.id,
  );
  recordPlaygroundEvent({
    projectId: task.project_id,
    eventType: "song_export_ready",
    agent: "song_export",
    message: `Song export prepared (${ready.length} chunks, SRT generated).`,
    payload: { songId: song.id, finalUrl, srtUrl: srtSaved.url, chunkCount: ready.length },
  });
  notify(task.user_id, {
    type: "song_export_ready",
    title: "Song export ready",
    body: `Your song "${song.title || "Untitled"}" is ready.`,
    link: `/app/projects/${task.project_id}/song`,
    projectId: task.project_id,
  });
  return { songId: song.id, finalUrl, srtUrl: srtSaved.url, chunkCount: ready.length };
}

// Generic notification handler — fan-out from queue into DB+SSE via the notify service.
interface NotificationPayload {
  userId?: string;
  type?: string;
  title?: string;
  body?: string;
  link?: string;
  projectId?: string;
}
async function handleNotification(task: JobTaskRow): Promise<Record<string, unknown>> {
  const payload = (task.payload_json ? JSON.parse(task.payload_json) : {}) as NotificationPayload;
  const userId = payload.userId || task.user_id;
  if (!userId) return { skipped: true, reason: "no_user" };
  notify(userId, {
    type: payload.type || "info",
    title: payload.title || "Notification",
    body: payload.body,
    link: payload.link,
    projectId: payload.projectId || task.project_id || undefined,
  });
  return { delivered: true };
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

async function handleReferenceVideoTrim(task: JobTaskRow): Promise<Record<string, unknown>> {
  const payload = (task.payload_json ? JSON.parse(task.payload_json) : {}) as {
    chunkId?: string;
    sourceUrl?: string;
    forNextChunkNumber?: number;
  };
  if (!task.project_id) throw new Error("reference_video_trim requires project_id");
  const chunkId = payload.chunkId;
  if (!chunkId) {
    return { skipped: true, reason: "no_chunk_id" };
  }
  const chunk = db
    .prepare<[string], { id: string; project_id: string; chunk_number: number; video_url: string | null; reference_video_trimmed_url: string | null }>(
      "SELECT id, project_id, chunk_number, video_url, reference_video_trimmed_url FROM video_chunks WHERE id = ?",
    )
    .get(chunkId);
  if (!chunk) return { skipped: true, reason: "chunk_not_found" };
  if (chunk.reference_video_trimmed_url) {
    return { skipped: true, reason: "already_trimmed", url: chunk.reference_video_trimmed_url };
  }
  const sourceUrl = payload.sourceUrl || chunk.video_url;
  if (!sourceUrl) return { skipped: true, reason: "no_source_video" };

  recordAgentLog({
    projectId: chunk.project_id,
    agentName: "reference_video_trim",
    message: `Trimming chunk ${chunk.chunk_number} for reference handoff…`,
  });

  const trimmed = await trimReferenceVideoTo10s({
    sourceUrl,
    userId: task.user_id || "system",
    projectId: chunk.project_id,
    chunkId: chunk.id,
  });

  db.prepare("UPDATE video_chunks SET reference_video_trimmed_url = ? WHERE id = ?").run(trimmed.url, chunk.id);

  recordPlaygroundEvent({
    projectId: chunk.project_id,
    eventType: "reference_video_ready",
    agent: "reference_video_trim",
    message: `Reference clip from chunk ${chunk.chunk_number} ready for chunk ${(payload.forNextChunkNumber ?? chunk.chunk_number + 1)}.`,
    payload: { chunkId: chunk.id, trimmedUrl: trimmed.url, durationSeconds: trimmed.durationSeconds, trimmedFlag: trimmed.trimmed },
  });

  return { trimmedUrl: trimmed.url, durationSeconds: trimmed.durationSeconds, trimmed: trimmed.trimmed };
}

async function handleAudioChunk(task: JobTaskRow): Promise<Record<string, unknown>> {
  if (!task.project_id || !task.user_id) throw new Error("audio_chunk_generate requires project_id");
  const payload = (task.payload_json ? JSON.parse(task.payload_json) : {}) as { chunkId?: string };
  if (!payload.chunkId) throw new Error("audio_chunk_generate requires chunkId");
  const r = await generateAudioForChunk({
    chunkId: payload.chunkId,
    userId: task.user_id,
    projectId: task.project_id,
  });
  return {
    bgmUrl: r.bgmUrl,
    ttsCount: r.ttsUrls.length,
    sfxCount: r.sfxUrls.length,
    dialogueLines: r.plan.dialogue.length,
  };
}

async function handleCapabilityProbe(task: JobTaskRow): Promise<Record<string, unknown>> {
  const payload = (task.payload_json ? JSON.parse(task.payload_json) : {}) as { providerName?: string; capabilities?: string[] };
  return runCapabilityProbe({ providerName: payload.providerName, capabilities: payload.capabilities }) as unknown as Record<string, unknown>;
}

export const HANDLERS = {
  story_bible_generate: handleStoryBible,
  character_generate: handleCharacterGenerate,
  storyboard_generate: handleStoryboard,
  visualization_generate: handleVisualization,
  production_pipeline: handleProductionPipeline,
  chunk_storyboard_generate: handleChunkStoryboard,
  video_chunk_generate: handleVideoChunk,
  audio_chunk_generate: handleAudioChunk,
  reference_video_trim: handleReferenceVideoTrim,
  validation: handleValidation,
  export_project: handleExport,
  song_lyrics_generate: handleSongLyricsGenerate,
  song_music_generate: handleSongMusicGenerate,
  song_video_generate: handleSongVideoGenerate,
  song_chunk_video: handleSongChunkVideo,
  song_lipsync: handleSongLipsync,
  song_export: handleSongExport,
  cleanup: handleCleanup,
  capability_probe: handleCapabilityProbe,
  notification: handleNotification,
} satisfies Record<string, (task: JobTaskRow) => Promise<Record<string, unknown>>>;

// Helper to keep static type narrowing simple in worker
export async function runHandler(stage: string, task: JobTaskRow): Promise<Record<string, unknown>> {
  const fn = (HANDLERS as Record<string, (task: JobTaskRow) => Promise<Record<string, unknown>>>)[stage];
  if (!fn) {
    throw new Error(`No handler registered for stage "${stage}" (taskId=${task.id})`);
  }
  return fn(task);
}
