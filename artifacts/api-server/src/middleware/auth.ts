import type { Request, Response, NextFunction, RequestHandler } from "express";
import { verifyToken, type JwtUserPayload } from "../lib/auth.js";
import db from "../db/index.js";

export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}

export function readBearer(req: Request): string | null {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7);
  const fromCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.["asai_token"];
  return fromCookie || null;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = readBearer(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized", message: "Missing token" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
    return;
  }
  (req as AuthenticatedRequest).user = payload;
  next();
};

export function requireAdmin(...allowedRoles: string[]): RequestHandler {
  const getRoleStmt = db.prepare<[string], { role_name: string }>(
    "SELECT role_name FROM admin_user_roles WHERE user_id = ?",
  );
  return (req, res, next) => {
    const u = (req as AuthenticatedRequest).user;
    if (!u) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!u.isAdmin) {
      res.status(403).json({ error: "Forbidden", message: "Admin access required" });
      return;
    }
    if (allowedRoles.length > 0) {
      const roles = getRoleStmt.all(u.sub).map((r) => r.role_name);
      const hasRole =
        roles.includes("super_admin") ||
        allowedRoles.some((r) => roles.includes(r));
      if (!hasRole) {
        res.status(403).json({ error: "Forbidden", message: "Insufficient role" });
        return;
      }
    }
    next();
  };
}

export function adminAudit(action: string, targetType?: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const u = (req as AuthenticatedRequest).user;
    try {
      db.prepare(
        "INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, metadata_json, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(
        `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        u?.sub ?? null,
        action,
        targetType ?? null,
        (req.params && (req.params.id || null)) ?? null,
        JSON.stringify({ method: req.method, path: req.path, body: req.body }),
        req.ip ?? null,
      );
    } catch {
      // best-effort audit
    }
    next();
  };
}
