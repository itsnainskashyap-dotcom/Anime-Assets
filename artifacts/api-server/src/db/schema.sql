-- AnimeStudioAI SQLite schema
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  credits INTEGER NOT NULL DEFAULT 0,
  plan TEXT NOT NULL DEFAULT 'free',
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS admin_user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, role_name)
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  format TEXT,
  genre TEXT,
  voice_style TEXT,
  story_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  thumbnail_url TEXT,
  estimated_credits INTEGER DEFAULT 0,
  estimated_seconds INTEGER DEFAULT 0,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  current_stage TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

CREATE TABLE IF NOT EXISTS project_settings (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  aspect_ratio TEXT DEFAULT '16:9',
  resolution TEXT DEFAULT '1080p',
  fps INTEGER DEFAULT 24,
  language TEXT DEFAULT 'en',
  json TEXT
);

CREATE TABLE IF NOT EXISTS story_bibles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT,
  themes TEXT,
  tone TEXT,
  arcs_json TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  description TEXT,
  appearance_json TEXT,
  visual_tokens TEXT,
  color_palette TEXT,
  portrait_url TEXT,
  model_sheet_front_url TEXT,
  model_sheet_three_quarter_url TEXT,
  model_sheet_back_url TEXT,
  expressions_json TEXT,
  action_pose_url TEXT,
  consistency_score REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);

