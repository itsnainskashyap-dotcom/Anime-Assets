#!/usr/bin/env node
/**
 * Repair AI — Autonomous code self-healing agent
 *
 * Architecture (multi-agent pipeline):
 *   Agent 1 (Watcher)  — polls SQLite agent_activity_logs + stderr for ERROR entries
 *   Agent 2 (Analyzer) — Claude claude-sonnet-4-6: categorizes error, identifies affected files
 *   Agent 3 (Fixer)    — Claude claude-sonnet-4-6: reads files, writes exact code patches
 *   Agent 4 (Validator)— runs `tsc --noEmit` to verify the patch compiles
 *   Agent 5 (Applier)  — writes files, restarts api-server workflow if needed
 *
 * Safety guardrails:
 *   - Only modifies .ts / .tsx files inside artifacts/ directory
 *   - Never deletes files
 *   - Max 8 fix attempts per hour (token-bucket rate limiter)
 *   - Keeps a full repair log at artifacts/api-server/data/repair-log.jsonl
 *   - Skips errors that have been seen in the last 30 minutes (dedup)
 */

import Anthropic from "@anthropic-ai/sdk";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { execSync, exec } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const WORKSPACE       = path.resolve(__dirname, "../../..");
const API_DIR         = path.resolve(__dirname, "..");
const WEB_DIR         = path.resolve(WORKSPACE, "artifacts/animestudioai-web");
const DB_PATH         = path.resolve(API_DIR, "data/animestudio.db");
const REPAIR_LOG_PATH = path.resolve(API_DIR, "data/repair-log.jsonl");
const MODEL           = "claude-sonnet-4-6";

const POLL_INTERVAL_MS   = 30_000;  // check every 30 s
const ERROR_WINDOW_MS    = 5 * 60 * 1000; // look back 5 minutes
const DEDUP_WINDOW_MS    = 30 * 60 * 1000; // ignore same error for 30 min
const MAX_FIXES_PER_HOUR = 8;
const MAX_FILE_BYTES     = 40_000; // don't send huge files to Claude

// ── Rate limiter (token-bucket) ──────────────────────────────────────────────
const fixTimestamps = [];
function canFix() {
  const now = Date.now();
  const cutoff = now - 3600_000;
  while (fixTimestamps.length && fixTimestamps[0] < cutoff) fixTimestamps.shift();
  return fixTimestamps.length < MAX_FIXES_PER_HOUR;
}
function recordFix() { fixTimestamps.push(Date.now()); }

// ── Dedup cache — key: error fingerprint, value: timestamp ──────────────────
const seenErrors = new Map();
function isSeenError(fingerprint) {
  const last = seenErrors.get(fingerprint);
  if (!last) return false;
  return Date.now() - last < DEDUP_WINDOW_MS;
}
function markSeen(fingerprint) { seenErrors.set(fingerprint, Date.now()); }

