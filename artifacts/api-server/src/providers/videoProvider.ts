import path from "node:path";
import { v4 as uuid } from "uuid";
import { MAGNIFIC_CAPABILITIES } from "./magnificCapabilities.js";
import { DEMO_MODE, demoResponse } from "./registry.js";
import { magnificFetch, MagnificError, poll } from "./magnificClient.js";
import { saveBuffer } from "./storageProvider.js";
import { logger } from "../lib/logger.js";
import { safeFetch } from "../lib/safeFetch.js";

export interface VideoTask {
  prompt: string;
  negativePrompt?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  cfgScale?: number;
  startImageUrl?: string;
  endImageUrl?: string;
  referenceVideoUrl?: string;
  webhookUrl?: string;
  elements?: string[];
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

export function buildStandardVideoPayload(task: VideoTask): Record<string, unknown> {
  assertPromptLimit(task.prompt);
  const body: Record<string, unknown> = {
    prompt: task.prompt,
    negative_prompt: task.negativePrompt,
    duration: String(task.durationSeconds || MAGNIFIC_CAPABILITIES.outputDurationSeconds),
    aspect_ratio: task.aspectRatio || "16:9",
    cfg_scale: task.cfgScale ?? MAGNIFIC_CAPABILITIES.cfgScaleDefault,
  };
  if (task.startImageUrl) body.image_url = task.startImageUrl;
  if (task.endImageUrl) body.end_image_url = task.endImageUrl;
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
    negative_prompt: task.negativePrompt,
    duration: String(task.durationSeconds || MAGNIFIC_CAPABILITIES.outputDurationSeconds),
    aspect_ratio: task.aspectRatio || "16:9",
    cfg_scale: task.cfgScale ?? MAGNIFIC_CAPABILITIES.cfgScaleDefault,
  };
  if (task.startImageUrl) body.image_url = task.startImageUrl;
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
