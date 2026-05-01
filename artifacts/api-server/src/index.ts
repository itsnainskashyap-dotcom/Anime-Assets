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
    db.prepare("INSERT OR IGNORE INTO admin_user_roles (user_id, role_name) VALUES (?, 'super_admin')").run(existing.id);
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
