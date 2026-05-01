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
  if (req.referenceUrls && req.referenceUrls.length > 0) body.reference_images = req.referenceUrls;

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