// ── Repair log ───────────────────────────────────────────────────────────────
function appendRepairLog(entry) {
  try {
    fs.appendFileSync(REPAIR_LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
  } catch { /* non-fatal */ }
}

// ── Anthropic client ─────────────────────────────────────────────────────────
function buildClient() {
  const apiKey  = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (!apiKey) throw new Error("No Anthropic API key available (AI_INTEGRATIONS_ANTHROPIC_API_KEY)");
  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

async function callClaude(client, systemPrompt, userPrompt, maxTokens = 4096) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  return response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

// ── Safe file operations ─────────────────────────────────────────────────────
function isSafeToModify(filePath) {
  const rel = path.relative(WORKSPACE, filePath);
  // Only allow TypeScript/TSX files inside artifacts/
  if (!rel.startsWith("artifacts/")) return false;
  if (!/\.(ts|tsx)$/.test(filePath)) return false;
  // Forbid node_modules, dist, build outputs
  if (/node_modules|\/dist\/|\/build\//.test(rel)) return false;
  return true;
}

function readFileSafe(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.slice(0, MAX_FILE_BYTES); // truncate huge files
  } catch {
    return null;
  }
}

// ── TypeScript validator ─────────────────────────────────────────────────────
function runTscCheck(packageDir) {
  try {
    execSync("pnpm exec tsc --noEmit", { cwd: packageDir, timeout: 30_000, stdio: "pipe" });
    return { ok: true };
  } catch (err) {
    return { ok: false, output: (err.stdout?.toString() || "") + (err.stderr?.toString() || "") };
  }
}

// ── Agent 1: Watcher — poll DB for recent errors ─────────────────────────────
function watchForErrors() {
  if (!fs.existsSync(DB_PATH)) {
    console.log("[RepairAI] DB not found yet, waiting…");
    return [];
  }
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    const cutoff = new Date(Date.now() - ERROR_WINDOW_MS).toISOString();
    const rows = db.prepare(
      `SELECT agent_name, message, metadata_json, created_at
       FROM agent_activity_logs
       WHERE level = 'error' AND created_at > ?
       ORDER BY created_at DESC LIMIT 20`,
    ).all(cutoff);
    return rows;
  } catch (e) {
    console.error("[RepairAI] DB read error:", e.message);
    return [];
  } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}

// ── Agent 2: Analyzer — identify affected files ──────────────────────────────
async function analyzeError(client, error) {
  const systemPrompt = `You are the Error Analyzer agent in an autonomous code repair system.
Your job: analyze a runtime error from an anime production platform and identify:
1. The root cause category (TypeScript error / runtime exception / API error / config error / other)
2. The 1-3 most likely source files (relative paths from the workspace root) that need to be fixed
3. A brief description of what needs to change

The codebase structure:
- artifacts/api-server/src/ — Express+TypeScript backend (handlers, providers, services, routes, db)
- artifacts/animestudioai-web/src/ — React+Vite frontend (pages, components, hooks)

Output ONLY a JSON object (no markdown):
{
  "category": "runtime_exception|typescript_error|api_error|config_error|other",
  "canAutoFix": true|false,
  "reason": "brief explanation of why/why not",
  "affectedFiles": ["relative/path/from/workspace.ts", ...],
  "diagnosis": "what is wrong in plain English"
}

canAutoFix should be false for: external API failures, missing env vars, network issues, database corruption.
canAutoFix should be true for: TypeScript errors, logic bugs, missing null checks, wrong field names, import errors.`;

  const userPrompt = `Error from agent: ${error.agent_name}
Timestamp: ${error.created_at}
Message: ${error.message}
${error.metadata_json ? `Metadata: ${error.metadata_json}` : ""}`;

  const raw = await callClaude(client, systemPrompt, userPrompt, 1024);
  try {
    const start = raw.indexOf("{");
    const end   = raw.lastIndexOf("}");
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ── Agent 3: Fixer — generate exact patch ────────────────────────────────────
async function generateFix(client, analysis, fileContents) {
  const systemPrompt = `You are the Code Fixer agent in an autonomous code repair system.
You will receive:
- A diagnosis of a bug
- The contents of the affected source files

Your task: produce EXACT replacement content for each file that needs changing.
Rules:
1. Output ONLY a JSON object (no markdown fences, no commentary).
2. Only include files you are actually changing.
3. The "content" field must be the COMPLETE new file content — not a diff, not a snippet.
4. Keep all existing functionality. Only fix the identified bug.
5. Do not add unnecessary imports, console.logs, or comments.
6. TypeScript types must be preserved or improved.

Output format:
{
  "fixes": [
    { "file": "relative/path/from/workspace.ts", "content": "...complete new file content..." }
  ],
  "explanation": "brief summary of what was changed and why"
}`;

  const filesSection = fileContents.map(({ file, content }) =>
    `=== FILE: ${file} ===\n${content || "(file not found)"}\n`
  ).join("\n");

  const userPrompt = `DIAGNOSIS: ${analysis.diagnosis}

AFFECTED FILES:
${filesSection}`;

  const raw = await callClaude(client, systemPrompt, userPrompt, 8192);
  try {
    const start = raw.indexOf("{");
    const end   = raw.lastIndexOf("}");
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ── Agent 4: Validator — check fix quality ────────────────────────────────────
async function validateFix(client, analysis, fixResult) {
  const systemPrompt = `You are the Fix Validator agent in an autonomous code repair system.
Review a proposed code fix and decide if it is safe to apply.
Output ONLY JSON: { "approve": true|false, "reason": "brief reason" }

Approve if: fix addresses the diagnosis, TypeScript-compatible, no obvious new bugs, changes are minimal.
Reject if: fix deletes important code, introduces syntax errors, has placeholder TODOs, changes unrelated functionality.`;

  const userPrompt = `DIAGNOSIS: ${analysis.diagnosis}

PROPOSED CHANGES:
${fixResult.fixes.map((f) => `File: ${f.file}\nLines changed: ${f.content.split("\n").length}`).join("\n")}

EXPLANATION: ${fixResult.explanation}`;

  const raw = await callClaude(client, systemPrompt, userPrompt, 512);
  try {
    const start = raw.indexOf("{");
    const end   = raw.lastIndexOf("}");
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { approve: false, reason: "Failed to parse validator response" };
  }
}

// ── Agent 5: Applier — write files + restart ──────────────────────────────────
function applyFix(fixResult) {
  const applied = [];
  const backups = [];
  try {
    for (const { file, content } of fixResult.fixes) {
      const absPath = path.resolve(WORKSPACE, file);
      if (!isSafeToModify(absPath)) {
        console.warn(`[RepairAI] Skipping unsafe file: ${file}`);
        continue;
      }
      // Backup original
      const backup = absPath + ".repair-backup";
      if (fs.existsSync(absPath)) {
        fs.copyFileSync(absPath, backup);
        backups.push(backup);
      }
      // Write fix
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, "utf-8");
      applied.push(file);
      console.log(`[RepairAI] ✅ Applied fix to ${file}`);
    }
    return { applied, backups };
  } catch (err) {
    // Rollback on error
    for (const backup of backups) {
      const orig = backup.replace(/\.repair-backup$/, "");
      try { fs.copyFileSync(backup, orig); } catch { /* ignore */ }
    }
    throw err;
  }
}

function cleanupBackups(backups) {
  for (const b of backups) {
    try { fs.unlinkSync(b); } catch { /* ignore */ }
  }
}

function rollbackFromBackups(backups) {
  for (const backup of backups) {
    const orig = backup.replace(/\.repair-backup$/, "");
    try {
      fs.copyFileSync(backup, orig);
      fs.unlinkSync(backup);
      console.log(`[RepairAI] ↩ Rolled back ${orig}`);
    } catch { /* ignore */ }
  }
}

// ── Main repair pipeline ──────────────────────────────────────────────────────
async function runRepairPipeline(client, error) {
  const fingerprint = `${error.agent_name}:${error.message.slice(0, 120)}`;

  if (isSeenError(fingerprint)) {
    return; // Already attempted recently
  }
  if (!canFix()) {
    console.warn("[RepairAI] Rate limit reached — skipping fix this cycle");
    return;
  }

  console.log(`\n[RepairAI] 🔍 Analyzing error from ${error.agent_name}: ${error.message.slice(0, 100)}`);
  markSeen(fingerprint);

  // ── Agent 2: Analyze ────────────────────────────────────────────────────
  const analysis = await analyzeError(client, error);
  if (!analysis) {
    console.warn("[RepairAI] Analyzer returned no result");
    return;
  }

  console.log(`[RepairAI] Category: ${analysis.category} | Can auto-fix: ${analysis.canAutoFix}`);
  console.log(`[RepairAI] Diagnosis: ${analysis.diagnosis}`);

  if (!analysis.canAutoFix) {
    console.log(`[RepairAI] ⏭ Skipping — reason: ${analysis.reason}`);
    appendRepairLog({ phase: "skipped", fingerprint, analysis });
    return;
  }

  // ── Read affected files ──────────────────────────────────────────────────
  const fileContents = (analysis.affectedFiles || []).map((file) => ({
    file,
    content: readFileSafe(path.resolve(WORKSPACE, file)),
  }));

  if (fileContents.every((f) => !f.content)) {
    console.warn("[RepairAI] None of the identified files could be read");
    return;
  }

  // ── Agent 3: Fix ─────────────────────────────────────────────────────────
  console.log(`[RepairAI] 🛠 Generating fix for: ${analysis.affectedFiles?.join(", ")}`);
  const fixResult = await generateFix(client, analysis, fileContents);
  if (!fixResult || !fixResult.fixes?.length) {
    console.warn("[RepairAI] Fixer returned no patches");
    appendRepairLog({ phase: "fix_failed", fingerprint, analysis });
    return;
  }

  console.log(`[RepairAI] Fix explanation: ${fixResult.explanation}`);

  // ── Agent 4: Validate ─────────────────────────────────────────────────────
  const validation = await validateFix(client, analysis, fixResult);
  if (!validation.approve) {
    console.warn(`[RepairAI] ❌ Validator rejected fix: ${validation.reason}`);
    appendRepairLog({ phase: "rejected", fingerprint, analysis, fixResult, validation });
    return;
  }

  console.log(`[RepairAI] ✅ Validator approved: ${validation.reason}`);

  // ── Agent 5: Apply ────────────────────────────────────────────────────────
  recordFix();
  let applied, backups;
  try {
    ({ applied, backups } = applyFix(fixResult));
  } catch (err) {
    console.error("[RepairAI] Apply error:", err.message);
    appendRepairLog({ phase: "apply_error", fingerprint, error: err.message });
    return;
  }

  if (!applied.length) {
    console.log("[RepairAI] No files were applied (all skipped)");
    return;
  }

  // ── Run TypeScript check after applying ────────────────────────────────────
  console.log("[RepairAI] 🔧 Running TypeScript check on api-server…");
  const tscBackend  = runTscCheck(API_DIR);
  const tscFrontend = runTscCheck(WEB_DIR);

  if (!tscBackend.ok || !tscFrontend.ok) {
    console.error("[RepairAI] TypeScript check failed after applying fix — rolling back");
    rollbackFromBackups(backups);
    appendRepairLog({
      phase: "rollback",
      fingerprint,
      tscBackend: tscBackend.output,
      tscFrontend: tscFrontend.output,
    });
    return;
  }

  cleanupBackups(backups);
  console.log(`[RepairAI] 🎉 Fix successfully applied and validated! Files: ${applied.join(", ")}`);
  console.log("[RepairAI] Triggering API server rebuild…");

  // Signal the API server process to rebuild by touching the build trigger file.
  try {
    const triggerFile = path.resolve(API_DIR, "data", ".repair-rebuild-trigger");
    fs.writeFileSync(triggerFile, new Date().toISOString());
  } catch { /* non-fatal */ }

  appendRepairLog({
    phase: "success",
    fingerprint,
    applied,
    explanation: fixResult.explanation,
    diagnosis: analysis.diagnosis,
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║     AnimeStudioAI — Repair AI Agent      ║");
  console.log("║  Multi-agent code self-healing service   ║");
  console.log(`║  Model: ${MODEL.padEnd(32)}║`);
  console.log("╚══════════════════════════════════════════╝\n");

  let client;
  try {
    client = buildClient();
    console.log("[RepairAI] ✅ Anthropic client initialized");
  } catch (err) {
    console.error("[RepairAI] ❌ Cannot initialize Anthropic client:", err.message);
    console.error("[RepairAI] Set AI_INTEGRATIONS_ANTHROPIC_API_KEY to enable auto-repair");
    // Poll and wait — maybe the key will appear later (provisioned dynamically).
    setTimeout(main, 60_000);
    return;
  }

  console.log(`[RepairAI] Watching for errors every ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`[RepairAI] Workspace: ${WORKSPACE}`);
  console.log(`[RepairAI] Max fixes/hour: ${MAX_FIXES_PER_HOUR}\n`);

  const poll = async () => {
    try {
      const errors = watchForErrors();
      if (errors.length > 0) {
        console.log(`[RepairAI] Found ${errors.length} recent error(s) — triaging…`);
        // Process errors sequentially (one fix at a time to be safe)
        for (const err of errors) {
          await runRepairPipeline(client, err);
        }
      }
    } catch (err) {
      console.error("[RepairAI] Poll cycle error:", err.message);
    }
    setTimeout(poll, POLL_INTERVAL_MS);
  };

  // Initial delay — give the API server 15s to start up before we start watching.
  console.log("[RepairAI] Waiting 15s for API server to start…");
  setTimeout(poll, 15_000);
}

main().catch((err) => {
  console.error("[RepairAI] Fatal:", err);
  process.exit(1);
});
