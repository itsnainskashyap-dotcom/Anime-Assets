import Database from "better-sqlite3";

const db = new Database("data/animestudio.db", { readonly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("TABLES:", tables.map(t => t.name).join(", "));

const latest = db.prepare("SELECT id, title, status, created_at FROM projects ORDER BY created_at DESC LIMIT 3").all();
console.log("\nLATEST PROJECTS:", JSON.stringify(latest, null, 2));

if (latest.length === 0) { db.close(); process.exit(0); }
const pid = latest[0].id;
console.log("\n=== Inspecting project:", pid);

for (const tname of ['job_tasks','tasks','jobs','queue_tasks','queue','agent_runs','playground_events']) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${tname})`).all();
    if (cols.length === 0) continue;
    console.log(`\n--- ${tname} (cols: ${cols.map(c=>c.name).join(',')})`);
    const rows = db.prepare(`SELECT * FROM ${tname} WHERE project_id=? ORDER BY rowid ASC`).all(pid);
    for (const r of rows) {
      const errStr = r.error ? `\n      ERR: ${String(r.error).slice(0,500)}` : '';
      const result = r.result ? `\n      RES: ${String(r.result).slice(0,200)}` : '';
      console.log(`  [${r.id||r.rowid}] ${r.type||r.kind||r.name||'?'} :: ${r.status}${errStr}${result}`);
    }
  } catch(e) {}
}

for (const t of ['scenes','characters','character_refs','environments','environment_refs','storyboard_chunks','visualization_packs','scene_visualizations','video_chunks','chunk_validations']) {
  try {
    const cnt = db.prepare(`SELECT COUNT(*) as c FROM ${t} WHERE project_id=?`).get(pid);
    console.log(`${t}: ${cnt.c}`);
  } catch(e) {
    try {
      const cnt = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get();
      console.log(`${t} (no project_id col): ${cnt.c}`);
    } catch {}
  }
}

console.log("\n--- Recent playground events ---");
const events = db.prepare(`SELECT event_type, agent, message, created_at FROM playground_events WHERE project_id=? ORDER BY created_at DESC LIMIT 25`).all(pid);
for (const e of events) {
  console.log(`  [${e.created_at}] ${e.event_type} (${e.agent||'-'}): ${(e.message||'').slice(0,200)}`);
}

console.log("\n--- Recent provider call logs (last 15) ---");
try {
  const calls = db.prepare(`SELECT provider, status_code, error_message, created_at FROM provider_call_logs ORDER BY created_at DESC LIMIT 15`).all();
  for (const c of calls) {
    const err = c.error_message ? ` ERR: ${String(c.error_message).slice(0,200)}` : '';
    console.log(`  [${c.created_at}] ${c.provider} -> ${c.status_code}${err}`);
  }
} catch(e) { console.log("provider_call_logs:", e.message); }

db.close();
