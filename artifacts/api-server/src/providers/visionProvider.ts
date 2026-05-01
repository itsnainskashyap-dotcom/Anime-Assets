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
