import { v4 as uuid } from "uuid";
import db from "../db/index.js";
import { generateImage } from "../providers/imageProvider.js";
import { logger } from "../lib/logger.js";
import { recordPlaygroundEvent, recordAgentLog } from "./playgroundEvents.js";

export interface VisualizationPack {
  sceneId: string;
  seedFrameUrl: string | null;
  startFrameUrl: string | null;
  endFrameUrl: string | null;
  sceneBoardUrl: string | null;
  element1Url: string | null;
  element2Url: string | null;
}

export interface SceneInput {
  id: string;
  scene_number: number;
  title: string | null;
  description: string | null;
  shot_type: string | null;
  emotion: string | null;
  duration_seconds: number;
}

interface RunOpts {
  projectId: string;
  userId: string;
  scene: SceneInput;
  characterRefs: string[];
  animeStyle: string;
  isFirstScene: boolean;
}

async function tryImage(
  label: string,
  base: { userId: string; projectId: string; sceneId: string },
  promptSuffix: string,
  filename: string,
  referenceUrls: string[],
  aspect = "16:9",
): Promise<string | null> {
  try {
    const r = await generateImage({
      prompt: promptSuffix,
      aspectRatio: aspect,
      referenceUrls: referenceUrls.slice(0, 3),
      userId: base.userId,
      projectId: base.projectId,
      assetType: `scenes/${base.sceneId}`,
      filename,
    });
    return r.url;
  } catch (err) {
    logger.error({ err, sceneId: base.sceneId, label }, "Visualization image failed");
    return null;
  }
}

function toAbsoluteUrl(u: string | null): string | null {
  if (!u) return null;
  if (u.startsWith("http")) return u;
  const publicBase = process.env.PUBLIC_BASE_URL || "";
  // Without PUBLIC_BASE_URL the upstream image API cannot fetch /storage/
  // assets, so the reference would be silently useless. Drop it instead
  // of degrading quality invisibly — char refs alone will be used.
  if (u.startsWith("/storage/")) return publicBase ? `${publicBase}${u}` : null;
  return null;
}

/**
 * Generate the full V17 visualization pack for a single scene:
 * (optionally) seed_frame, start_frame, end_frame, scene_board, element_1, element_2.
 *
 * Wave 1 (parallel): seed_frame (first scene only) + start_frame.
 *   start_frame is the visual anchor for the rest of the scene.
 * Wave 2 (parallel): end_frame, scene_board, element_1, element_2 — all
 *   anchored to the just-rendered start_frame so backgrounds and palette
 *   stay consistent across all 6 images of the same scene.
 */
