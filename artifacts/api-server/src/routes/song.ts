import { Router, type IRouter } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { generationLimiter } from "../middleware/rateLimit.js";
import { enqueueTask } from "../services/queue.js";

const router: IRouter = Router();

interface SongRow {
  id: string; project_id: string; user_id: string; title: string | null;
  concept: string | null; language: string | null; duration_seconds: number | null;
  status: string; music_url: string | null; final_video_url: string | null;
}

function loadSong(songId: string, userId: string): SongRow | null {
  return (
    db
      .prepare<[string, string], SongRow>("SELECT * FROM song_projects WHERE id = ? AND user_id = ?")
      .get(songId, userId) || null
  );
}

router.post("/projects/:projectId/song/create", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const project = db
    .prepare<[string, string], { id: string }>("SELECT id FROM projects WHERE id = ? AND user_id = ?")
    .get((req.params.projectId as string), u.sub);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const { title, concept, language, durationSeconds } = req.body || {};
  const id = uuid();
  db.prepare(
    "INSERT INTO song_projects (id, project_id, user_id, title, concept, language, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, project.id, u.sub, title ?? null, concept ?? null, language ?? "en", durationSeconds ?? 60);
  res.status(201).json(loadSong(id, u.sub));
});

function songStage(stage: string): import("express").RequestHandler {
  return (req, res) => {
    const u = (req as AuthenticatedRequest).user!;
    const song = loadSong((req.params.songId as string), u.sub);
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    const task = enqueueTask({
      type: stage,
      stage,
      projectId: song.project_id,
      userId: u.sub,
      payload: { ...(req.body || {}), songId: song.id },
      idempotencyKey: `song:${song.id}:${stage}:${Date.now()}`,
    });
    res.status(202).json({ jobId: task.id, status: "queued" });
  };
}

router.post("/song/:songId/generate-lyrics", requireAuth, generationLimiter, songStage("song_lyrics_generate"));
router.post("/song/:songId/generate-music", requireAuth, generationLimiter, songStage("song_music_generate"));
router.post("/song/:songId/generate-video", requireAuth, generationLimiter, songStage("song_video_generate"));
router.post("/song/:songId/lipsync", requireAuth, generationLimiter, songStage("song_lipsync"));
router.post("/song/:songId/export", requireAuth, songStage("song_export"));

router.get("/song/:songId", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const song = loadSong((req.params.songId as string), u.sub);
  if (!song) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  const lyrics = db.prepare("SELECT * FROM song_lyrics WHERE song_id = ? ORDER BY line_number ASC").all(song.id);
  res.json({ ...song, lyrics });
});

router.get("/song/:songId/chunks", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const song = loadSong((req.params.songId as string), u.sub);
  if (!song) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  res.json(db.prepare("SELECT * FROM song_video_chunks WHERE song_id = ? ORDER BY chunk_number ASC").all(song.id));
});

export default router;
