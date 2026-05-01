import path from "node:path";
import { v4 as uuid } from "uuid";
import { MAGNIFIC_CAPABILITIES } from "./magnificCapabilities.js";
import { DEMO_MODE, demoResponse } from "./registry.js";
import { magnificFetch, MagnificError, poll } from "./magnificClient.js";
import { saveBuffer } from "./storageProvider.js";
import { logger } from "../lib/logger.js";
import { safeFetch } from "../lib/safeFetch.js";

/**
 * Element entry as accepted by the Kling-v3-Omni-Pro `elements[]` body field.
 * Each element supplies one or more reference images for identity / style
 * consistency and is referenced inside the prompt as `@Element1`, `@Element2`,
 * ... in the order it appears in the array.
 */
export interface VideoElement {
  /** Up to several reference images that lock identity (e.g. character turns). */
  reference_image_urls: string[];
  /** Optional dedicated frontal image. */
  frontal_image_url?: string;
}

export interface VideoTask {
  prompt: string;
  /**
   * Multi-shot mode (Omni Pro): one prompt per shot, max 6, total duration
   * across all shots <= 15s. When provided, `prompt` is ignored by the API.
   */
  multiPrompt?: string[];
  /** Always "customize" for Omni endpoints today. */
  shotType?: "customize";
  durationSeconds?: number;
  aspectRatio?: string;

  /**
   * Image-to-video. EITHER use `startImageUrl` alone for a "first frame" hint,
   * OR pair `startImageUrl` + `endImageUrl` for first+last frame guidance, OR
   * pass `imageUrl` as the start frame in older single-image mode.
   */
  imageUrl?: string;
  startImageUrl?: string;
  endImageUrl?: string;

  /** Style/appearance reference images, referenced as @Image1..@Image4. */
  imageUrls?: string[];
  /** Identity-lock elements, referenced as @Element1..@ElementN. */
  elements?: VideoElement[];

  /** Reference-to-video continuity (separate endpoint). */
  referenceVideoUrl?: string;

  /** Native audio generation by Kling itself (lip-sync / dialogue). */
  generateAudio?: boolean;

  webhookUrl?: string;
  userId?: string;
  projectId?: string;
  chunkId?: string;
}

export interface VideoResponse {
  jobId?: string;
  videoUrl?: string;
  status: string;
  visibleEngine: string;
  hiddenModel?: string;
  demo?: boolean;
  raw?: unknown;
}

interface VideoTaskResponse {
  data?: {
    task_id?: string;
    status?: string;
    generated?: string[];
    video_url?: string;
  };
}

export function assertPromptLimit(prompt: string): void {
  if ((prompt || "").length > MAGNIFIC_CAPABILITIES.promptMaxChars) {
    throw new Error(`Prompt exceeds ${MAGNIFIC_CAPABILITIES.promptMaxChars} chars`);
  }
}

function clampDuration(secs: number | undefined): string {
  const v = Math.max(
    MAGNIFIC_CAPABILITIES.outputDurationMinSeconds,
    Math.min(MAGNIFIC_CAPABILITIES.outputDurationMaxSeconds, secs || MAGNIFIC_CAPABILITIES.outputDurationSeconds),
  );
  return String(Math.round(v));
}

function aspectOrDefault(value: string | undefined): string {
  const allowed = MAGNIFIC_CAPABILITIES.aspectRatios as readonly string[];
  return value && allowed.includes(value) ? value : "16:9";
}

function applyImageRefBudget(
  imageUrls: string[] | undefined,
  elements: VideoElement[] | undefined,
): { image_urls?: string[]; elements?: VideoElement[] } {
  const budget = MAGNIFIC_CAPABILITIES.maxImageAndElementRefs;
  const els = (elements || []).filter((e) => e && (e.reference_image_urls?.length || e.frontal_image_url));
  const remaining = Math.max(0, budget - els.length);
  const imgs = (imageUrls || []).filter((u) => typeof u === "string" && u.length > 0).slice(0, remaining);
  const out: { image_urls?: string[]; elements?: VideoElement[] } = {};
  if (imgs.length) out.image_urls = imgs;
  if (els.length) out.elements = els.slice(0, budget);
  return out;
}

export function buildStandardVideoPayload(task: VideoTask): Record<string, unknown> {
  // For multi-shot, the API uses `multi_prompt` (plus optional `prompt` skipped)
  // and we still validate per-shot length against the global cap.
  if (task.multiPrompt && task.multiPrompt.length) {
    if (task.multiPrompt.length > MAGNIFIC_CAPABILITIES.maxMultiShots) {
      throw new Error(
        `multiPrompt accepts at most ${MAGNIFIC_CAPABILITIES.maxMultiShots} shots`,
      );
    }
    for (const p of task.multiPrompt) assertPromptLimit(p);
  } else {
    assertPromptLimit(task.prompt);
  }

  const body: Record<string, unknown> = {
    aspect_ratio: aspectOrDefault(task.aspectRatio),
    duration: clampDuration(task.durationSeconds),
  };

  if (task.multiPrompt && task.multiPrompt.length) {
    body.multi_prompt = task.multiPrompt;
    body.shot_type = task.shotType || "customize";
  } else if (task.prompt) {
    body.prompt = task.prompt;
  }

  // Image-to-video conditioning. Prefer the explicit start/end pair when both
  // are provided; otherwise fall back to a single `image_url`.
  if (task.startImageUrl && task.endImageUrl) {
    body.start_image_url = task.startImageUrl;
    body.end_image_url = task.endImageUrl;
  } else if (task.startImageUrl) {
    body.image_url = task.startImageUrl;
    if (task.endImageUrl) body.end_image_url = task.endImageUrl;
  } else if (task.imageUrl) {
    body.image_url = task.imageUrl;
    if (task.endImageUrl) body.end_image_url = task.endImageUrl;
  }

  Object.assign(body, applyImageRefBudget(task.imageUrls, task.elements));

  if (task.generateAudio) body.generate_audio = true;
  if (task.webhookUrl) body.webhook_url = task.webhookUrl;
  return body;
}

