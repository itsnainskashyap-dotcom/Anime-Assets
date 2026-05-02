import db from "../db/index.js";
import { generateImage } from "../providers/imageProvider.js";
import { generateJson } from "../providers/textProvider.js";
import { logger } from "../lib/logger.js";
import { recordPlaygroundEvent, recordAgentLog } from "./playgroundEvents.js";

/**
 * One panel of a chunk's storyboard. The Storyboard Composer plans 6–12 of
 * these per 10-second video chunk and then renders them as a single composite
 * image (numbered grid) which is later passed to Kling-Omni-Pro as a reference
 * image so the generated video respects the planned shot composition.
 */
export interface StoryboardShot {
  panel: number;
  shotType: string;
  cameraAngle: string;
  description: string;
  characterAction?: string;
  emotion?: string;
  approxDurationSeconds?: number;
}

export interface StoryboardPlan {
  shotCount: number;
  shots: StoryboardShot[];
  visualPacing: "slow" | "medium" | "fast";
  notes?: string;
}

export interface StoryboardResult {
  imageUrl: string;
  shotCount: number;
  plan: StoryboardPlan;
  prompt: string;
  generationModel: string;
  generationTimeMs: number;
}

interface ChunkContext {
  chunkId: string;
  chunkNumber: number;
  durationSeconds: number;
  projectId: string;
  userId: string;
  sceneId: string | null;
  sceneNumber: number | null;
  sceneTitle: string | null;
  sceneDescription: string | null;
  sceneEmotion: string | null;
  sceneShotType: string | null;
  chunkPromptText: string | null;
  startFrameUrl: string | null;
  endFrameUrl: string | null;
  characterRefs: string[];
  characterNames: string[];
  animeStyle: string;
}

/** Pull everything the composer needs in one query so the handler stays thin. */
export function loadChunkContext(chunkId: string): ChunkContext | null {
  const row = db
    .prepare<
      [string],
      {
        id: string;
        chunk_number: number;
        duration_seconds: number;
        project_id: string;
        scene_id: string | null;
        prompt_text: string | null;
        start_frame_image_url: string | null;
        end_frame_image_url: string | null;
        scene_number: number | null;
        scene_title: string | null;
        scene_description: string | null;
        scene_emotion: string | null;
        scene_shot_type: string | null;
        project_user_id: string | null;
        project_genre: string | null;
      }
    >(
      `SELECT vc.id, vc.chunk_number, vc.duration_seconds, vc.project_id, vc.scene_id,
              vc.prompt_text, vc.start_frame_image_url, vc.end_frame_image_url,
              s.scene_number AS scene_number, s.title AS scene_title,
              s.description AS scene_description, s.emotion AS scene_emotion,
              s.shot_type AS scene_shot_type,
              p.user_id AS project_user_id, p.genre AS project_genre
       FROM video_chunks vc
       LEFT JOIN scenes s ON s.id = vc.scene_id
       LEFT JOIN projects p ON p.id = vc.project_id
       WHERE vc.id = ?`,
    )
    .get(chunkId);
  if (!row || !row.project_user_id) return null;

  // Character refs (front model sheet preferred, fallback portrait). Cap at 3
  // so we leave room in the image-gen reference budget for the start_frame.
  const chars = db
    .prepare<
      [string],
      {
        name: string;
        portrait_url: string | null;
        model_sheet_front_url: string | null;
      }
    >(
      `SELECT name, portrait_url, model_sheet_front_url
       FROM characters
       WHERE project_id = ?
       ORDER BY CASE WHEN LOWER(COALESCE(role,'')) IN ('lead','protagonist','main') THEN 0 ELSE 1 END, name ASC
       LIMIT 3`,
    )
    .all(row.project_id);

  const characterRefs = chars
    .map((c) => c.model_sheet_front_url || c.portrait_url)
    .filter((u): u is string => !!u);
  const characterNames = chars.map((c) => c.name);

  return {
    chunkId: row.id,
    chunkNumber: row.chunk_number,
    durationSeconds: row.duration_seconds || 10,
    projectId: row.project_id,
    userId: row.project_user_id,
    sceneId: row.scene_id,
    sceneNumber: row.scene_number,
    sceneTitle: row.scene_title,
    sceneDescription: row.scene_description,
    sceneEmotion: row.scene_emotion,
    sceneShotType: row.scene_shot_type,
    chunkPromptText: row.prompt_text,
    startFrameUrl: row.start_frame_image_url,
    endFrameUrl: row.end_frame_image_url,
    characterRefs,
    characterNames,
    animeStyle: row.project_genre || "modern anime",
  };
}

function toAbsoluteUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  if (u.startsWith("http")) return u;
  const publicBase = process.env.PUBLIC_BASE_URL || "";
  if (u.startsWith("/storage/")) return publicBase ? `${publicBase}${u}` : null;
  return null;
}

/** Pick a tidy grid size for the composite image given the shot count. */
function gridForShots(n: number): { cols: number; rows: number } {
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 8) return { cols: 4, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  if (n <= 12) return { cols: 4, rows: 3 };
  return { cols: 4, rows: 4 };
}

