import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import db from "../db/index.js";

const STORAGE_ROOT = process.env.STORAGE_ROOT || path.resolve(process.cwd(), "storage");

if (!fs.existsSync(STORAGE_ROOT)) fs.mkdirSync(STORAGE_ROOT, { recursive: true });

export interface SaveOptions {
  userId: string;
  projectId: string;
  assetType: string;
  filename?: string;
  contentType?: string;
}

export interface SavedAsset {
  url: string;
  path: string;
  sizeBytes: number;
}

export async function saveBuffer(buf: Buffer, opts: SaveOptions): Promise<SavedAsset> {
  const subdir = path.join(STORAGE_ROOT, opts.userId, opts.projectId, opts.assetType);
  fs.mkdirSync(subdir, { recursive: true });
  const filename = opts.filename || `${uuid()}.bin`;
  const fullPath = path.join(subdir, filename);
  await fs.promises.writeFile(fullPath, buf);
  const url = `/storage/${opts.userId}/${opts.projectId}/${opts.assetType}/${filename}`;
  db.prepare(
    "INSERT INTO storage_usage (id, user_id, project_id, asset_type, url, size_bytes) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(uuid(), opts.userId, opts.projectId, opts.assetType, url, buf.length);
  return { url, path: fullPath, sizeBytes: buf.length };
}

export function localPathFromUrl(url: string): string {
  if (!url.startsWith("/storage/")) throw new Error("Not a local storage URL");
  return path.join(STORAGE_ROOT, url.replace(/^\/storage\//, ""));
}

export const STORAGE_ROOT_PATH: string = STORAGE_ROOT;
