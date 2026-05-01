import { Router, type IRouter } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/index.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router: IRouter = Router();

interface UserRow {
  id: string; email: string; password_hash: string; display_name: string | null;
  credits: number; plan: string; is_admin: number; created_at: string;
}

router.post("/register", authLimiter, async (req, res) => {
  const { email, password, displayName } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: "email and password required" });
    return;
  }
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  const existing = db.prepare<[string], UserRow>("SELECT * FROM users WHERE email = ?").get(email);
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const id = uuid();
  const hash = await hashPassword(password);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, display_name, credits) VALUES (?, ?, ?, ?, ?)",
  ).run(id, email, hash, displayName ?? null, 50);
  db.prepare(
    "INSERT INTO credit_ledger (id, user_id, delta, balance_after, reason) VALUES (?, ?, 50, 50, 'signup_bonus')",
  ).run(uuid(), id);
  const token = signToken({ sub: id, email, isAdmin: false });
  res.status(201).json({
    token,
    user: { id, email, displayName: displayName ?? null, credits: 50, plan: "free", isAdmin: false },
  });
});

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: "email and password required" });
    return;
  }
  const user = db.prepare<[string], UserRow>("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken({ sub: user.id, email: user.email, isAdmin: user.is_admin === 1 });
  res.json({
    token,
    user: {
      id: user.id, email: user.email, displayName: user.display_name,
      credits: user.credits, plan: user.plan, isAdmin: user.is_admin === 1,
    },
  });
});

router.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const user = db.prepare<[string], UserRow>("SELECT * FROM users WHERE id = ?").get(u.sub);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const roles = db
    .prepare<[string], { role_name: string }>("SELECT role_name FROM admin_user_roles WHERE user_id = ?")
    .all(u.sub)
    .map((r) => r.role_name);
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    credits: user.credits,
    plan: user.plan,
    isAdmin: user.is_admin === 1,
    roles,
  });
});

export default router;
