import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import app from "./app.js";
import db from "./db/index.js";
import { logger } from "./lib/logger.js";
import { startWorkers } from "./jobs/queueWorker.js";

async function bootstrapAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    logger.warn("ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin bootstrap");
    return;
  }
  interface UserRow { id: string; is_admin: number }
  const existing = db.prepare<[string], UserRow>("SELECT id, is_admin FROM users WHERE email = ?").get(email);
  if (existing) {
    if (!existing.is_admin) {
      db.prepare("UPDATE users SET is_admin=1 WHERE id = ?").run(existing.id);
    }
    // Reset password to match the env var on every boot. This makes the
    // bootstrap idempotent — the operator can rotate ADMIN_PASSWORD via env
    // and the new value takes effect on next restart, even if the user row
    // already exists with an older hash. Without this, an admin user
    // created with an old/forgotten password gets stuck unable to log in.
    const hash = await bcrypt.hash(password, 10);
    // Also ensure admin has plenty of credits (top up to 999_999 if low) so
    // the operator can always run end-to-end pipelines without billing
    // friction. Don't lower an already-higher balance.
    db.prepare(
      "UPDATE users SET password_hash = ?, credits = MAX(credits, 999999) WHERE id = ?",
    ).run(hash, existing.id);
    db.prepare("INSERT OR IGNORE INTO admin_user_roles (user_id, role_name) VALUES (?, 'super_admin')").run(existing.id);
    logger.info({ email }, "Admin user found; password reset and credits topped up from ADMIN_PASSWORD env");
    return;
  }
  const id = uuid();
  const hash = await bcrypt.hash(password, 10);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, display_name, credits, is_admin) VALUES (?, ?, ?, 'Administrator', 9999, 1)",
  ).run(id, email, hash);
  db.prepare("INSERT OR IGNORE INTO admin_user_roles (user_id, role_name) VALUES (?, 'super_admin')").run(id);
  logger.info({ email }, "Bootstrapped super admin user");
}

const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await bootstrapAdmin().catch((err) => logger.error({ err }, "Admin bootstrap failed"));

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "AnimeStudioAI API listening");
  startWorkers();
});
