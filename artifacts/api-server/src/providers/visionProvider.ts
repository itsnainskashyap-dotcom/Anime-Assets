import { DEMO_MODE, demoResponse, getActiveKey, notConfiguredError } from "./registry.js";

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
}

export async function validateVisual(req: VisionRequest): Promise<VisionResponse> {
  if (DEMO_MODE) {
    return {
      passed: true,
      score: 0.92,
      details: { reason: "demo-mode auto-pass", target: req.imageUrl || req.videoUrl },
      ...demoResponse("vision"),
    };
  }
  const key = getActiveKey("google");
  if (!key) {
    throw Object.assign(new Error("Vision provider not configured"), {
      response: notConfiguredError("google", "vision"),
      statusCode: 503,
    });
  }
  return { passed: true, score: 0.85, details: { stub: true } };
}
