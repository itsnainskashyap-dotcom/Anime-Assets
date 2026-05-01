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
  base: { userId: string; projectId: string; sceneId: string; charRefs: string[] },
  promptSuffix: string,
  filename: string,
  aspect = "16:9",
): Promise<string | null> {
  try {
    const r = await generateImage({
      prompt: promptSuffix,
      aspectRatio: aspect,
      referenceUrls: base.charRefs.slice(0, 3),
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

/**
 * Generate the full V17 visualization pack for a single scene:
 * (optionally) seed_frame, start_frame, end_frame, scene_board, element_1, element_2.
 *
 * Each is a DISTINCT image generation call so element images differ from
 * the start/end frames.
 */
export async function buildVisualizationPack(opts: RunOpts): Promise<VisualizationPack> {
  const { projectId, userId, scene, characterRefs, animeStyle, isFirstScene } = opts;
  const base = { userId, projectId, sceneId: scene.id, charRefs: characterRefs };
  const sceneSummary = (scene.description || scene.title || "").trim();
  const shot = scene.shot_type || "medium";
  const emotion = scene.emotion || "cinematic";
  const stylePrefix = `${animeStyle}, sharp cel-shaded linework, vibrant colors, dynamic lighting, no text, no watermark.`;

  recordAgentLog({
    projectId,
    agentName: "visualization_director",
    message: `Generating visualization pack for scene ${scene.scene_number}…`,
  });

  // Seed frame only for first scene of project (style anchor for the whole show).
  let seedFrameUrl: string | null = null;
  if (isFirstScene) {
    seedFrameUrl = await tryImage(
      "seed_frame",
      base,
      `${stylePrefix} STYLE SEED FRAME for the entire production. Establish the master visual signature: palette, lighting, character ink-line weight. Hero composition. ${sceneSummary}`,
      "seed_frame.png",
    );
  }

  const startFrameUrl = await tryImage(
    "start_frame",
    base,
    `${stylePrefix} ${shot} shot, mood: ${emotion}. OPENING FRAME of scene ${scene.scene_number}. ${sceneSummary} Composition optimized as the first frame the camera holds on.`,
    "start_frame.png",
  );

  const endFrameUrl = await tryImage(
    "end_frame",
    base,
    `${stylePrefix} ${shot} shot, mood: ${emotion}. CLOSING FRAME of scene ${scene.scene_number}, slightly later moment than the opening, showing the action's natural evolution. ${sceneSummary}`,
    "end_frame.png",
  );

  const sceneBoardUrl = await tryImage(
    "scene_board",
    base,
    `${stylePrefix} STORYBOARD PANEL — wide composition map of scene ${scene.scene_number}, showing camera blocking, character placement, and environment layout. Annotated-storyboard style with implied camera direction. ${sceneSummary}`,
    "scene_board.png",
  );

  // Two element images: distinct supporting visuals (not the start/end frames),
  // useful as parallel references for the video model.
  const element1Url = await tryImage(
    "element_1",
    base,
    `${stylePrefix} CLOSE-UP DETAIL ELEMENT for scene ${scene.scene_number}. Single hero prop or character detail in isolation, shot tight. ${sceneSummary}`,
    "element_1.png",
    "1:1",
  );

  const element2Url = await tryImage(
    "element_2",
    base,
    `${stylePrefix} ENVIRONMENT ELEMENT for scene ${scene.scene_number}. Background plate without main characters: location, atmosphere, lighting. ${sceneSummary}`,
    "element_2.png",
    "16:9",
  );

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