export function buildReferenceVideoPayload(task: VideoTask): Record<string, unknown> {
  assertPromptLimit(task.prompt);
  if (!task.referenceVideoUrl) {
    throw new Error("referenceVideoUrl is required for reference-to-video mode");
  }
  if (!task.prompt.includes(MAGNIFIC_CAPABILITIES.referenceVideoPromptToken)) {
    throw new Error(
      `Reference-video prompt must include ${MAGNIFIC_CAPABILITIES.referenceVideoPromptToken}`,
    );
  }
  const body: Record<string, unknown> = {
    video_url: task.referenceVideoUrl,
    prompt: task.prompt,
    aspect_ratio: aspectOrDefault(task.aspectRatio),
    duration: clampDuration(task.durationSeconds),
  };
  if (task.startImageUrl) body.image_url = task.startImageUrl;
  // End-frame is NOT supported alongside a reference video per docs.
  Object.assign(body, applyImageRefBudget(task.imageUrls, task.elements));
  if (task.generateAudio) body.generate_audio = true;
  if (task.webhookUrl) body.webhook_url = task.webhookUrl;
  return body;
}

async function downloadAndStoreVideo(url: string, opts: {
  userId: string; projectId: string; chunkId?: string;
}): Promise<string> {
  const res = await safeFetch(url);
  if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = path.extname(new URL(url).pathname) || ".mp4";
  const filename = `${opts.chunkId || uuid()}${ext}`;
  const saved = await saveBuffer(buf, {
    userId: opts.userId,
    projectId: opts.projectId,
    assetType: "videos",
    filename,
    contentType: res.headers.get("content-type") || "video/mp4",
  });
  return saved.url;
}

export async function generateVideo(task: VideoTask): Promise<VideoResponse> {
  const isReference = !!task.referenceVideoUrl;
  if (DEMO_MODE) {
    return {
      videoUrl: "https://placehold.co/1280x720/0a0a0f/16a085?text=Demo+Video+Chunk",
      status: "completed",
      visibleEngine: MAGNIFIC_CAPABILITIES.visibleModelName,
      ...demoResponse("video", {
        mode: isReference ? "reference_video" : "standard",
      }),
    };
  }
  const endpoint = isReference
    ? MAGNIFIC_CAPABILITIES.referenceVideoEndpoint
    : MAGNIFIC_CAPABILITIES.standardVideoEndpoint;
  const body = isReference
    ? buildReferenceVideoPayload(task)
    : buildStandardVideoPayload(task);

  const submit = await magnificFetch<VideoTaskResponse>(endpoint, { method: "POST", body });
  const taskId = submit.data?.task_id;

  let videoUrl: string | undefined =
    submit.data?.video_url || submit.data?.generated?.[0];

  if (!videoUrl && taskId) {
    const final = await poll<VideoTaskResponse>(
      () => magnificFetch<VideoTaskResponse>(`${endpoint}/${taskId}`),
      (v) => {
        const s = (v.data?.status || "").toUpperCase();
        if (s === "COMPLETED") return true;
        if (s === "FAILED") throw new MagnificError("Video generation failed", 502, v);
        return !!(v.data?.video_url || (v.data?.generated && v.data.generated.length > 0));
      },
      { intervalMs: 8000, timeoutMs: 15 * 60 * 1000 },
    );
    videoUrl = final.data?.video_url || final.data?.generated?.[0];
  }

  if (!videoUrl) {
    return {
      jobId: taskId,
      status: "queued",
      visibleEngine: MAGNIFIC_CAPABILITIES.visibleModelName,
      hiddenModel: MAGNIFIC_CAPABILITIES.hiddenModelId,
      raw: submit,
    };
  }

  let finalUrl = videoUrl;
  if (task.userId && task.projectId) {
    try {
      finalUrl = await downloadAndStoreVideo(videoUrl, {
        userId: task.userId,
        projectId: task.projectId,
        chunkId: task.chunkId,
      });
    } catch (err) {
      logger.warn({ err, videoUrl }, "Failed to mirror video to local storage; using remote URL");
    }
  }

  return {
    jobId: taskId,
    videoUrl: finalUrl,
    status: "completed",
    visibleEngine: MAGNIFIC_CAPABILITIES.visibleModelName,
    hiddenModel: MAGNIFIC_CAPABILITIES.hiddenModelId,
    raw: submit,
  };
}
