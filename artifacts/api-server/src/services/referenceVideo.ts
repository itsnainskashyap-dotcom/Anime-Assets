import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { v4 as uuid } from "uuid";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { saveBuffer, STORAGE_ROOT_PATH } from "../providers/storageProvider.js";
import { safeFetch } from "../lib/safeFetch.js";
import { logger } from "../lib/logger.js";

const FFMPEG = (ffmpegPath as unknown as string) || "ffmpeg";
const FFPROBE = (ffprobeStatic as { path?: string })?.path || "ffprobe";

export async function probeDurationSeconds(localPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const proc = spawn(FFPROBE, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      localPath,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => (out += d.toString()));
    proc.on("error", (err) => {
      logger.warn({ err }, "ffprobe failed");
      resolve(null);
    });
    proc.on("exit", () => {
      const n = parseFloat(out.trim());
      resolve(Number.isFinite(n) ? n : null);
    });
  });
}

async function downloadToTmp(remoteUrl: string, suggestedExt = ".mp4"): Promise<string> {
  if (remoteUrl.startsWith("/storage/")) {
    const local = path.join(STORAGE_ROOT_PATH, remoteUrl.replace(/^\/storage\//, ""));
    if (fs.existsSync(local)) return local;
  }
  const res = await safeFetch(remoteUrl);
  if (!res.ok) throw new Error(`Cannot download reference video (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = path.join(STORAGE_ROOT_PATH, "_tmp", `ref_${uuid()}${suggestedExt}`);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, buf);
  return tmp;
}

/**
 * Trim a video to the first 10 seconds (Magnific reference-video maximum).
 * If the input is already ≤10s, returns the original URL.
 *
 * Returns the URL of the trimmed clip in the local storage tree.
 */
export async function trimReferenceVideoTo10s(opts: {
  sourceUrl: string;
  userId: string;
  projectId: string;
  chunkId?: string;
}): Promise<{ url: string; durationSeconds: number; trimmed: boolean }> {
  const localPath = await downloadToTmp(opts.sourceUrl);
  const dur = await probeDurationSeconds(localPath);
  if (dur === null) {
    logger.warn({ sourceUrl: opts.sourceUrl }, "Could not probe duration; returning source unchanged");
    return { url: opts.sourceUrl, durationSeconds: 0, trimmed: false };
  }

  if (dur <= 10.05) {
    return { url: opts.sourceUrl, durationSeconds: dur, trimmed: false };
  }

  const outPath = path.join(STORAGE_ROOT_PATH, "_tmp", `trimmed_${uuid()}.mp4`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      FFMPEG,
      ["-y", "-i", localPath, "-t", "10", "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", outPath],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg trim failed (${code}): ${stderr.slice(-300)}`));
    });
  });

  const buf = await fs.promises.readFile(outPath);
  const saved = await saveBuffer(buf, {
    userId: opts.userId,
    projectId: opts.projectId,
    assetType: opts.chunkId ? `chunks/${opts.chunkId}` : "reference_video",
    filename: `trimmed_${Date.now()}.mp4`,
    contentType: "video/mp4",
  });
  await fs.promises.unlink(outPath).catch(() => undefined);
  return { url: saved.url, durationSeconds: 10, trimmed: true };
}
