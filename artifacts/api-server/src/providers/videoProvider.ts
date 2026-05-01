import { MAGNIFIC_CAPABILITIES } from "./magnificCapabilities.js";
import { DEMO_MODE, demoResponse, getActiveKey, notConfiguredError } from "./registry.js";

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
  const key = getActiveKey("magnific");
  if (!key) {
    throw Object.assign(new Error("Video provider not configured"), {
      response: notConfiguredError("magnific", isReference ? "reference_to_video" : "text_to_video"),
      statusCode: 503,
    });
  }
  return {
    status: "queued",
    visibleEngine: MAGNIFIC_CAPABILITIES.visibleModelName,
    hiddenModel: MAGNIFIC_CAPABILITIES.hiddenModelId,
    raw: { stub: true, payload: isReference ? buildReferenceVideoPayload(task) : buildStandardVideoPayload(task) },
  };
}
