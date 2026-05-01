import { DEMO_MODE, demoResponse, getActiveKey, notConfiguredError } from "./registry.js";

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  referenceUrls?: string[];
  aspectRatio?: string;
  model?: string;
}

export interface ImageResponse {
  url: string;
  width?: number;
  height?: number;
  demo?: boolean;
  raw?: unknown;
}

export async function generateImage(req: ImageRequest): Promise<ImageResponse> {
  if (DEMO_MODE) {
    return {
      url: "https://placehold.co/1024x576/0a0a0f/e94560?text=Demo+Image",
      width: 1024,
      height: 576,
      ...demoResponse("image", { prompt: req.prompt.slice(0, 80) }),
    };
  }
  const freepik = getActiveKey("freepik");
  const magnific = getActiveKey("magnific");
  if (!freepik && !magnific) {
    throw Object.assign(new Error("Image provider not configured"), {
      response: notConfiguredError("freepik_or_magnific", "image"),
      statusCode: 503,
    });
  }
  return {
    url: "stub://nano-banana-pro/output.png",
    raw: { stub: true, provider: freepik ? "freepik" : "magnific" },
  };
}