/**
 * Ask Claude to break a 10s chunk into a numbered list of 6–12 cinematic shots
 * (composition, camera angle, action). The plan is the source of truth used by
 * BOTH the storyboard image renderer AND the downstream video prompt.
 */
async function planChunkShots(ctx: ChunkContext): Promise<StoryboardPlan> {
  const sceneSummary = (
    ctx.sceneDescription ||
    ctx.sceneTitle ||
    ctx.chunkPromptText ||
    "An anime cinematic moment."
  ).trim();
  const charsLine = ctx.characterNames.length
    ? `Characters present (use these names): ${ctx.characterNames.join(", ")}.`
    : "No named characters – treat figures generically.";

  const { data } = await generateJson<StoryboardPlan>({
    systemPrompt:
      "You are a senior anime storyboard artist. You break a 10-second video beat into a tight, screen-readable storyboard of 6 to 12 numbered panels. Output strict JSON only.",
    userPrompt: `Plan a single-image storyboard for ONE 10-second anime video chunk.

CONTEXT
- Anime style: ${ctx.animeStyle}
- Scene ${ctx.sceneNumber ?? "?"} — ${ctx.sceneTitle ?? "(untitled)"}
- Mood/emotion: ${ctx.sceneEmotion || "cinematic"}
- Default scene shot type: ${ctx.sceneShotType || "medium"}
- Chunk duration: ${ctx.durationSeconds} seconds (chunk #${ctx.chunkNumber})
- ${charsLine}

SCENE SUMMARY
"""
${sceneSummary}
"""

REQUIREMENTS
- Pick a shotCount between 6 and 12 based on visualPacing:
    slow → 6   |   medium → 8   |   fast → 10–12
- Each panel must describe ONE clear cinematic moment that could be drawn as a
  single anime frame: composition, camera angle, character action, emotion.
- Panels MUST be in chronological order (panel 1 = first beat, panel N = last).
- approxDurationSeconds across all panels should sum to roughly ${ctx.durationSeconds}.
- shotType examples: extreme close-up, close-up, medium close-up, medium,
  medium wide, wide, extreme wide, over-the-shoulder, POV, insert.
- cameraAngle examples: eye-level, low angle, high angle, dutch tilt, top-down,
  worm's-eye, profile, three-quarter.
- Keep each "description" under 140 characters so it remains readable inside a
  small storyboard panel caption.

OUTPUT JSON SCHEMA
{
  "shotCount": number,
  "visualPacing": "slow" | "medium" | "fast",
  "notes": string,
  "shots": [
    {
      "panel": number,
      "shotType": string,
      "cameraAngle": string,
      "description": string,
      "characterAction": string,
      "emotion": string,
      "approxDurationSeconds": number
    }
  ]
}`,
    maxTokens: 4096,
  });

  const shots = Array.isArray(data?.shots) ? data.shots : [];
  if (shots.length < 6 || shots.length > 12) {
    // Defensive clamp: if Claude returned out-of-range, normalize to 8.
    const clamped = shots.slice(0, 12);
    while (clamped.length < 6 && shots.length > 0) {
      clamped.push(shots[shots.length - 1]);
    }
    if (clamped.length < 6) {
      throw new Error(
        `Storyboard planner returned ${shots.length} shots; expected 6–12`,
      );
    }
    return {
      shotCount: clamped.length,
      shots: clamped.map((s, i) => ({ ...s, panel: i + 1 })),
      visualPacing: data?.visualPacing || "medium",
      notes: data?.notes,
    };
  }
  return {
    shotCount: shots.length,
    shots: shots.map((s, i) => ({ ...s, panel: i + 1 })),
    visualPacing: data?.visualPacing || "medium",
    notes: data?.notes,
  };
}

/**
 * Render the planned shot list as ONE composite anime storyboard image
 * (numbered grid, "STORYBOARD" title) using the same image provider as the
 * rest of the visualization pipeline. We pass the start_frame and character
 * model-sheets as references so the panels stay on-model.
 */
