import path from "node:path";
import { v4 as uuid } from "uuid";
import { DEMO_MODE, demoResponse } from "./registry.js";
import { magnificFetch, MagnificError, poll } from "./magnificClient.js";
import { saveBuffer } from "./storageProvider.js";
import { logger } from "../lib/logger.js";
import { safeFetch } from "../lib/safeFetch.js";

// Per-endpoint cooldown registry. When a Magnific image endpoint returns 429
// (daily quota exhausted) we stop hammering it for the rest of the process
// lifetime (or 1h, whichever ends first) and try the next endpoint in the
// fallback chain. This prevents the entire visualization stage from failing
// dozens of times per scene when an upstream quota is exhausted.
const endpointCooldownUntil = new Map<string, number>();
function endpointInCooldown(endpoint: string): boolean {
  const until = endpointCooldownUntil.get(endpoint) || 0;
  return Date.now() < until;
}
function tripEndpointCooldown(endpoint: string, reason: string): void {
  const until = Date.now() + 60 * 60 * 1000; // 1h
  endpointCooldownUntil.set(endpoint, until);
  logger.warn({ endpoint, reason, until: new Date(until).toISOString() },
    "image endpoint cooldown engaged — falling back to next provider");
}

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  referenceUrls?: string[];
  aspectRatio?: string;
  model?: string;
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

interface MagnificTaskResponse {
  data?: {
    task_id?: string;
    status?: string;
    generated?: string[];
  };
}

// Two endpoints used in tandem for best quality + consistency:
//   - Imagen 4 Ultra: highest visual fidelity, text-only (no reference support).
//     Used for the master "full body reference" image of each character.
//   - Nano Banana Pro: supports reference_images for consistency. Used for the
//     3 angle views (front/¾/back) and any downstream image (storyboard
//     panels, scene start/end frames) that needs to match an existing design.
const IMAGEN4_ENDPOINT =
  process.env.MAGNIFIC_IMAGE_ENDPOINT || "/v1/ai/text-to-image/imagen4-ultra";
const NANO_BANANA_ENDPOINT =
  process.env.MAGNIFIC_IMAGE_REFERENCE_ENDPOINT || "/v1/ai/text-to-image/nano-banana-pro";
// Tier-3 fallback when both Imagen 4 and Nano Banana Pro hit their daily
// quota. Seedream V4 is on a separate Magnific quota bucket so it usually
// stays available even when the others are exhausted. Configurable via env
// for accounts with different model entitlements.
const SEEDREAM_ENDPOINT =
  process.env.MAGNIFIC_IMAGE_FALLBACK2_ENDPOINT || "/v1/ai/text-to-image/seedream-v4";

// ── Aspect-ratio mapping ──────────────────────────────────────────────────
// Imagen 4 uses named string aspect ratios; nano-banana accepts the short form.
const IMAGEN4_ASPECT_MAP: Record<string, string> = {
  "9:16":  "social_story_9_16",
  "16:9":  "widescreen_16_9",
  "1:1":   "square_1_1",
  "3:4":   "traditional_3_4",
  "4:3":   "classic_4_3",
  "social_story_9_16": "social_story_9_16",
  "widescreen_16_9":   "widescreen_16_9",
  "square_1_1":        "square_1_1",
  "traditional_3_4":   "traditional_3_4",
  "classic_4_3":       "classic_4_3",
};

function toImagen4AspectRatio(ar: string): string {
  return IMAGEN4_ASPECT_MAP[ar] ?? "widescreen_16_9";
}

// ── Reference image helpers (nano-banana expects base64, not URLs) ────────
interface RefEntry { image: string; mime_type: string }

const REF_CACHE_MAX = 64;
const REF_CACHE_TTL_MS = 10 * 60 * 1000;
const refCache = new Map<string, { entry: RefEntry; expiresAt: number }>();

function refCacheGet(url: string): RefEntry | undefined {
  const hit = refCache.get(url);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    refCache.delete(url);
    return undefined;
  }
  refCache.delete(url);
  refCache.set(url, hit);
  return hit.entry;
}

function refCacheSet(url: string, entry: RefEntry): void {
  if (refCache.size >= REF_CACHE_MAX) {
    const oldestKey = refCache.keys().next().value;
    if (oldestKey !== undefined) refCache.delete(oldestKey);
  }
  refCache.set(url, { entry, expiresAt: Date.now() + REF_CACHE_TTL_MS });
}

