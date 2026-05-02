import { DEMO_MODE, demoResponse, getActiveKey } from "./registry.js";
import { generateJson } from "./textProvider.js";
import { logger } from "../lib/logger.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { safeFetch } from "../lib/safeFetch.js";

export interface VisionRequest {
  imageUrl?: string;
  videoUrl?: string;
  prompt: string;
  schema?: string;
  highAccuracy?: boolean;
}

export interface VisionResponse {
  passed: boolean;
  score: number;
  details: Record<string, unknown>;
  demo?: boolean;
  modelUsed?: string;
}

const GEMINI_FLASH = "gemini-2.5-flash";
const GEMINI_PRO = "gemini-2.5-pro";

let cachedGemini: GoogleGenerativeAI | null = null;
function tryGemini(): GoogleGenerativeAI | null {
  if (cachedGemini) return cachedGemini;
  const k = getActiveKey("google");
  if (!k) return null;
  try {
    cachedGemini = new GoogleGenerativeAI(k.key);
    return cachedGemini;
  } catch (err) {
    logger.warn({ err }, "Failed to init Gemini client");
    return null;
  }
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const res = await safeFetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      data: buf.toString("base64"),
      mime: res.headers.get("content-type") || "image/jpeg",
    };
  } catch (err) {
    logger.warn({ err, url }, "Vision: fetch image failed");
    return null;
  }
}

async function validateWithGemini(req: VisionRequest, modelName: string): Promise<VisionResponse | null> {
  const client = tryGemini();
  if (!client || !req.imageUrl) return null;
  try {
    const img = await fetchImageAsBase64(req.imageUrl);
    if (!img) return null;
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent([
      {
        text:
          "You are an anime production quality reviewer. Inspect the supplied image and score it against the user's specification. Return strict JSON: { passed: boolean, score: number (0-1), issues: string[], notes: string }.\n\nSPECIFICATION:\n" +
          req.prompt,
      },
      { inlineData: { data: img.data, mimeType: img.mime } },
    ]);
    const text = result.response.text();
    const data = JSON.parse(text) as { passed?: boolean; score?: number; issues?: string[]; notes?: string };
    return {
      passed: data.passed !== false && (data.score ?? 0.8) >= 0.7,
      score: typeof data.score === "number" ? data.score : 0.8,
      details: { issues: data.issues || [], notes: data.notes || "" },
      modelUsed: modelName,
    };
  } catch (err) {
    logger.warn({ err }, `Vision: Gemini ${modelName} failed`);
    return null;
  }
}

async function validateWithClaude(req: VisionRequest): Promise<VisionResponse> {
  if (!req.imageUrl) return { passed: true, score: 0.8, details: { note: "no image" }, modelUsed: "claude-sonnet-4-6" };
  const { data } = await generateJson<{
    passed: boolean;
    score: number;
    issues?: string[];
    notes?: string;
  }>({
    systemPrompt:
      "You are an anime production quality reviewer. Inspect the supplied image and score it against the user's specification. Return strict JSON: { passed: boolean, score: number (0-1), issues: string[], notes: string }.",
    userPrompt: `Specification:\n${req.prompt}\n\nReview the image and respond as JSON.`,
    imageUrls: [req.imageUrl],
    maxTokens: 1024,
  });
  return {
    passed: data.passed !== false && data.score >= 0.7,
    score: typeof data.score === "number" ? data.score : 0.8,
    details: { issues: data.issues || [], notes: data.notes || "" },
    modelUsed: "claude-sonnet-4-6",
  };
}

/* -------------------------------------------------------------------------- */
/*                       CHARACTER REFERENCE ANALYZER                          */
/* V17 §7.2 — when a user uploads a reference image in the Character Studio    */
/* the system uses Gemini 2.5 Flash to extract structured appearance fields    */
/* so the downstream character-generation pipeline can build a consistent      */
/* design from the reference.                                                  */
/* -------------------------------------------------------------------------- */

export interface CharacterAnalysis {
  appearance: string;
  faceStructure?: string;
  hairColor?: string;
  hairStyle?: string;
  skinTone?: string;
  outfit?: string;
  ageVibe?: string;
  mood?: string;
  accessories?: string;
  energy?: string;
  summary: string;
  modelUsed: string;
}

const CHAR_ANALYZER_PROMPT =
  "You are a senior anime character designer reviewing a reference image. " +
  "Extract structured visual cues. Be concise. Return STRICT JSON with these keys: " +
  "appearance (one paragraph head-to-toe description), faceStructure, hairColor, hairStyle, " +
  "skinTone, outfit, ageVibe (e.g. 'late teens', 'young adult'), mood, accessories, energy " +
  "(one short phrase summarizing personality vibe), summary (one sentence overall hook).";

