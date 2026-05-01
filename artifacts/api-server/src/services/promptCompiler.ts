import db from "../db/index.js";
import { MAGNIFIC_CAPABILITIES } from "../providers/magnificCapabilities.js";

export type ChunkGenerationMode = "standard" | "reference_video";

export interface SceneCtx {
  id: string;
  scene_number: number;
  title: string | null;
  description: string | null;
  shot_type: string | null;
  emotion: string | null;
  duration_seconds: number;
}

export interface ChunkCtx {
  id: string;
  chunk_number: number;
  duration_seconds: number;
  description?: string | null;
}

/**
 * Identity-lock element entry consumed by `compileChunkPrompt`. The compiler
 * emits `@Element1`, `@Element2`, ... in the prompt in the SAME order this
 * array is provided, so the caller is responsible for keeping the matching
 * `elements[]` API payload in sync.
 */
export interface ElementCharacter {
  characterName: string;
  shortDescription?: string;
}

/**
 * Style/appearance reference entry. Emitted as `@Image1`, `@Image2`, ...
 * in the order provided.
 */
export interface ImageRef {
  label: string;
}

export interface CompilerInput {
  projectId: string;
  scene: SceneCtx;
  chunk: ChunkCtx;
  mode: ChunkGenerationMode;
  prevChunkVideoUrl?: string;
  prevChunkEndFrameUrl?: string;
  animeStyle?: string;
  /** Characters to lock via Kling `elements[]` (positional). */
  elementCharacters?: ElementCharacter[];
  /** Style/scene refs to lock via Kling `image_urls[]` (positional). */
  imageRefs?: ImageRef[];
}

export interface CompilerOutput {
  prompt: string;
  negativePrompt: string;
  mode: ChunkGenerationMode;
  characterLockBlock: string;
  environmentLockBlock: string;
  elementBlock: string;
  imageRefBlock: string;
  aspectRatio: string;
  durationSeconds: number;
}

interface CharRow {
  id: string;
  name: string;
  appearance_json: string | null;
}

interface LockRow {
  visual_signature: string | null;
  reference_urls: string | null;
}

const NEGATIVE_BASE =
  "lowres, jpeg artifacts, blurry, deformed faces, watermark, text overlay, captions, off-model character, inconsistent outfit, extra limbs";

function loadCharacterLocks(projectId: string): string {
  const chars = db
    .prepare<[string], CharRow>(
      "SELECT id, name, appearance_json FROM characters WHERE project_id = ?",
    )
    .all(projectId);
  if (chars.length === 0) return "";
  const lines: string[] = [];
  for (const c of chars) {
    const lock = db
      .prepare<[string], LockRow>(
        "SELECT visual_signature, reference_urls FROM character_consistency_locks WHERE character_id = ?",
      )
      .get(c.id);
    const appearance = c.appearance_json ? JSON.parse(c.appearance_json) : {};
    const sig = lock?.visual_signature || "";
    const parts: string[] = [];
    if (appearance.hairColor || appearance.hairStyle)
      parts.push(`hair ${appearance.hairColor || ""} ${appearance.hairStyle || ""}`.trim());
    if (appearance.eyeColor) parts.push(`${appearance.eyeColor} eyes`);
    if (appearance.outfit) parts.push(`outfit: ${appearance.outfit}`);
    if (appearance.distinguishingFeatures) parts.push(appearance.distinguishingFeatures);
    if (sig) parts.push(`locked-signature: ${sig}`);
    lines.push(`- ${c.name}: ${parts.join("; ")}`);
  }
  return `CHARACTER LOCKS (must match exactly across all chunks):\n${lines.join("\n")}`;
}

function loadEnvironmentLocks(projectId: string): string {
  const envs = db
    .prepare<[string], { name: string; description: string | null; lighting_rules: string | null; weather_rules: string | null }>(
      "SELECT name, description, lighting_rules, weather_rules FROM environments WHERE project_id = ?",
    )
    .all(projectId);
  if (envs.length === 0) return "";
  return (
    "ENVIRONMENT LOCKS:\n" +
    envs
      .map(
        (e) =>
          `- ${e.name}: ${e.description || ""}${e.lighting_rules ? ` | lighting: ${e.lighting_rules}` : ""}${e.weather_rules ? ` | weather: ${e.weather_rules}` : ""}`,
      )
      .join("\n")
  );
}

function clipToBudget(prompt: string): string {
  const max = MAGNIFIC_CAPABILITIES.targetPromptChars;
  if (prompt.length <= max) return prompt;
  return prompt.slice(0, max - 3).trimEnd() + "...";
}

function buildElementBlock(elements: ElementCharacter[] | undefined): string {
  if (!elements || elements.length === 0) return "";
  const lines = elements.map((e, i) => {
    const tag = `@Element${i + 1}`;
    const desc = e.shortDescription ? ` — ${e.shortDescription}` : "";
    return `- ${tag} = ${e.characterName}${desc}`;
  });
  return [
    "ELEMENT BINDINGS (identity-locked references):",
    ...lines,
    `Use these tokens in the action. Example: "${elements
      .map((_, i) => `@Element${i + 1}`)
      .join(" and ")} interact naturally and stay on-model."`,
  ].join("\n");
}

function buildImageRefBlock(refs: ImageRef[] | undefined): string {
  if (!refs || refs.length === 0) return "";
  const lines = refs.map((r, i) => `- @Image${i + 1} = ${r.label}`);
  return [
    "STYLE & SCENE REFERENCES:",
    ...lines,
    "Match the framing, color palette and rendering style of these references.",
  ].join("\n");
}

export function compileChunkPrompt(input: CompilerInput): CompilerOutput {
  const characterLockBlock = loadCharacterLocks(input.projectId);
  const environmentLockBlock = loadEnvironmentLocks(input.projectId);
  const elementBlock = buildElementBlock(input.elementCharacters);
  const imageRefBlock = buildImageRefBlock(input.imageRefs);
  const animeStyle = input.animeStyle || "modern cel-shaded anime";
  const sceneSummary = (input.scene.description || input.scene.title || "").trim();
  const shot = input.scene.shot_type || "medium";
  const emotion = input.scene.emotion || "cinematic";

  const continuityLine =
    input.mode === "reference_video"
      ? `Continue the action from ${MAGNIFIC_CAPABILITIES.referenceVideoPromptToken} keeping the SAME characters, costumes, lighting, camera direction and animation cadence. Smoothly evolve the action over the next ${input.chunk.duration_seconds} seconds without resetting the scene.`
      : `Standalone opening chunk: establish the scene with the start frame, evolve naturally toward the end frame over ${input.chunk.duration_seconds} seconds.`;

  const body = [
    `${animeStyle}. ${shot} shot. Mood: ${emotion}.`,
    `SCENE ${input.scene.scene_number} — CHUNK ${input.chunk.chunk_number}`,
    `Action: ${sceneSummary}`,
    continuityLine,
    elementBlock,
    imageRefBlock,
    characterLockBlock,
    environmentLockBlock,
    "Animation: smooth 24fps, sharp linework, vibrant colors, cinematic lighting, dynamic camera, no text or watermark.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = clipToBudget(body);

  return {
    prompt,
    negativePrompt: NEGATIVE_BASE,
    mode: input.mode,
    characterLockBlock,
    environmentLockBlock,
    elementBlock,
    imageRefBlock,
    aspectRatio: "16:9",
    durationSeconds: Math.min(
      input.chunk.duration_seconds || 10,
      MAGNIFIC_CAPABILITIES.outputDurationMaxSeconds,
    ),
  };
}