async function composeStoryboardImage(
  ctx: ChunkContext,
  plan: StoryboardPlan,
): Promise<{ imageUrl: string; prompt: string; generationModel: string }> {
  const grid = gridForShots(plan.shotCount);
  const panelLines = plan.shots
    .map((s) => {
      const action = s.characterAction ? ` — ${s.characterAction}` : "";
      return `Panel ${s.panel}: ${s.shotType}, ${s.cameraAngle}. ${s.description}${action}`;
    })
    .join("\n");

  const charLine = ctx.characterNames.length
    ? `Featuring characters: ${ctx.characterNames.join(", ")} (keep them strictly on-model with the reference sheets).`
    : "";

  const prompt =
    `STORYBOARD SHEET — single composite anime storyboard image. ` +
    `Layout: a clean ${grid.cols}×${grid.rows} grid of ${plan.shotCount} numbered cinematic panels, ` +
    `arranged left-to-right then top-to-bottom (panel 1 top-left, panel ${plan.shotCount} bottom-right). ` +
    `Each panel has a thin black border, a small panel number in the top-left corner of the panel, ` +
    `and renders one cinematic anime frame. ` +
    `The word "STORYBOARD" appears as a bold title at the top of the sheet on a clean off-white background. ` +
    `Style: ${ctx.animeStyle}, sharp cel-shaded linework, vibrant colors, dynamic lighting, ` +
    `consistent palette and characters across all panels, no captions or speech bubbles inside panels, ` +
    `no watermark, no extra text other than the panel numbers and the title. ` +
    `${charLine}\n\n` +
    `PANELS (in order):\n${panelLines}\n\n` +
    `Pacing: ${plan.visualPacing}. Mood: ${ctx.sceneEmotion || "cinematic"}.`;

  // Reference budget: start_frame (anchor) + character model sheets, capped at 3.
  const refs: string[] = [];
  const start = toAbsoluteUrl(ctx.startFrameUrl);
  if (start) refs.push(start);
  for (const c of ctx.characterRefs) {
    const abs = toAbsoluteUrl(c);
    if (abs && !refs.includes(abs)) refs.push(abs);
    if (refs.length >= 3) break;
  }

  const r = await generateImage({
    prompt,
    aspectRatio: "16:9",
    referenceUrls: refs,
    userId: ctx.userId,
    projectId: ctx.projectId,
    assetType: `chunks/${ctx.chunkId}`,
    filename: "storyboard.png",
  });

  return {
    imageUrl: r.url,
    prompt,
    generationModel: process.env.MAGNIFIC_IMAGE_ENDPOINT || "nano-banana-pro",
  };
}

/**
 * End-to-end: plan + render + persist + emit playground event. Throws on any
 * failure so the queue worker marks the task failed (which cascades to the
 * dependent video_chunk_generate task).
 */
export async function runChunkStoryboard(chunkId: string): Promise<StoryboardResult> {
  const ctx = loadChunkContext(chunkId);
  if (!ctx) throw new Error(`storyboard: chunk ${chunkId} not found`);

  db.prepare(
    `UPDATE video_chunks
       SET storyboard_status = 'generating',
           storyboard_error_message = NULL,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`,
  ).run(chunkId);

  recordAgentLog({
    projectId: ctx.projectId,
    agentName: "storyboard_composer",
    message: `Planning storyboard for chunk ${ctx.chunkNumber} (scene ${ctx.sceneNumber ?? "?"})…`,
  });

  const startedAt = Date.now();
  let plan: StoryboardPlan;
  try {
    plan = await planChunkShots(ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, chunkId }, "Storyboard plan failed");
    db.prepare(
      `UPDATE video_chunks
         SET storyboard_status = 'failed', storyboard_error_message = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
    ).run(`plan: ${msg}`, chunkId);
    throw err;
  }

  let rendered: { imageUrl: string; prompt: string; generationModel: string };
  try {
    rendered = await composeStoryboardImage(ctx, plan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, chunkId }, "Storyboard image render failed");
    db.prepare(
      `UPDATE video_chunks
         SET storyboard_status = 'failed', storyboard_error_message = ?,
             selected_shots_json = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
    ).run(`render: ${msg}`, JSON.stringify(plan.shots), chunkId);
    throw err;
  }

  const elapsedMs = Date.now() - startedAt;
  const metadata = {
    grid: gridForShots(plan.shotCount),
    visualPacing: plan.visualPacing,
    notes: plan.notes,
    sceneId: ctx.sceneId,
    sceneNumber: ctx.sceneNumber,
    durationSeconds: ctx.durationSeconds,
    referenceCount:
      (ctx.startFrameUrl ? 1 : 0) + Math.min(ctx.characterRefs.length, 2),
  };

  db.prepare(
    `UPDATE video_chunks
       SET storyboard_status = 'ready',
           storyboard_image_url = ?,
           storyboard_shot_count = ?,
           storyboard_prompt = ?,
           storyboard_metadata_json = ?,
           selected_shots_json = ?,
           storyboard_generation_model = ?,
           storyboard_generation_time_ms = ?,
           storyboard_error_message = NULL,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`,
  ).run(
    rendered.imageUrl,
    plan.shotCount,
    rendered.prompt,
    JSON.stringify(metadata),
    JSON.stringify(plan.shots),
    rendered.generationModel,
    elapsedMs,
    chunkId,
  );

  recordPlaygroundEvent({
    projectId: ctx.projectId,
    eventType: "chunk_storyboard_ready",
    agent: "storyboard_composer",
    message: `Chunk ${ctx.chunkNumber} storyboard ready (${plan.shotCount} panels, ${(elapsedMs / 1000).toFixed(1)}s).`,
    payload: {
      chunkId,
      sceneId: ctx.sceneId,
      sceneNumber: ctx.sceneNumber,
      chunkNumber: ctx.chunkNumber,
      storyboardImageUrl: rendered.imageUrl,
      shotCount: plan.shotCount,
      visualPacing: plan.visualPacing,
    },
  });

  return {
    imageUrl: rendered.imageUrl,
    shotCount: plan.shotCount,
    plan,
    prompt: rendered.prompt,
    generationModel: rendered.generationModel,
    generationTimeMs: elapsedMs,
  };
}
