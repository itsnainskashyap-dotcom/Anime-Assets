import fs from "node:fs";
import { Router, type IRouter } from "express";
import db from "../db/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { generationLimiter } from "../middleware/rateLimit.js";
import { singleUpload, VIDEO_MIME } from "../middleware/upload.js";
import { enqueueTask } from "../services/queue.js";
import { recordPlaygroundEvent } from "../services/playgroundEvents.js";
import { saveBuffer } from "../providers/storageProvider.js";

const router: IRouter = Router();

interface ChunkRow {
  id: string; project_id: string; scene_id: string | null; chunk_number: number;
  status: string; video_url: string | null; reference_video_url: string | null;
  reference_video_trimmed_url: string | null; provider_model_visible_name: string;
  validation_json: string | null; retry_count: number;
}

function loadChunkOwned(chunkId: string, userId: string): ChunkRow | null {
  return (
    db
      .prepare<[string, string], ChunkRow>(
        `SELECT c.* FROM video_chunks c
         JOIN projects p ON p.id = c.project_id
         WHERE c.id = ? AND p.user_id = ?`,
      )
      .get(chunkId, userId) || null
  );
}

router.post("/:id/retry", requireAuth, generationLimiter, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const c = loadChunkOwned((req.params.id as string), u.sub);
  if (!c) {
    res.status(404).json({ error: "Chunk not found" });
    return;
  }
  db.prepare(
    "UPDATE video_chunks SET status='queued', retry_count = retry_count + 1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
  ).run(c.id);
  const task = enqueueTask({
    type: "video_chunk_generate",
    stage: "video_chunk_generate",
    projectId: c.project_id,
    userId: u.sub,
    chunkId: c.id,
    sceneId: c.scene_id,
    payload: { chunkId: c.id, retry: true },
  });
  recordPlaygroundEvent({ projectId: c.project_id, eventType: "chunk_retry", message: `Chunk ${c.chunk_number} retry enqueued` });
  res.json({ ok: true, jobId: task.id });
});

router.get("/:id/visualization-pack", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const c = loadChunkOwned((req.params.id as string), u.sub);
  if (!c) {
    res.status(404).json({ error: "Chunk not found" });
    return;
  }
  const pack = db.prepare("SELECT * FROM scene_visualizations WHERE scene_id = ?").get(c.scene_id);
  res.json({
    chunkId: c.id,
    sceneId: c.scene_id,
    pack,
    startFrameUrl: (pack as { start_frame_url?: string } | null)?.start_frame_url ?? null,
    endFrameUrl: (pack as { end_frame_url?: string } | null)?.end_frame_url ?? null,
    sceneBoardUrl: (pack as { scene_board_url?: string } | null)?.scene_board_url ?? null,
  });
});

router.get("/:id/reference-video", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const c = loadChunkOwned((req.params.id as string), u.sub);
  if (!c) {
    res.status(404).json({ error: "Chunk not found" });
    return;
  }
  res.json({
    chunkId: c.id,
    referenceVideoUrl: c.reference_video_url,
    trimmedUrl: c.reference_video_trimmed_url,
  });
});

router.post(
  "/:id/reference-video/upload",
  requireAuth,
  generationLimiter,
  singleUpload({ allowedMime: VIDEO_MIME, maxBytes: 200 * 1024 * 1024, field: "file" }),
  async (req, res) => {
    const u = (req as AuthenticatedRequest).user!;
    const c = loadChunkOwned(req.params.id as string, u.sub);
    if (!c) {
      res.status(404).json({ error: "Chunk not found" });
      return;
    }
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "Missing file field" });
      return;
    }
    const buf = await fs.promises.readFile(file.path);
    const saved = await saveBuffer(buf, {
      userId: u.sub,
      projectId: c.project_id,
      assetType: "reference_video",
      filename: file.filename,
      contentType: file.mimetype,
    });
    await fs.promises.unlink(file.path).catch(() => undefined);
    db.prepare(
      "UPDATE video_chunks SET reference_video_url = ?, generation_mode='reference_video', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    ).run(saved.url, c.id);
    enqueueTask({
      type: "reference_video_trim",
      projectId: c.project_id,
      userId: u.sub,
      chunkId: c.id,
      payload: { referenceVideoUrl: saved.url, sizeBytes: saved.sizeBytes, contentType: file.mimetype },
    });
    res.json({ ok: true, referenceVideoUrl: saved.url, sizeBytes: saved.sizeBytes });
  },
);

router.post("/:id/reference-video", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const c = loadChunkOwned((req.params.id as string), u.sub);
  if (!c) {
    res.status(404).json({ error: "Chunk not found" });
    return;
  }
  const { referenceVideoUrl } = req.body || {};
  if (!referenceVideoUrl) {
    res.status(400).json({ error: "referenceVideoUrl required" });
    return;
  }
  db.prepare("UPDATE video_chunks SET reference_video_url = ?, generation_mode='reference_video' WHERE id = ?").run(
    referenceVideoUrl,
    c.id,
  );
  enqueueTask({
    type: "reference_video_trim",
    projectId: c.project_id,
    userId: u.sub,
    chunkId: c.id,
    payload: { referenceVideoUrl },
  });
  res.json({ ok: true });
});

export default router;
