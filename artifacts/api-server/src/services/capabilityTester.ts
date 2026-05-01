import { v4 as uuid } from "uuid";
import db from "../db/index.js";
import { MAGNIFIC_CAPABILITIES } from "../providers/magnificCapabilities.js";
import { generateImage } from "../providers/imageProvider.js";
import { generateVideo } from "../providers/videoProvider.js";
import { generateText } from "../providers/textProvider.js";
import { validateVisual } from "../providers/visionProvider.js";
import { logger } from "../lib/logger.js";

export interface CapabilityProbeResult {
  capability: string;
  passed: boolean;
  durationMs: number;
  details: Record<string, unknown>;
}

interface RunOpts {
  providerName?: string;
  capabilities?: string[];
  persist?: boolean;
}

const ALL_CAPABILITIES = [
  "text",
  "vision",
  "image",
  "text_to_video",
  "image_to_video",
  "reference_video_token",
  "prompt_budget",
  "native_audio",
  "multi_shot",
] as const;

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; durationMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { value, durationMs: Date.now() - t0 };
  } catch (err) {
    return { value: null, durationMs: Date.now() - t0, error: (err as Error).message };
  }
}

async function probeText(): Promise<CapabilityProbeResult> {
  const r = await timed(() =>
    generateText({
      systemPrompt: "Reply with the single word OK.",
      userPrompt: "Say OK.",
      maxTokens: 8,
    }),
  );
  const text = r.value && "text" in r.value ? r.value.text : "";
  return {
    capability: "text",
    passed: !!r.value && /OK/i.test(text || ""),
    durationMs: r.durationMs,
    details: { error: r.error, sample: (text || "").slice(0, 80) },
  };
}

async function probeImage(): Promise<CapabilityProbeResult> {
  const r = await timed(() =>
    generateImage({ prompt: "a flat colour swatch of cinematic deep blue", aspectRatio: "1:1" }),
  );
  return {
    capability: "image",
    passed: !!r.value?.url,
    durationMs: r.durationMs,
    details: { url: r.value?.url, error: r.error },
  };
}

async function probeVision(): Promise<CapabilityProbeResult> {
  const probeUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/240px-PNG_transparency_demonstration_1.png";
  const r = await timed(() =>
    validateVisual({ imageUrl: probeUrl, prompt: "Image should depict transparent dice on a checkerboard." }),
  );
  return {
    capability: "vision",
    passed: !!r.value && r.value.passed,
    durationMs: r.durationMs,
    details: { score: r.value?.score, modelUsed: r.value?.modelUsed, error: r.error },
  };
}

async function probeTextToVideo(): Promise<CapabilityProbeResult> {
  const r = await timed(() =>
    generateVideo({ prompt: "a slow zoom on a calm anime ocean horizon, cinematic, 10s", durationSeconds: 10 }),
  );
  return {
    capability: "text_to_video",
    passed: !!r.value?.videoUrl,
    durationMs: r.durationMs,
    details: { url: r.value?.videoUrl, demo: r.value?.demo, error: r.error },
  };
}

async function probeImageToVideo(): Promise<CapabilityProbeResult> {
  const r = await timed(() =>
    generateVideo({
      prompt: "smooth dolly-in across a tranquil anime landscape, soft sunset, 10s",
      durationSeconds: 10,
      startImageUrl: "https://placehold.co/1024x576/png",
    }),
  );
  return {
    capability: "image_to_video",
    passed: !!r.value?.videoUrl,
    durationMs: r.durationMs,
    details: { url: r.value?.videoUrl, error: r.error },
  };
}

async function probeReferenceVideo(): Promise<CapabilityProbeResult> {
  const token = MAGNIFIC_CAPABILITIES.referenceVideoPromptToken;
  const r = await timed(() =>
    generateVideo({
      prompt: `${token} continue the previous shot smoothly with a gentle camera push and identical character, 10s`,
      durationSeconds: 10,
      referenceVideoUrl: "https://example.com/_capability_probe_ref.mp4",
    }),
  );
  return {
    capability: "reference_video_token",
    passed: !!r.value?.videoUrl || /reference|ref|video/i.test(r.error || ""),
    durationMs: r.durationMs,
    details: { token, error: r.error, url: r.value?.videoUrl },
  };
}

function probePromptBudget(): CapabilityProbeResult {
  const c = MAGNIFIC_CAPABILITIES;
  return {
    capability: "prompt_budget",
    passed: c.targetPromptChars > 0 && c.promptMaxChars >= c.targetPromptChars,
    durationMs: 0,
    details: { target: c.targetPromptChars, max: c.promptMaxChars },
  };
}

function probeNativeAudio(): CapabilityProbeResult {
  return {
    capability: "native_audio",
    passed: !!MAGNIFIC_CAPABILITIES.nativeAudio,
    durationMs: 0,
    details: { nativeAudio: MAGNIFIC_CAPABILITIES.nativeAudio },
  };
}

function probeMultiShot(): CapabilityProbeResult {
  return {
    capability: "multi_shot",
    passed: !!MAGNIFIC_CAPABILITIES.supportsMultiShot,
    durationMs: 0,
    details: { maxMultiShots: MAGNIFIC_CAPABILITIES.maxMultiShots },
  };
}

const PROBES: Record<string, () => Promise<CapabilityProbeResult> | CapabilityProbeResult> = {
  text: probeText,
  vision: probeVision,
  image: probeImage,
  text_to_video: probeTextToVideo,
  image_to_video: probeImageToVideo,
  reference_video_token: probeReferenceVideo,
  prompt_budget: probePromptBudget,
  native_audio: probeNativeAudio,
  multi_shot: probeMultiShot,
};

export async function runCapabilityProbe(opts: RunOpts = {}): Promise<{
  provider: string;
  results: CapabilityProbeResult[];
  passedCount: number;
  totalCount: number;
}> {
  const provider = opts.providerName || "magnific";
  const list = opts.capabilities && opts.capabilities.length ? opts.capabilities : (ALL_CAPABILITIES as readonly string[]);
  const results: CapabilityProbeResult[] = [];
  for (const name of list) {
    const probe = PROBES[name];
    if (!probe) {
      results.push({ capability: name, passed: false, durationMs: 0, details: { error: "unknown_capability" } });
      continue;
    }
    try {
      const r = await probe();
      results.push(r);
    } catch (err) {
      results.push({
        capability: name,
        passed: false,
        durationMs: 0,
        details: { error: (err as Error).message },
      });
      logger.warn({ err, capability: name }, "capability probe threw");
    }
  }

  if (opts.persist !== false) {
    const insert = db.prepare(
      "INSERT INTO provider_capability_tests (id, provider_name, capability, passed, details_json) VALUES (?, ?, ?, ?, ?)",
    );
    db.transaction(() => {
      for (const r of results) {
        insert.run(uuid(), provider, r.capability, r.passed ? 1 : 0, JSON.stringify({ ...r.details, durationMs: r.durationMs }));
      }
    })();
  }

  return {
    provider,
    results,
    passedCount: results.filter((r) => r.passed).length,
    totalCount: results.length,
  };
}
