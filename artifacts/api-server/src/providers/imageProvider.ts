import path from "node:path";
import { v4 as uuid } from "uuid";
import { DEMO_MODE, demoResponse } from "./registry.js";
import { magnificFetch, MagnificError, poll } from "./magnificClient.js";
import { saveBuffer } from "./storageProvider.js";
import { logger } from "../lib/logger.js";
import { safeFetch } from "../lib/safeFetch.js";

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;       // kept in interface for callers; ignored by Imagen 4
  referenceUrls?: string[];      // kept in interface for callers; ignored by Imagen 4
  aspectRatio?: string;          // "9:16", "16:9", "1:1", "3:4", "4:3" or named
  model?: string;
  /** Ignored by Imagen 4 (no inference steps parameter). */
  numInferenceSteps?: number;
  userId?: string;
  projectId?: string;
  assetType?: string;
  filename?: string;
}

export interface ImageResponse {
  url: string;
  width?: number;
  height?: number;
  demo?: boolean;
  raw?: unknown;
}

interface Imagen4TaskResponse {
  data?: {
    task_id?: string;
    status?: string;
    generated?: string[];
  };
}

// ── Endpoint ─────────────────────────────────────────────────────────────────
// Default to Imagen 4 Ultra. Override via env for testing or fallback.
const IMAGE_ENDPOINT =
  process.env.MAGNIFIC_IMAGE_ENDPOINT || "/v1/ai/text-to-image/imagen4-ultra";

// ── Aspect-ratio mapping ──────────────────────────────────────────────────────
// Imagen 4 uses named strings; our internal code still passes the old "9:16"
// shorthand, so normalise here before sending upstream.
const ASPECT_RATIO_MAP: Record<string, string> = {
  "9:16":  "social_story_9_16",
  "16:9":  "widescreen_16_9",
  "1:1":   "square_1_1",
  "3:4":   "traditional_3_4",
  "4:3":   "classic_4_3",
  // pass-through if already named
  "social_story_9_16": "social_story_9_16",
  "widescreen_16_9":   "widescreen_16_9",
  "square_1_1":        "square_1_1",
  "traditional_3_4":   "traditional_3_4",
  "classic_4_3":       "classic_4_3",
};

function toImagen4AspectRatio(ar: string): string {
  return ASPECT_RATIO_MAP[ar] ?? "widescreen_16_9";
}

// ── Storage helper ────────────────────────────────────────────────────────────
async function downloadAndStore(url: string, opts: {
  userId: string; projectId: string; assetType: string; filename?: string;
}): Promise<{ url: string; sizeBytes: number }> {
  const res = await safeFetch(url);
  if (!res.ok) throw new Error(`Failed to download generated image: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = path.extname(new URL(url).pathname) || ".png";
  const saved = await saveBuffer(buf, {
    userId: opts.userId,
    projectId: opts.projectId,
    assetType: opts.assetType,
    filename: opts.filename || `${uuid()}${ext}`,
    contentType: res.headers.get("content-type") || undefined,
  });
  return { url: saved.url, sizeBytes: saved.sizeBytes };
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateImage(req: ImageRequest): Promise<ImageResponse> {
  if (DEMO_MODE) {
    return {
      url: "https://placehold.co/1024x576/0a0a0f/e94560?text=Demo+Image",
      width: 1024,
      height: 576,
      ...demoResponse("image", { prompt: req.prompt.slice(0, 80) }),
    };
  }

  const aspect = toImagen4AspectRatio(req.aspectRatio || "16:9");

  // Imagen 4 Ultra parameters
  const body: Record<string, unknown> = {
    prompt:           req.prompt,
    aspect_ratio:     aspect,
    person_generation: "allow_adult",
    safety_settings:  "block_only_high",
    enhance_prompt:   true,
    language:         "en",
    output_options: {
      mime_type:           "image/png",
      compression_quality: 90,
    },
  };

  // Seed for reproducibility when a numeric seed is derivable from filename
  if (req.filename) {
    const numMatch = req.filename.match(/\d+/);
    if (numMatch) {
      const seed = (parseInt(numMatch[0], 10) % 4_294_967_295) || 1;
      body.seed = seed;
    }
  }

  // Note: Imagen 4 does NOT support reference_images, negative_prompt, or
  // num_inference_steps. Those parameters are intentionally dropped here.
  // Character consistency is maintained through the detailed text prompt.
  if (req.negativePrompt) {
    logger.debug("imageProvider: negative_prompt ignored (Imagen 4 not supported)");
  }
  if (req.referenceUrls?.length) {
    logger.debug({ count: req.referenceUrls.length },
      "imageProvider: referenceUrls ignored (Imagen 4 does not support reference_images)");
  }

  const submit = await magnificFetch<Imagen4TaskResponse>(IMAGE_ENDPOINT, {
    method: "POST",
    body,
  });

  let imageUrls: string[] | undefined = submit.data?.generated;
  const taskId = submit.data?.task_id;

  if ((!imageUrls || imageUrls.length === 0) && taskId) {
    const final = await poll<Imagen4TaskResponse>(
      () => magnificFetch<Imagen4TaskResponse>(`${IMAGE_ENDPOINT}/${taskId}`),
      (v) => {
        const s = (v.data?.status || "").toUpperCase();
        if (s === "COMPLETED") return true;
        if (s === "FAILED") throw new MagnificError("Image generation failed", 502, v);
        return Array.isArray(v.data?.generated) && v.data!.generated!.length > 0;
      },
      { intervalMs: 3000, timeoutMs: 5 * 60 * 1000 },
    );
    imageUrls = final.data?.generated;
  }

  const remoteUrl = imageUrls?.[0];
  if (!remoteUrl) {
    throw new MagnificError("Image generator returned no URL", 502, submit);
  }

  if (req.userId && req.projectId) {
    try {
      const stored = await downloadAndStore(remoteUrl, {
        userId: req.userId,
        projectId: req.projectId,
        assetType: req.assetType || "images",
        filename: req.filename,
      });
      return { url: stored.url, raw: { remoteUrl, taskId } };
    } catch (err) {
      logger.warn({ err, remoteUrl }, "Failed to mirror image to local storage; using remote URL");
    }
  }
  return { url: remoteUrl, raw: { taskId } };
}
