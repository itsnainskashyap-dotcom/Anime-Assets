import path from "node:path";
import { v4 as uuid } from "uuid";
import { DEMO_MODE, demoResponse } from "./registry.js";
import { magnificFetch, MagnificError, poll } from "./magnificClient.js";
import { saveBuffer } from "./storageProvider.js";
import { logger } from "../lib/logger.js";
import { safeFetch } from "../lib/safeFetch.js";

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  referenceUrls?: string[];
  aspectRatio?: string;
  model?: string;
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

interface FreepikImageTaskResponse {
  data?: {
    task_id?: string;
    status?: string;
    generated?: string[];
  };
}

const IMAGE_ENDPOINT = process.env.MAGNIFIC_IMAGE_ENDPOINT || "/v1/ai/text-to-image/nano-banana-pro";

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

/**
 * Freepik nano-banana-pro expects each `reference_images` entry to be an
 * object containing a base64-encoded image (not a bare URL string), e.g.
 * `{ image: "<base64>" }`. Download each URL via safeFetch (which guards
 * against SSRF) and convert to base64.
 *
 * The same character/anchor URLs are reused across many image requests
 * (5 wave-2 calls per scene × 29 scenes ≈ 145 fetches of the same anchor
 * frame). To avoid redundant downloads/encoding (and the memory pressure
 * of holding multiple multi-MB base64 strings in flight), cache encoded
 * results in a small TTL+LRU map keyed by URL.
 */
interface RefEntry { image: string; mime_type: string }

const REF_CACHE_MAX = 64;
const REF_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const refCache = new Map<string, { entry: RefEntry; expiresAt: number }>();

function refCacheGet(url: string): RefEntry | undefined {
  const hit = refCache.get(url);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    refCache.delete(url);
    return undefined;
  }
  // LRU touch: re-insert to mark as most recent
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

/** Infer a safe image MIME type from a Content-Type header or URL extension. */
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
    if (cached) {
      out.push(cached);
      continue;
    }
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

export async function generateImage(req: ImageRequest): Promise<ImageResponse> {
  if (DEMO_MODE) {
    return {
      url: "https://placehold.co/1024x576/0a0a0f/e94560?text=Demo+Image",
      width: 1024,
      height: 576,
      ...demoResponse("image", { prompt: req.prompt.slice(0, 80) }),
    };
  }

  const aspect = req.aspectRatio || "16:9";
  const body: Record<string, unknown> = {
    prompt: req.prompt,
    aspect_ratio: aspect,
  };
  if (req.negativePrompt) body.negative_prompt = req.negativePrompt;
  if (req.referenceUrls && req.referenceUrls.length > 0) {
    const refs = await buildReferenceImages(req.referenceUrls);
    if (refs.length > 0) body.reference_images = refs;
  }

  const submit = await magnificFetch<FreepikImageTaskResponse>(IMAGE_ENDPOINT, {
    method: "POST",
    body,
  });

  let imageUrls: string[] | undefined = submit.data?.generated;
  const taskId = submit.data?.task_id;

  if ((!imageUrls || imageUrls.length === 0) && taskId) {
    // Poll for completion.
    const final = await poll<FreepikImageTaskResponse>(
      () => magnificFetch<FreepikImageTaskResponse>(`${IMAGE_ENDPOINT}/${taskId}`),
      (v) => {
        const s = (v.data?.status || "").toUpperCase();
        if (s === "COMPLETED") return true;
        if (s === "FAILED") throw new MagnificError("Image generation failed", 502, v);
        return Array.isArray(v.data?.generated) && v.data!.generated!.length > 0;
      },
      { intervalMs: 4000, timeoutMs: 5 * 60 * 1000 },
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
