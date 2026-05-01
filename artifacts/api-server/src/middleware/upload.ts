import path from "node:path";
import fs from "node:fs";
import multer, { type Multer, type FileFilterCallback } from "multer";
import { v4 as uuid } from "uuid";
import { STORAGE_ROOT_PATH } from "../providers/storageProvider.js";

const UPLOAD_TMP = path.join(STORAGE_ROOT_PATH, "_uploads");
if (!fs.existsSync(UPLOAD_TMP)) fs.mkdirSync(UPLOAD_TMP, { recursive: true });

export interface UploadOptions {
  maxBytes?: number;
  allowedMime?: RegExp;
  field?: string;
}

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_TMP),
  filename: (_req, file, cb) => {
    const safeExt = (path.extname(file.originalname) || "").toLowerCase().replace(/[^a-z0-9.]/g, "");
    cb(null, `${uuid()}${safeExt}`);
  },
});

function makeFilter(allowed: RegExp): (req: unknown, file: Express.Multer.File, cb: FileFilterCallback) => void {
  return (_req, file, cb) => {
    if (!allowed.test(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  };
}

export function singleUpload(options: UploadOptions = {}): ReturnType<Multer["single"]> {
  const m = multer({
    storage,
    limits: { fileSize: options.maxBytes ?? DEFAULT_MAX_BYTES, files: 1 },
    fileFilter: makeFilter(options.allowedMime ?? /^(image|video|audio)\//),
  });
  return m.single(options.field ?? "file");
}

export const VIDEO_MIME = /^video\/(mp4|webm|quicktime|x-matroska)$/;
export const IMAGE_MIME = /^image\/(png|jpeg|webp|gif)$/;
export const AUDIO_MIME = /^audio\/(mpeg|mp3|wav|x-wav|ogg|webm|aac|mp4)$/;