CREATE TABLE IF NOT EXISTS character_refs (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  ref_type TEXT NOT NULL,
  url TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS character_consistency_locks (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL UNIQUE REFERENCES characters(id) ON DELETE CASCADE,
  locked INTEGER NOT NULL DEFAULT 0,
  approved_by TEXT,
  approved_at TEXT,
  visual_signature TEXT,
  reference_urls TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  lighting_rules TEXT,
  weather_rules TEXT,
  primary_image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS environment_refs (
  id TEXT PRIMARY KEY,
  environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  act_number INTEGER,
  title TEXT,
  description TEXT,
  shot_type TEXT,
  duration_seconds INTEGER DEFAULT 10,
  emotion TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id);

CREATE TABLE IF NOT EXISTS storyboard_chunks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id TEXT REFERENCES scenes(id) ON DELETE CASCADE,
  chunk_number INTEGER NOT NULL,
  description TEXT,
  duration_seconds INTEGER DEFAULT 10,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS visualization_packs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS scene_visualizations (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  scene_board_url TEXT,
  start_frame_url TEXT,
  end_frame_url TEXT,
  element_urls TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS video_chunks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id TEXT REFERENCES scenes(id) ON DELETE CASCADE,
  chunk_number INTEGER NOT NULL,
  duration_seconds INTEGER DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'queued',
  attempt_number INTEGER NOT NULL DEFAULT 0,
  prompt_text TEXT,
  negative_prompt_text TEXT,
  prompt_char_count INTEGER,
  provider_model_visible_name TEXT DEFAULT 'Animax Ultra',
  provider_model_hidden_id TEXT,
  generation_mode TEXT DEFAULT 'standard',
  standard_endpoint TEXT,
  reference_endpoint TEXT,
  reference_video_url TEXT,
  reference_video_trimmed_url TEXT,
  seed_frame_image_url TEXT,
  start_frame_image_url TEXT,
  end_frame_image_url TEXT,
  scene_board_image_url TEXT,
  element_1_url TEXT,
  element_2_url TEXT,
  -- Storyboard Composer: composite anime-grid storyboard image generated
  -- BEFORE video generation and used as a Kling reference image.
  storyboard_status TEXT NOT NULL DEFAULT 'pending',
  storyboard_image_url TEXT,
  storyboard_shot_count INTEGER,
  storyboard_prompt TEXT,
  storyboard_metadata_json TEXT,
  selected_shots_json TEXT,
  storyboard_generation_model TEXT,
  storyboard_generation_time_ms INTEGER,
  storyboard_error_message TEXT,
  video_url TEXT,
  audio_url TEXT,
  subtitles_url TEXT,
  validation_json TEXT,
  quality_score REAL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_chunks_project ON video_chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_chunks_scene ON video_chunks(scene_id);

CREATE TABLE IF NOT EXISTS chunk_memory (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL REFERENCES video_chunks(id) ON DELETE CASCADE,
  json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS chunk_validations (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL REFERENCES video_chunks(id) ON DELETE CASCADE,
  validator TEXT,
  passed INTEGER,
  score REAL,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS production_memory (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS memory_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent TEXT,
  event_type TEXT,
  payload_json TEXT,
  version INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_memory_events_project ON memory_events(project_id, created_at);

CREATE TABLE IF NOT EXISTS memory_conflicts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT,
  details_json TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  input_json TEXT,
  output_json TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_handoffs (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  from_agent TEXT,
  to_agent TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS job_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  scene_id TEXT,
  chunk_id TEXT,
  type TEXT NOT NULL,
  stage TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  payload_json TEXT,
  result_json TEXT,
  idempotency_key TEXT UNIQUE,
  provider_key_id TEXT,
  locked_by_worker_id TEXT,
  lock_expires_at TEXT,
  heartbeat_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  priority INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TEXT,
  finished_at TEXT,
  scheduled_for TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_job_tasks_status ON job_tasks(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_job_tasks_project ON job_tasks(project_id);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id TEXT NOT NULL REFERENCES job_tasks(id) ON DELETE CASCADE,
  depends_on_task_id TEXT NOT NULL REFERENCES job_tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_task_id)
);

CREATE TABLE IF NOT EXISTS parallel_groups (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS dependency_blockers (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES job_tasks(id) ON DELETE CASCADE,
  blocker_reason TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS playground_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  agent TEXT,
  message TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_playground_events_project ON playground_events(project_id, created_at);

CREATE TABLE IF NOT EXISTS agent_activity_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  agent_name TEXT,
  level TEXT DEFAULT 'info',
  message TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_activity_project ON agent_activity_logs(project_id, created_at);

CREATE TABLE IF NOT EXISTS live_progress_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS provider_keys (
  id TEXT PRIMARY KEY,
  provider_name TEXT NOT NULL,
  label TEXT,
  encrypted_key TEXT NOT NULL,
  masked_key TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'unknown',
  last_success_at TEXT,
  last_failure_at TEXT,
  cooldown_until TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_provider_keys_provider ON provider_keys(provider_name, enabled, priority);

CREATE TABLE IF NOT EXISTS provider_call_logs (
  id TEXT PRIMARY KEY,
  provider_name TEXT,
  provider_key_id TEXT,
  endpoint TEXT,
  status_code INTEGER,
  latency_ms INTEGER,
  success INTEGER,
  error_message TEXT,
  cost_estimate REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS provider_key_health_logs (
  id TEXT PRIMARY KEY,
  provider_key_id TEXT NOT NULL,
  status TEXT,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS provider_failover_events (
  id TEXT PRIMARY KEY,
  provider_name TEXT,
  from_key_id TEXT,
  to_key_id TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Persistent endpoint cooldowns: when a Magnific endpoint hits its daily
-- quota (429), we record an "until" timestamp so we don't re-hammer it after
-- an api-server restart wipes the in-memory cooldown registry.
CREATE TABLE IF NOT EXISTS provider_endpoint_cooldowns (
  endpoint TEXT PRIMARY KEY,
  until_ms INTEGER NOT NULL,
  reason TEXT,
  failure_count INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS provider_capability_tests (
  id TEXT PRIMARY KEY,
  provider_name TEXT,
  capability TEXT,
  passed INTEGER,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_paise INTEGER NOT NULL,
  credits INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  provider TEXT DEFAULT 'razorpay',
  provider_order_id TEXT,
  provider_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT,
  reference_id TEXT,
  reference_type TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(user_id, created_at);

CREATE TABLE IF NOT EXISTS pricing_config (
  operation TEXT PRIMARY KEY,
  credits INTEGER NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS credit_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS storage_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  asset_type TEXT,
  url TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS cleanup_queue (
  id TEXT PRIMARY KEY,
  url TEXT,
  reason TEXT,
  delete_after TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT,
  title TEXT,
  body TEXT,
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);

CREATE TABLE IF NOT EXISTS exported_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT,
  url TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS song_projects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  concept TEXT,
  language TEXT,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  music_url TEXT,
  final_video_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS song_lyrics (
  id TEXT PRIMARY KEY,
  song_id TEXT NOT NULL REFERENCES song_projects(id) ON DELETE CASCADE,
  line_number INTEGER,
  text TEXT,
  start_seconds REAL,
  end_seconds REAL
);

CREATE TABLE IF NOT EXISTS song_video_chunks (
  id TEXT PRIMARY KEY,
  song_id TEXT NOT NULL REFERENCES song_projects(id) ON DELETE CASCADE,
  chunk_number INTEGER,
  status TEXT,
  video_url TEXT,
  reference_video_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS error_library (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  category TEXT,
  message TEXT,
  resolution TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS demo_assets (
  id TEXT PRIMARY KEY,
  asset_type TEXT,
  url TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS chunk_audio_plans (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL REFERENCES video_chunks(id) ON DELETE CASCADE,
  plan_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_chunk_audio_plans_chunk ON chunk_audio_plans(chunk_id);


CREATE TABLE IF NOT EXISTS chunk_audio_plans (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL REFERENCES video_chunks(id) ON DELETE CASCADE,
  plan_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_chunk_audio_plans_chunk ON chunk_audio_plans(chunk_id);

CREATE INDEX IF NOT EXISTS idx_capability_tests_provider ON provider_capability_tests(provider_name, created_at);
CREATE INDEX IF NOT EXISTS idx_failover_provider ON provider_failover_events(provider_name, created_at);