export async function buildVisualizationPack(opts: RunOpts): Promise<VisualizationPack> {
  const { projectId, userId, scene, characterRefs, animeStyle, isFirstScene } = opts;
  const base = { userId, projectId, sceneId: scene.id };
  const sceneSummary = (scene.description || scene.title || "").trim();
  const shot = scene.shot_type || "medium";
  const emotion = scene.emotion || "cinematic";
  const stylePrefix = `${animeStyle}, sharp cel-shaded linework, vibrant colors, dynamic lighting, no text, no watermark.`;

  recordAgentLog({
    projectId,
    agentName: "visualization_director",
    message: `Generating visualization pack for scene ${scene.scene_number}…`,
  });

  // ── WAVE 1: seed_frame (optional, first scene only) + start_frame ──
  // start_frame uses the character refs so faces stay on-model for this
  // scene's actors. seed_frame is a free-standing style anchor.
  const wave1: Array<Promise<{ key: "seed" | "start"; url: string | null }>> = [];
  if (isFirstScene) {
    wave1.push(
      tryImage(
        "seed_frame",
        base,
        `${stylePrefix} STYLE SEED FRAME for the entire production. Establish the master visual signature: palette, lighting, character ink-line weight. Hero composition. ${sceneSummary}`,
        "seed_frame.png",
        characterRefs,
      ).then((url) => ({ key: "seed" as const, url })),
    );
  }
  wave1.push(
    tryImage(
      "start_frame",
      base,
      `${stylePrefix} ${shot} shot, mood: ${emotion}. OPENING FRAME of scene ${scene.scene_number}. ${sceneSummary} Composition optimized as the first frame the camera holds on. Establish the scene's environment, lighting and color palette clearly.`,
      "start_frame.png",
      characterRefs,
    ).then((url) => ({ key: "start" as const, url })),
  );
  const wave1Results = await Promise.all(wave1);
  const seedFrameUrl = wave1Results.find((r) => r.key === "seed")?.url ?? null;
  const startFrameUrl = wave1Results.find((r) => r.key === "start")?.url ?? null;

  // start_frame is the anchor for everything else in this scene so that
  // backgrounds, lighting, and character placement stay coherent.
  const sceneAnchor = toAbsoluteUrl(startFrameUrl);
  const wave2Refs = [sceneAnchor, ...characterRefs].filter((u): u is string => Boolean(u));

  // ── WAVE 2: end_frame, scene_board, element_1, element_2 in parallel ──
  const [endFrameUrl, sceneBoardUrl, element1Url, element2Url] = await Promise.all([
    tryImage(
      "end_frame",
      base,
      `${stylePrefix} ${shot} shot, mood: ${emotion}. CLOSING FRAME of scene ${scene.scene_number}, slightly later moment than the opening. EXACT same environment, lighting, palette and characters as the reference (start frame). ${sceneSummary}`,
      "end_frame.png",
      wave2Refs,
    ),
    tryImage(
      "scene_board",
      base,
      `${stylePrefix} STORYBOARD PANEL — wide composition map of scene ${scene.scene_number}, showing camera blocking, character placement, and environment layout. SAME environment, lighting and palette as reference. ${sceneSummary}`,
      "scene_board.png",
      wave2Refs,
    ),
    tryImage(
      "element_1",
      base,
      `${stylePrefix} CLOSE-UP DETAIL ELEMENT for scene ${scene.scene_number}. Single hero prop or character detail in isolation, shot tight. SAME palette and lighting as reference. ${sceneSummary}`,
      "element_1.png",
      wave2Refs,
      "1:1",
    ),
    tryImage(
      "element_2",
      base,
      `${stylePrefix} ENVIRONMENT ELEMENT for scene ${scene.scene_number}. Background plate without main characters: location, atmosphere, lighting. EXACT same environment as reference (start frame). ${sceneSummary}`,
      "element_2.png",
      wave2Refs,
      "16:9",
    ),
  ]);

  // Persist into scene_visualizations.
  const sv = db
    .prepare<[string], { id: string }>("SELECT id FROM scene_visualizations WHERE scene_id = ?")
    .get(scene.id);
  const elementUrls = JSON.stringify([element1Url, element2Url].filter(Boolean));
  if (sv) {
    db.prepare(
      "UPDATE scene_visualizations SET scene_board_url = ?, start_frame_url = ?, end_frame_url = ?, element_urls = ? WHERE id = ?",
    ).run(sceneBoardUrl, startFrameUrl, endFrameUrl, elementUrls, sv.id);
  } else {
    db.prepare(
      "INSERT INTO scene_visualizations (id, scene_id, scene_board_url, start_frame_url, end_frame_url, element_urls) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(uuid(), scene.id, sceneBoardUrl, startFrameUrl, endFrameUrl, elementUrls);
  }

  recordPlaygroundEvent({
    projectId,
    eventType: "visualization_ready",
    agent: "visualization_director",
    message: `Scene ${scene.scene_number} visualization pack ready (${[seedFrameUrl, startFrameUrl, endFrameUrl, sceneBoardUrl, element1Url, element2Url].filter(Boolean).length}/6 images).`,
    payload: {
      sceneId: scene.id,
      seedFrameUrl,
      startFrameUrl,
      endFrameUrl,
      sceneBoardUrl,
      element1Url,
      element2Url,
    },
  });

  return {
    sceneId: scene.id,
    seedFrameUrl,
    startFrameUrl,
    endFrameUrl,
    sceneBoardUrl,
    element1Url,
    element2Url,
  };
}
