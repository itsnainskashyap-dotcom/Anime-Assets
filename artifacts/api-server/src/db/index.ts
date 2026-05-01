import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname_local = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), "data", "animestudio.db");
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

export const db: Database.Database = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

let schemaPath = path.resolve(__dirname_local, "schema.sql");
if (!fs.existsSync(schemaPath)) {
  schemaPath = path.resolve(process.cwd(), "src/db/schema.sql");
}
if (!fs.existsSync(schemaPath)) {
  schemaPath = path.resolve(process.cwd(), "artifacts/api-server/src/db/schema.sql");
}
const schemaSql = fs.readFileSync(schemaPath, "utf-8");
db.exec(schemaSql);

const seedPricing = db.prepare(
  "INSERT OR IGNORE INTO pricing_config(operation, credits, description) VALUES (?, ?, ?)",
);
const defaultPricing: Array<[string, number, string]> = [
  ["story_bible_generate", 5, "Generate full story bible"],
  ["character_generate", 8, "Generate one character with model sheet"],
  ["storyboard_generate", 10, "Generate full storyboard"],
  ["visualization_generate", 15, "Generate visualization pack"],
  ["chunk_video_standard", 25, "Generate one 10-second video chunk (standard)"],
  ["chunk_video_reference", 30, "Generate one 10-second video chunk (reference-to-video)"],
  ["scene_image", 4, "Generate one scene board image"],
  ["validation", 1, "Vision validation per chunk"],
  ["song_full", 200, "Full song generation (up to 3 minutes)"],
  ["export_zip", 5, "Export project as ZIP"],
];
const seedTx = db.transaction(() => {
  for (const row of defaultPricing) seedPricing.run(...row);
});
seedTx();

const seedPack = db.prepare(
  "INSERT OR IGNORE INTO credit_packs(id, name, credits, amount_paise, currency, sort_order) VALUES (?, ?, ?, ?, 'INR', ?)",
);
const defaultPacks: Array<[string, string, number, number, number]> = [
  ["pack_starter", "Starter Pack", 200, 9900, 1],
  ["pack_creator", "Creator Pack", 600, 24900, 2],
  ["pack_studio", "Studio Pack", 1500, 49900, 3],
  ["pack_pro", "Pro Pack", 4000, 99900, 4],
];
const packsTx = db.transaction(() => {
  for (const p of defaultPacks) seedPack.run(...p);
});
packsTx();

const seedRoles = db.prepare(
  "INSERT OR IGNORE INTO admin_roles(id, name, description) VALUES (?, ?, ?)",
);
const roles: Array<[string, string, string]> = [
  ["role_super", "super_admin", "Full access to all admin features"],
  ["role_ops", "operations_admin", "Manage jobs, providers, queue"],
  ["role_finance", "finance_admin", "Manage billing, refunds, pricing"],
  ["role_support", "support_admin", "View users, jobs, audit logs"],
  ["role_readonly", "read_only_admin", "Read-only access to admin"],
];
const rolesTx = db.transaction(() => {
  for (const r of roles) seedRoles.run(...r);
});
rolesTx();

export default db;
