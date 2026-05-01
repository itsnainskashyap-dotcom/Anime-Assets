import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const fromEnv = process.env.APP_ENCRYPTION_KEY;
  if (fromEnv && fromEnv.length >= 32) {
    cachedKey = crypto.createHash("sha256").update(fromEnv).digest();
    return cachedKey;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_ENCRYPTION_KEY environment variable is required in production and must be at least 32 characters long. Refusing to encrypt provider secrets with a predictable key.",
    );
  }
  if (fromEnv && fromEnv.length < 32) {
    throw new Error("APP_ENCRYPTION_KEY must be at least 32 characters long.");
  }
  // Development only: derive an ephemeral random key per process. Existing
  // ciphertexts written under previous runs will fail to decrypt — this is
  // intentional and surfaces missing configuration loudly.
  // eslint-disable-next-line no-console
  console.warn(
    "[crypto] APP_ENCRYPTION_KEY not set — using an ephemeral development key. Stored provider secrets will be unrecoverable across restarts.",
  );
  cachedKey = crypto.randomBytes(32);
  return cachedKey;
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
