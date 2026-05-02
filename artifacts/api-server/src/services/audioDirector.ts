import { v4 as uuid } from "uuid";
import db from "../db/index.js";
import { generateJson } from "../providers/textProvider.js";
import { generateMusic, generateSfx, generateTts } from "../providers/audioProviders.js";
import { detectVoiceLanguage, normalizeForTts } from "./phoneticNormalizer.js";
import { recordAgentLog, recordPlaygroundEvent } from "./playgroundEvents.js";
import { logger } from "../lib/logger.js";

export interface AudioDirectorOutput {
  dialogue: Array<{ speaker: string; line: string; startSec: number; endSec: number }>;
  bgm: { mood: string; prompt: string };
  sfx: Array<{ name: string; prompt: string; atSec: number }>;
}

interface ChunkRow {
  id: string;
  project_id: string;
  scene_id: string | null;
  chunk_number: number;
  duration_seconds: number;
  prompt_text: string | null;
}

async function planAudio(opts: {
  projectId: string;
  voiceStyle: string;
  language: string;
  scenePrompt: string;
  sceneEmotion: string | null;
  durationSeconds: number;
  chunkNumber: number;
}): Promise<AudioDirectorOutput> {
  const langMap: Record<string, string> = {
    "hi": "Hindi (Devanagari or romanized) — NOT English.",
    "hi-en": "Hinglish (Roman-script Hindi-English mix, e.g. 'Tum mere saath aaoge?' — NOT Devanagari).",
    "es": "Spanish.",
    "ja": "Japanese (romaji is fine, e.g. 'Watashi wa yuku').",
    "ko": "Korean (romanized is fine).",
    "fr": "French.",
    "pt": "Portuguese (Brazilian).",
    "zh": "Mandarin Chinese (pinyin is fine).",
    "ar": "Arabic (romanized is fine).",
    "en": "English.",
  };
  const langDesc = langMap[opts.language] || langMap["en"];
  const { data } = await generateJson<AudioDirectorOutput>({
    systemPrompt:
      `You are the Audio Director for an anime studio. For a single 10-second video chunk, plan: dialogue lines (speaker + line + start/end seconds), one BGM cue with mood + a short generation prompt, and 0–3 sound effects with timing. All dialogue must be written in ${langDesc} Output strict JSON only.`,
    userPrompt: `CHUNK ${opts.chunkNumber} (${opts.durationSeconds}s)
Mood: ${opts.sceneEmotion || "cinematic"}
Scene prompt:
${opts.scenePrompt.slice(0, 1500)}

IMPORTANT: Write ALL dialogue lines in ${langDesc} Do not use English if the language is not English.

JSON SCHEMA:
{
  "dialogue": [{ "speaker": string, "line": string, "startSec": number, "endSec": number }],
  "bgm": { "mood": string, "prompt": string },
  "sfx": [{ "name": string, "prompt": string, "atSec": number }]
}`,
    maxTokens: 1024,
  });
  return {
    dialogue: Array.isArray(data.dialogue) ? data.dialogue : [],
    bgm: data.bgm || { mood: "cinematic", prompt: "cinematic anime BGM" },
    sfx: Array.isArray(data.sfx) ? data.sfx : [],
  };
}

export async function generateAudioForChunk(opts: { chunkId: string; userId: string; projectId: string }): Promise<{
  bgmUrl?: string;
  ttsUrls: string[];
  sfxUrls: string[];
  plan: AudioDirectorOutput;
}> {
  const chunk = db
    .prepare<[string], ChunkRow>(
      "SELECT id, project_id, scene_id, chunk_number, duration_seconds, prompt_text FROM video_chunks WHERE id = ?",
    )
    .get(opts.chunkId);
  if (!chunk) throw new Error("chunk not found");

  const project = db
    .prepare<[string], { voice_style: string | null; language: string | null }>("SELECT voice_style, language FROM projects WHERE id = ?")
    .get(opts.projectId);
  const voiceStyle = (project?.voice_style || "english").toLowerCase();
  const projectLanguage = (project?.language || "en").toLowerCase();

  const scene = chunk.scene_id
    ? db
        .prepare<[string], { emotion: string | null }>("SELECT emotion FROM scenes WHERE id = ?")
        .get(chunk.scene_id)
    : null;

  recordAgentLog({
    projectId: opts.projectId,
    agentName: "audio_director",
    message: `Planning audio for chunk ${chunk.chunk_number}…`,
  });

  const plan = await planAudio({
    projectId: opts.projectId,
    voiceStyle,
    language: projectLanguage,
    scenePrompt: chunk.prompt_text || "",
    sceneEmotion: scene?.emotion || null,
    durationSeconds: chunk.duration_seconds,
    chunkNumber: chunk.chunk_number,
  });

  // Persist plan into chunk_audio_plans (if table exists; otherwise skip).
  try {
    db.prepare(
      "INSERT INTO chunk_audio_plans (id, chunk_id, plan_json) VALUES (?, ?, ?)",
    ).run(uuid(), chunk.id, JSON.stringify(plan));
  } catch {
    /* table may not exist; non-fatal */
  }

  const ttsUrls: string[] = [];
  const ttsLangMap: Record<string, string> = {
    "hi": "hi", "hi-en": "hi", "es": "es", "ja": "ja",
    "ko": "ko", "fr": "fr", "pt": "pt", "zh": "zh", "ar": "ar", "en": "en",
  };
  const ttsLangDefault = ttsLangMap[projectLanguage] || "en";
  for (const line of plan.dialogue) {
    const normalized = normalizeForTts(line.line);
    if (!normalized) continue;
    const detected = detectVoiceLanguage(line.line);
    const ttsLang = detected && detected !== "en" ? ttsLangMap[detected] || ttsLangDefault : ttsLangDefault;
    try {
      const r = await generateTts({ text: normalized, language: ttsLang, voice: line.speaker || "default" });
      if (r.audioUrl) ttsUrls.push(r.audioUrl);
    } catch (err) {
      logger.warn({ err }, "Audio Director: TTS failed for line");
    }
  }

  let bgmUrl: string | undefined;
  try {
    const r = await generateMusic(plan.bgm.prompt || `${plan.bgm.mood} anime instrumental, 10 seconds`);
    if (r.audioUrl) bgmUrl = r.audioUrl;
  } catch (err) {
    logger.warn({ err }, "Audio Director: BGM failed");
  }

  const sfxUrls: string[] = [];
  for (const fx of plan.sfx) {
    try {
      const r = await generateSfx(fx.prompt || fx.name);
      if (r.audioUrl) sfxUrls.push(r.audioUrl);
    } catch (err) {
      logger.warn({ err }, "Audio Director: SFX failed");
    }
  }

  // Save first non-empty audio URL onto the chunk for playback / mux convenience.
  const primary = bgmUrl || ttsUrls[0];
  if (primary) {
    db.prepare("UPDATE video_chunks SET audio_url = ? WHERE id = ?").run(primary, chunk.id);
  }

  recordPlaygroundEvent({
    projectId: opts.projectId,
    eventType: "chunk_audio_ready",
    agent: "audio_director",
    message: `Chunk ${chunk.chunk_number} audio composed (${plan.dialogue.length} lines, ${plan.sfx.length} SFX).`,
    payload: { chunkId: chunk.id, bgmUrl, ttsCount: ttsUrls.length, sfxCount: sfxUrls.length },
  });

  return { bgmUrl, ttsUrls, sfxUrls, plan };
}
