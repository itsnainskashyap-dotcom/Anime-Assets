import { DEMO_MODE, demoResponse, getActiveKey, notConfiguredError } from "./registry.js";
import { magnificFetch, poll, MagnificError } from "./magnificClient.js";
import { logger } from "../lib/logger.js";

export interface TtsRequest { text: string; voice?: string; language?: string; }
export interface TtsResponse { audioUrl: string; demo?: boolean; raw?: unknown }

const TTS_ENDPOINT = process.env.MAGNIFIC_TTS_ENDPOINT || "/v1/ai/text-to-speech";
const MUSIC_ENDPOINT = process.env.MAGNIFIC_MUSIC_ENDPOINT || "/v1/ai/text-to-music";
const SFX_ENDPOINT = process.env.MAGNIFIC_SFX_ENDPOINT || "/v1/ai/text-to-sfx";
const LIPSYNC_ENDPOINT = process.env.MAGNIFIC_LIPSYNC_ENDPOINT || "/v1/ai/lipsync";
const TRANSCRIBE_ENDPOINT = process.env.MAGNIFIC_TRANSCRIBE_ENDPOINT || "/v1/ai/transcribe";

interface AudioTaskResponse {
  data?: {
    task_id?: string;
    status?: string;
    audio_url?: string;
    video_url?: string;
    text?: string;
    segments?: unknown[];
    generated?: string[];
  };
}

async function submitAndPoll(endpoint: string, body: unknown): Promise<AudioTaskResponse> {
  const submit = await magnificFetch<AudioTaskResponse>(endpoint, { method: "POST", body });
  const taskId = submit.data?.task_id;
  const direct = submit.data?.audio_url || submit.data?.video_url || submit.data?.generated?.[0];
  if (direct) return submit;
  if (!taskId) return submit;
  return poll<AudioTaskResponse>(
    () => magnificFetch<AudioTaskResponse>(`${endpoint}/${taskId}`),
    (v) => {
      const s = (v.data?.status || "").toUpperCase();
      if (s === "COMPLETED") return true;
      if (s === "FAILED") throw new MagnificError(`${endpoint} failed`, 502, v);
      return !!(v.data?.audio_url || v.data?.video_url || (v.data?.generated && v.data.generated.length > 0));
    },
    { intervalMs: 4000, timeoutMs: 5 * 60 * 1000 },
  );
}

function ensureConfigured(capability: string) {
  if (!getActiveKey("magnific")) {
    throw Object.assign(new Error(`${capability} not configured`), {
      response: notConfiguredError("magnific", capability),
      statusCode: 503,
    });
  }
}

export async function generateTts(req: TtsRequest): Promise<TtsResponse> {
  if (DEMO_MODE) return { audioUrl: "demo://tts.mp3", ...demoResponse("tts", { text: req.text.slice(0, 60) }) };
  ensureConfigured("tts");
  try {
    const r = await submitAndPoll(TTS_ENDPOINT, {
      text: req.text,
      voice: req.voice || "default",
      language: req.language || "en",
    });
    const url = r.data?.audio_url || r.data?.generated?.[0];
    if (!url) throw new MagnificError("TTS returned no audio URL", 502, r);
    return { audioUrl: url, raw: r };
  } catch (err) {
    logger.warn({ err }, "TTS failed; returning silent placeholder");
    return { audioUrl: "" };
  }
}

export async function generateMusic(prompt: string): Promise<{ audioUrl: string; demo?: boolean; raw?: unknown }> {
  if (DEMO_MODE) return { audioUrl: "demo://music.mp3", ...demoResponse("music", { prompt: prompt.slice(0, 60) }) };
  ensureConfigured("music");
  try {
    const r = await submitAndPoll(MUSIC_ENDPOINT, { prompt });
    const url = r.data?.audio_url || r.data?.generated?.[0];
    if (!url) throw new MagnificError("Music returned no audio URL", 502, r);
    return { audioUrl: url, raw: r };
  } catch (err) {
    logger.warn({ err }, "Music generation failed");
    return { audioUrl: "" };
  }
}

export async function generateSfx(prompt: string): Promise<{ audioUrl: string; demo?: boolean; raw?: unknown }> {
  if (DEMO_MODE) return { audioUrl: "demo://sfx.mp3", ...demoResponse("sfx", { prompt: prompt.slice(0, 60) }) };
  ensureConfigured("sfx");
  try {
    const r = await submitAndPoll(SFX_ENDPOINT, { prompt });
    const url = r.data?.audio_url || r.data?.generated?.[0];
    if (!url) throw new MagnificError("SFX returned no audio URL", 502, r);
    return { audioUrl: url, raw: r };
  } catch (err) {
    logger.warn({ err }, "SFX generation failed");
    return { audioUrl: "" };
  }
}

export async function applyLipSync(videoUrl: string, audioUrl: string): Promise<{ videoUrl: string; demo?: boolean; raw?: unknown }> {
  if (DEMO_MODE) return { videoUrl, ...demoResponse("lipsync") };
  ensureConfigured("lipsync");
  try {
    const r = await submitAndPoll(LIPSYNC_ENDPOINT, { video_url: videoUrl, audio_url: audioUrl });
    const url = r.data?.video_url || r.data?.generated?.[0] || videoUrl;
    return { videoUrl: url, raw: r };
  } catch (err) {
    logger.warn({ err }, "Lipsync failed; returning original video");
    return { videoUrl };
  }
}

export async function transcribeAudio(audioUrl: string): Promise<{ text: string; segments?: unknown[]; demo?: boolean; raw?: unknown }> {
  if (DEMO_MODE) return { text: "[demo transcript]", segments: [], ...demoResponse("transcription") };
  ensureConfigured("transcription");
  try {
    const r = await submitAndPoll(TRANSCRIBE_ENDPOINT, { audio_url: audioUrl });
    return { text: r.data?.text || "", segments: r.data?.segments || [], raw: r };
  } catch (err) {
    logger.warn({ err }, "Transcription failed");
    return { text: "" };
  }
}