function synthDemoAnalysis(imageUrl: string): CharacterAnalysis {
  return {
    appearance:
      "Slender protagonist with sharp determined features, layered jacket and quiet confidence.",
    faceStructure: "oval, defined jawline",
    hairColor: "midnight black",
    hairStyle: "side-swept layered",
    skinTone: "warm fair",
    outfit: "fitted dark jacket over a hooded undershirt",
    ageVibe: "late teens",
    mood: "focused / restrained",
    accessories: "single ear cuff",
    energy: "quietly intense",
    summary: `Demo analysis of ${imageUrl.slice(0, 80)} — turn off DEMO_MODE for real Gemini extraction.`,
    modelUsed: "demo",
  };
}

async function analyzeWithGemini(imageUrl: string): Promise<CharacterAnalysis | null> {
  const client = tryGemini();
  if (!client) return null;
  try {
    const img = await fetchImageAsBase64(imageUrl);
    if (!img) return null;
    const model = client.getGenerativeModel({
      model: GEMINI_FLASH,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent([
      { text: CHAR_ANALYZER_PROMPT },
      { inlineData: { data: img.data, mimeType: img.mime } },
    ]);
    const text = result.response.text();
    const data = JSON.parse(text) as Partial<CharacterAnalysis>;
    return {
      appearance: data.appearance ?? "Reference character (appearance not extracted).",
      faceStructure: data.faceStructure,
      hairColor: data.hairColor,
      hairStyle: data.hairStyle,
      skinTone: data.skinTone,
      outfit: data.outfit,
      ageVibe: data.ageVibe,
      mood: data.mood,
      accessories: data.accessories,
      energy: data.energy,
      summary: data.summary ?? "Character reference analyzed.",
      modelUsed: GEMINI_FLASH,
    };
  } catch (err) {
    logger.warn({ err }, "Vision: character reference analysis (Gemini) failed");
    return null;
  }
}

async function analyzeWithClaude(imageUrl: string): Promise<CharacterAnalysis> {
  try {
    const { data } = await generateJson<Partial<CharacterAnalysis>>({
      systemPrompt: CHAR_ANALYZER_PROMPT,
      userPrompt: "Analyze the supplied reference image and respond as JSON.",
      imageUrls: [imageUrl],
      maxTokens: 1024,
    });
    return {
      appearance: data.appearance ?? "Reference character.",
      faceStructure: data.faceStructure,
      hairColor: data.hairColor,
      hairStyle: data.hairStyle,
      skinTone: data.skinTone,
      outfit: data.outfit,
      ageVibe: data.ageVibe,
      mood: data.mood,
      accessories: data.accessories,
      energy: data.energy,
      summary: data.summary ?? "Character reference analyzed (Claude fallback).",
      modelUsed: "claude-sonnet-4-6",
    };
  } catch (err) {
    logger.warn({ err }, "Vision: character reference analysis (Claude) failed");
    return {
      appearance: "Reference character (analysis unavailable; using image as direct portrait).",
      summary: "Vision analysis failed — image will be used as a direct portrait reference.",
      modelUsed: "fallback",
    };
  }
}

/** V17 §7.2 — analyze a user-uploaded character reference image. */
export async function analyzeCharacterReference(imageUrl: string): Promise<CharacterAnalysis> {
  if (DEMO_MODE) return synthDemoAnalysis(imageUrl);
  const gem = await analyzeWithGemini(imageUrl);
  if (gem) return gem;
  return analyzeWithClaude(imageUrl);
}

/**
 * Visual validation/QC. Tries Gemini 2.5 (Flash by default, Pro when
 * highAccuracy=true) when GOOGLE_API_KEY is configured; otherwise falls
 * back to Claude vision.
 */
export async function validateVisual(req: VisionRequest): Promise<VisionResponse> {
  if (DEMO_MODE) {
    return {
      passed: true,
      score: 0.92,
      details: { reason: "demo-mode auto-pass", target: req.imageUrl || req.videoUrl },
      modelUsed: "demo",
      ...demoResponse("vision"),
    };
  }
  if (!req.imageUrl) {
    return { passed: true, score: 0.8, details: { note: "no image; defaulted to pass" }, modelUsed: "none" };
  }

  // Prefer Gemini if configured.
  const gem = await validateWithGemini(req, req.highAccuracy ? GEMINI_PRO : GEMINI_FLASH);
  if (gem) return gem;

  try {
    return await validateWithClaude(req);
  } catch (err) {
    logger.warn({ err }, "Vision validation failed; passing optimistically");
    return { passed: true, score: 0.7, details: { error: (err as Error).message, optimisticPass: true }, modelUsed: "fallback" };
  }
}
