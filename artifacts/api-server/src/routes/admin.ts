import { Router, type IRouter } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/index.js";
import { requireAuth, requireAdmin, adminAudit, type AuthenticatedRequest } from "../middleware/auth.js";
import { adminLimiter } from "../middleware/rateLimit.js";
import { encryptSecret, maskKey } from "../lib/crypto.js";
import { adjustCredits } from "../services/credits.js";

const router: IRouter = Router();

// Baseline: must be authenticated AND flagged as admin. Specific role checks
// are applied per route below so finance/ops/support roles cannot perform
// actions outside their remit. super_admin bypasses every check.
router.use(requireAuth, requireAdmin(), adminLimiter);

const READ_ROLES = [
  "read_only_admin",
  "support_admin",
  "operations_admin",
  "finance_admin",
] as const;
const OPS_ROLES = ["operations_admin"] as const;
const FINANCE_ROLES = ["finance_admin"] as const;
const SUPPORT_ROLES = ["support_admin", "operations_admin", "finance_admin"] as const;

const requireRead = requireAdmin(...READ_ROLES);
const requireOps = requireAdmin(...OPS_ROLES);
const requireFinance = requireAdmin(...FINANCE_ROLES);
const requireSupport = requireAdmin(...SUPPORT_ROLES);

router.get("/dashboard", requireRead, (_req, res) => {
  const stats = {
    users: (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c,
    projects: (db.prepare("SELECT COUNT(*) AS c FROM projects").get() as { c: number }).c,
    activeJobs: (db.prepare("SELECT COUNT(*) AS c FROM job_tasks WHERE status IN ('queued','in_progress')").get() as { c: number }).c,
    failedJobsLast24h: (db.prepare("SELECT COUNT(*) AS c FROM job_tasks WHERE status='failed' AND finished_at >= datetime('now','-1 day')").get() as { c: number }).c,
    totalCreditsIssued: (db.prepare("SELECT COALESCE(SUM(delta),0) AS s FROM credit_ledger WHERE delta > 0").get() as { s: number }).s,
    totalCreditsSpent: -(db.prepare("SELECT COALESCE(SUM(delta),0) AS s FROM credit_ledger WHERE delta < 0").get() as { s: number }).s,
    revenuePaiseLast30d: (db.prepare("SELECT COALESCE(SUM(amount_paise),0) AS s FROM payment_orders WHERE status='captured' AND created_at >= datetime('now','-30 days')").get() as { s: number }).s,
  };
  const recentJobs = db
    .prepare("SELECT id, type, stage, status, project_id, retry_count, error_message, created_at FROM job_tasks ORDER BY created_at DESC LIMIT 25")
    .all();
  const providerHealth = db
    .prepare("SELECT provider_name, COUNT(*) AS keys, SUM(enabled) AS enabled, SUM(error_count) AS errors FROM provider_keys GROUP BY provider_name")
    .all();
  res.json({ stats, recentJobs, providerHealth });
});

router.get("/users", requireSupport, (_req, res) => {
  const users = db
    .prepare("SELECT id, email, display_name, credits, plan, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 200")
    .all();
  res.json(users);
});

router.get("/projects", requireSupport, (_req, res) => {
  res.json(db.prepare("SELECT * FROM projects ORDER BY created_at DESC LIMIT 200").all());
});

router.get("/jobs", requireRead, (req, res) => {
  const status = (req.query.status as string) || null;
  const stmt = status
    ? db.prepare("SELECT * FROM job_tasks WHERE status = ? ORDER BY created_at DESC LIMIT 200")
    : db.prepare("SELECT * FROM job_tasks ORDER BY created_at DESC LIMIT 200");
  res.json(status ? stmt.all(status) : stmt.all());
});

router.post("/jobs/:id/retry", requireOps, adminAudit("job_retry", "job_tasks"), (req, res) => {
  const r = db
    .prepare(
      "UPDATE job_tasks SET status='queued', locked_by_worker_id=NULL, lock_expires_at=NULL, retry_count=retry_count+1, scheduled_for=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    )
    .run((req.params.id as string));
  res.json({ ok: r.changes > 0 });
});

router.post("/jobs/:id/cancel", requireOps, adminAudit("job_cancel", "job_tasks"), (req, res) => {
  db.prepare("UPDATE job_tasks SET status='cancelled' WHERE id = ?").run((req.params.id as string));
  res.json({ ok: true });
});

router.post("/jobs/:id/pause", requireOps, adminAudit("job_pause", "job_tasks"), (req, res) => {
  db.prepare("UPDATE job_tasks SET status='paused' WHERE id = ? AND status IN ('queued','in_progress')").run((req.params.id as string));
  res.json({ ok: true });
});

router.post("/jobs/:id/resume", requireOps, adminAudit("job_resume", "job_tasks"), (req, res) => {
  db.prepare("UPDATE job_tasks SET status='queued' WHERE id = ? AND status='paused'").run((req.params.id as string));
  res.json({ ok: true });
});

router.get("/provider-keys", requireRead, (_req, res) => {
  const rows = db
    .prepare("SELECT id, provider_name, label, masked_key, enabled, priority, status, last_success_at, last_failure_at, error_count, created_at FROM provider_keys ORDER BY provider_name, priority DESC")
    .all();
  res.json(rows);
});

router.post("/provider-keys", requireOps, adminAudit("provider_key_add", "provider_keys"), (req, res) => {
  const { providerName, label, key, priority } = req.body || {};
  if (!providerName || !key) {
    res.status(400).json({ error: "providerName and key required" });
    return;
  }
  const id = uuid();
  db.prepare(
    "INSERT INTO provider_keys (id, provider_name, label, encrypted_key, masked_key, priority) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, providerName, label ?? null, encryptSecret(key), maskKey(key), priority ?? 0);
  res.status(201).json({ id, masked: maskKey(key) });
});

router.patch("/provider-keys/:id", requireOps, adminAudit("provider_key_update", "provider_keys"), (req, res) => {
  const { label, priority, key } = req.body || {};
  const updates: string[] = [];
  const args: unknown[] = [];
  if (label !== undefined) { updates.push("label = ?"); args.push(label); }
  if (priority !== undefined) { updates.push("priority = ?"); args.push(priority); }
  if (key) { updates.push("encrypted_key = ?", "masked_key = ?"); args.push(encryptSecret(key), maskKey(key)); }
  if (updates.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  args.push((req.params.id as string));
  db.prepare(`UPDATE provider_keys SET ${updates.join(", ")}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(...args);
  res.json({ ok: true });
});

router.post("/provider-keys/:id/test", requireOps, adminAudit("provider_key_test", "provider_keys"), (req, res) => {
  const id = (req.params.id as string);
  const key = db.prepare("SELECT id, provider_name FROM provider_keys WHERE id = ?").get(id);
  if (!key) {
    res.status(404).json({ error: "Key not found" });
    return;
  }
  const testId = uuid();
  db.prepare(
    "INSERT INTO provider_capability_tests (id, provider_name, capability, passed, details_json) VALUES (?, ?, 'connectivity', 1, ?)",
  ).run(testId, (key as { provider_name: string }).provider_name, JSON.stringify({ note: "Stub test — full impl in Task 3", keyId: id }));
  db.prepare("UPDATE provider_keys SET status='ok', last_success_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(id);
  res.json({ ok: true, testId, status: "ok" });
});

router.post("/provider-keys/:id/enable", requireOps, adminAudit("provider_key_enable", "provider_keys"), (req, res) => {
  db.prepare("UPDATE provider_keys SET enabled=1 WHERE id = ?").run((req.params.id as string));
  res.json({ ok: true });
});

router.post("/provider-keys/:id/disable", requireOps, adminAudit("provider_key_disable", "provider_keys"), (req, res) => {
  db.prepare("UPDATE provider_keys SET enabled=0 WHERE id = ?").run((req.params.id as string));
  res.json({ ok: true });
});

router.post("/provider-keys/:id/set-priority", requireOps, adminAudit("provider_key_priority", "provider_keys"), (req, res) => {
  const { priority } = req.body || {};
  if (typeof priority !== "number") {
    res.status(400).json({ error: "priority must be a number" });
    return;
  }
  db.prepare("UPDATE provider_keys SET priority = ? WHERE id = ?").run(priority, (req.params.id as string));
  res.json({ ok: true });
});

router.get("/provider-health", requireRead, (_req, res) => {
  res.json({
    keys: db.prepare("SELECT id, provider_name, status, last_success_at, last_failure_at, error_count FROM provider_keys ORDER BY provider_name").all(),
    recentLogs: db.prepare("SELECT * FROM provider_call_logs ORDER BY created_at DESC LIMIT 100").all(),
  });
});

router.get("/provider-capability-tests", requireRead, (_req, res) => {
  res.json(db.prepare("SELECT * FROM provider_capability_tests ORDER BY created_at DESC LIMIT 100").all());
});

router.post("/provider-capability-tests/run", requireOps, adminAudit("provider_capability_test_run"), (req, res) => {
  const { providerName, capability } = req.body || {};
  const id = uuid();
  db.prepare(
    "INSERT INTO provider_capability_tests (id, provider_name, capability, passed, details_json) VALUES (?, ?, ?, 1, ?)",
  ).run(id, providerName ?? "unknown", capability ?? "connectivity", JSON.stringify({ stub: true }));
  res.json({ id, passed: true, note: "Stub test — full implementation in Task 3" });
});

router.get("/failover-events", requireRead, (_req, res) => {
  res.json(db.prepare("SELECT * FROM provider_failover_events ORDER BY created_at DESC LIMIT 100").all());
});

router.get("/failed-generations", requireRead, (_req, res) => {
  res.json(db.prepare("SELECT * FROM job_tasks WHERE status='failed' ORDER BY finished_at DESC LIMIT 100").all());
});

router.get("/billing", requireFinance, (_req, res) => {
  res.json({
    revenue: db.prepare("SELECT SUM(amount_paise) AS total FROM payment_orders WHERE status='captured'").get(),
    creditFlow: db.prepare("SELECT date(created_at) AS day, SUM(delta) AS total FROM credit_ledger GROUP BY day ORDER BY day DESC LIMIT 60").all(),
    recentOrders: db.prepare("SELECT * FROM payment_orders ORDER BY created_at DESC LIMIT 50").all(),
  });
});

router.post("/refund", requireFinance, adminAudit("admin_refund"), (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const { userId, credits, reason } = req.body || {};
  if (!userId || typeof credits !== "number") {
    res.status(400).json({ error: "userId and credits required" });
    return;
  }
  try {
    const result = adjustCredits(userId, credits, `admin_refund:${reason ?? "n/a"}:by:${u.sub}`);
    res.json({ ok: true, balance: result.balance });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json({ error: e.message });
  }
});

router.get("/pricing-config", requireFinance, (_req, res) => {
  res.json(db.prepare("SELECT * FROM pricing_config ORDER BY operation").all());
});

router.post("/pricing-config", requireFinance, adminAudit("pricing_update"), (req, res) => {
  const { operation, credits, description } = req.body || {};
  if (!operation || typeof credits !== "number") {
    res.status(400).json({ error: "operation and credits required" });
    return;
  }
  db.prepare(
    "INSERT INTO pricing_config (operation, credits, description, updated_at) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(operation) DO UPDATE SET credits = excluded.credits, description = excluded.description, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')",
  ).run(operation, credits, description ?? null);
  res.json({ ok: true });
});

router.get("/storage", requireRead, (_req, res) => {
  res.json({
    perUser: db.prepare("SELECT user_id, SUM(size_bytes) AS bytes, COUNT(*) AS files FROM storage_usage GROUP BY user_id ORDER BY bytes DESC LIMIT 50").all(),
    perType: db.prepare("SELECT asset_type, SUM(size_bytes) AS bytes, COUNT(*) AS files FROM storage_usage GROUP BY asset_type").all(),
    total: db.prepare("SELECT SUM(size_bytes) AS bytes, COUNT(*) AS files FROM storage_usage").get(),
  });
});

router.get("/audit-logs", requireRead, (_req, res) => {
  res.json(db.prepare("SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 200").all());
});

router.get("/song-ops", requireSupport, (_req, res) => {
  res.json(db.prepare("SELECT * FROM song_projects ORDER BY created_at DESC LIMIT 100").all());
});

router.get("/agent-runs", requireSupport, (_req, res) => {
  res.json(db.prepare("SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT 100").all());
});

router.get("/memory-conflicts", requireSupport, (_req, res) => {
  res.json(db.prepare("SELECT * FROM memory_conflicts ORDER BY created_at DESC LIMIT 100").all());
});

router.get("/error-library", requireRead, (_req, res) => {
  res.json(db.prepare("SELECT * FROM error_library ORDER BY created_at DESC").all());
});

router.post("/error-library", requireOps, adminAudit("error_library_add"), (req, res) => {
  const { code, category, message, resolution } = req.body || {};
  if (!code || !message) {
    res.status(400).json({ error: "code and message required" });
    return;
  }
  const id = uuid();
  db.prepare(
    "INSERT INTO error_library (id, code, category, message, resolution) VALUES (?, ?, ?, ?, ?)",
  ).run(id, code, category ?? null, message, resolution ?? null);
  res.status(201).json({ id });
});

export default router;
