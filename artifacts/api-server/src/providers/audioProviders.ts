import { DEMO_MODE, demoResponse, getActiveKey, notConfiguredError } from "./registry.js";

export interface TtsRequest { text: string; voice?: string; language?: string; }
export interface TtsResponse { audioUrl: string; demo?: boolean; }

export async function generateTts(req: TtsRequest): Promise<TtsResponse> {
  if (DEMO_MODE) return { audioUrl: "demo://tts.mp3", ...demoResponse("tts", { text: req.text.slice(0, 60) }) };
  const k = getActiveKey("magnific");
  if (!k) throw Object.assign(new Error("TTS not configured"), { response: notConfiguredError("magnific", "tts"), statusCode: 503 });
  return { audioUrl: "stub://tts.mp3" };
}

export async function generateMusic(prompt: string): Promise<{ audioUrl: string; demo?: boolean }> {
  if (DEMO_MODE) return { audioUrl: "demo://music.mp3", ...demoResponse("music", { prompt: prompt.slice(0, 60) }) };
  const k = getActiveKey("magnific");
  if (!k) throw Object.assign(new Error("Music not configured"), { response: notConfiguredError("magnific", "music"), statusCode: 503 });
  return { audioUrl: "stub://music.mp3" };
}

export async function generateSfx(prompt: string): Promise<{ audioUrl: string; demo?: boolean }> {
  if (DEMO_MODE) return { audioUrl: "demo://sfx.mp3", ...demoResponse("sfx", { prompt: prompt.slice(0, 60) }) };
  const k = getActiveKey("magnific");
  if (!k) throw Object.assign(new Error("SFX not configured"), { response: notConfiguredError("magnific", "sfx"), statusCode: 503 });
  return { audioUrl: "stub://sfx.mp3" };
}

export async function applyLipSync(videoUrl: string, audioUrl: string): Promise<{ videoUrl: string; demo?: boolean }> {
  if (DEMO_MODE) return { videoUrl, ...demoResponse("lipsync") };
  const k = getActiveKey("magnific");
  if (!k) throw Object.assign(new Error("Lipsync not configured"), { response: notConfiguredError("magnific", "lipsync"), statusCode: 503 });
  return { videoUrl };
}

export async function transcribeAudio(audioUrl: string): Promise<{ text: string; segments?: unknown[]; demo?: boolean }> {
  if (DEMO_MODE) return { text: "[demo transcript]", segments: [], ...demoResponse("transcription") };
  const k = getActiveKey("google");
  if (!k) throw Object.assign(new Error("Transcription not configured"), { response: notConfiguredError("google", "transcription"), statusCode: 503 });
  return { text: "" };
}
