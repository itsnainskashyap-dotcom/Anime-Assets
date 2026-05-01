import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

function loadJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET environment variable is required in production and must be at least 32 characters long.",
    );
  }
  if (fromEnv && fromEnv.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }
  // Development only: derive an ephemeral random secret per-process so tokens
  // are never forgeable with a known default. All sessions invalidate on
  // restart, which is the desired behaviour for local development.
  // eslint-disable-next-line no-console
  console.warn(
    "[auth] JWT_SECRET not set — generating an ephemeral development secret. Tokens will invalidate on restart.",
  );
  return randomBytes(48).toString("hex");
}

const JWT_SECRET = loadJwtSecret();
const JWT_EXPIRES_IN = "30d";

export interface JwtUserPayload {
  sub: string;
  email: string;
  isAdmin: boolean;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtUserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtUserPayload;
  } catch {
    return null;
  }
}
