import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const k = process.env.APP_ENCRYPTION_KEY || "dev-encryption-key-change-me-please-32";
  return crypto.createHash("sha256").update(k).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(packed: string): string {
  const [ivB64, tagB64, encB64] = packed.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

export function maskKey(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 8) return "****";
  return plain.slice(0, 4) + "•".repeat(Math.max(4, plain.length - 8)) + plain.slice(-4);
}