function inferMimeType(headerCT: string | null, url: string): string {
  const ct = (headerCT || "").split(";")[0].trim().toLowerCase();
  if (ct.startsWith("image/")) return ct;
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

async function buildReferenceImages(urls: string[]): Promise<RefEntry[]> {
  const out: RefEntry[] = [];
  for (const url of urls) {
    const cached = refCacheGet(url);
    if (cached) { out.push(cached); continue; }
    try {
      const res = await safeFetch(url);
      if (!res.ok) {
        logger.warn({ url, status: res.status }, "buildReferenceImages: skip bad ref");
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const entry: RefEntry = {
        image: buf.toString("base64"),
        mime_type: inferMimeType(res.headers.get("content-type"), url),
      };
      refCacheSet(url, entry);
      out.push(entry);
    } catch (err) {
      logger.warn({ err, url }, "buildReferenceImages: skip ref (fetch failed)");
    }
  }
  return out;
}

// ── Storage helper ────────────────────────────────────────────────────────
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

// ── Main export ───────────────────────────────────────────────────────────
export async function generateImage(req: ImageRequest): Promise<ImageResponse> {
  if (DEMO_MODE) {
    return {
      url: "https://placehold.co/1024x576/0a0a0f/e94560?text=Demo+Image",
      width: 1024,
      height: 576,
      ...demoResponse("image", { prompt: req.prompt.slice(0, 80) }),
    };
  }

  const aspectShort = req.aspectRatio || "16:9";
  const wantsRefs = !!req.referenceUrls?.length;

  // Pre-encode refs once (only used by nano-banana). If none can be encoded
  // we still try nano-banana for quality, but log it.
  const encodedRefs = wantsRefs ? await buildReferenceImages(req.referenceUrls!) : [];

  // Build body for a given endpoint. Nano-banana takes refs + short aspect;
  // Imagen 4 / Seedream V4 take the named aspect map. Seedream V4 also
  // supports the same prompt+aspect contract as Imagen 4 on Magnific.
  function bodyFor(endpoint: string): Record<string, unknown> {
    if (endpoint === NANO_BANANA_ENDPOINT) {
      const b: Record<string, unknown> = { prompt: req.prompt, aspect_ratio: aspectShort };
      if (req.negativePrompt) b.negative_prompt = req.negativePrompt;
      if (req.numInferenceSteps) b.num_inference_steps = req.numInferenceSteps;
      if (encodedRefs.length > 0) b.reference_images = encodedRefs;
      return b;
    }
    // Imagen 4 / Seedream V4 share the Magnific text-to-image schema.
    const b: Record<string, unknown> = {
      prompt:           req.prompt,
      aspect_ratio:     toImagen4AspectRatio(aspectShort),
      person_generation: "allow_adult",
      safety_settings:  "block_only_high",
      enhance_prompt:   true,
      language:         "en",
      output_options: { mime_type: "image/png", compression_quality: 90 },
    };
    if (req.filename) {
      const numMatch = req.filename.match(/\d+/);
      if (numMatch) {
        const seed = (parseInt(numMatch[0], 10) % 4_294_967_295) || 1;
        b.seed = seed;
      }
    }
    return b;
  }

  // Build the fallback chain. When refs are wanted we prefer nano-banana
  // (only model that supports reference_images) but fall through to text-
  // only models if it's quota-throttled. When no refs, prefer Imagen 4
  // Ultra for top quality, then Seedream V4 as a separate-quota backup.
  const fullChain = wantsRefs
    ? [NANO_BANANA_ENDPOINT, IMAGEN4_ENDPOINT, SEEDREAM_ENDPOINT]
    : [IMAGEN4_ENDPOINT, SEEDREAM_ENDPOINT];
  const chain = fullChain.filter((e) => !endpointInCooldown(e));
  if (chain.length === 0) {
    // Every endpoint is in cooldown — try the full chain anyway, the user
    // may have refilled quota since the cooldown was set.
    chain.push(...fullChain);
  }
  if (wantsRefs && chain[0] !== NANO_BANANA_ENDPOINT && encodedRefs.length > 0) {
    logger.warn({ chain }, "imageProvider: nano-banana cooled down; refs will be dropped for this image");
  }

  let submit: MagnificTaskResponse | undefined;
  let submitEndpoint: string | undefined;
  let lastError: unknown;
  for (const endpoint of chain) {
    try {
      submit = await magnificFetch<MagnificTaskResponse>(endpoint, {
        method: "POST",
        body: bodyFor(endpoint),
      });
      submitEndpoint = endpoint;
      break;
    } catch (err) {
      lastError = err;
      const is429 = err instanceof MagnificError && err.statusCode === 429;
      if (is429) {
        tripEndpointCooldown(endpoint, `429 from ${endpoint}`);
        continue; // try next tier
      }
      // Non-quota error — bubble up immediately.
      throw err;
    }
  }
  if (!submit || !submitEndpoint) {
    throw lastError instanceof Error
      ? lastError
      : new MagnificError("All image endpoints in cooldown", 503, lastError);
  }

  let imageUrls: string[] | undefined = submit.data?.generated;
  const taskId = submit.data?.task_id;

  if ((!imageUrls || imageUrls.length === 0) && taskId) {
    // Poll on the SAME endpoint we submitted to — task_ids are
    // endpoint-scoped, so polling a different cluster would 404.
    const pollEndpoint = submitEndpoint;
    const final = await poll<MagnificTaskResponse>(
      () => magnificFetch<MagnificTaskResponse>(`${pollEndpoint}/${taskId}`),
      (v) => {
        const s = (v.data?.status || "").toUpperCase();
        if (s === "COMPLETED") return true;
        if (s === "FAILED") throw new MagnificError("Image generation failed", 502, v);
        return Array.isArray(v.data?.generated) && v.data!.generated!.length > 0;
      },
      { intervalMs: 2500, timeoutMs: 5 * 60 * 1000 },
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
      return { url: stored.url, raw: { remoteUrl, taskId, endpoint: submitEndpoint } };
    } catch (err) {
      logger.warn({ err, remoteUrl }, "Failed to mirror image to local storage; using remote URL");
    }
  }
  return { url: remoteUrl, raw: { taskId, endpoint: submitEndpoint } };
}
