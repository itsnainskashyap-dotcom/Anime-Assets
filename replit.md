# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## AnimeStudioAI (artifacts/api-server)

A premium dark cinematic anime studio SaaS being built per the V17 master prompt
(`attached_assets/AnimeStudioAI_V17_FULL_FINAL_REPLIT_MASTER_PROMPT_*.md`). The
api-server artifact intentionally diverges from the workspace defaults:

- **Database**: SQLite via `better-sqlite3` (mandated by spec, not Postgres). DB
  file lives at `artifacts/api-server/data/animestudio.db` and is initialised
  from `src/db/schema.sql` on first boot. WAL mode + foreign keys enabled.
- **Auth**: JWT (HS256) issued by `routes/auth.ts`, verified by
  `middleware/auth.ts`. Bootstrap a super admin via the `ADMIN_EMAIL` and
  `ADMIN_PASSWORD` env vars.
- **Job queue**: Persistent worker queue in `services/queue.ts` and
  `jobs/queueWorker.ts` using SQL-level worker locking (UPDATE … WHERE
  locked_by_worker_id IS NULL), heartbeats, and an orphan-recovery sweeper.
- **Providers** (`src/providers/*.ts`): Real AI integrations.
  - **Text + Vision**: Anthropic Claude (`claude-sonnet-4-6`) via the Replit AI
    Integrations proxy. Reads `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` /
    `AI_INTEGRATIONS_ANTHROPIC_API_KEY`. Used for the story bible, song
    lyrics, and chunk validation (vision). `textProvider.ts` calls
    `client.messages.stream(...).finalMessage()` (NOT `messages.create`)
    because Anthropic now requires streaming for any request that may exceed
    the 10-minute timeout. Long JSON responses (story bible) use
    `maxTokens: 32768` in `jobs/handlers.ts` to avoid truncation.
  - **Image / Video / Music / TTS / SFX / Lipsync / Transcription**: Magnific
    HTTP API (defaults to Freepik base `https://api.freepik.com`,
    `x-freepik-api-key` header). All endpoints are configurable via env vars
    (`MAGNIFIC_*_ENDPOINT`). The Freepik nano-banana-pro endpoint expects
    `reference_images` as an array of `{ image: "<base64>" }` objects (not
    bare URL strings); `imageProvider.ts` downloads each reference URL via
    `safeFetch`, base64-encodes it, and caches the result in a small
    URL-keyed LRU/TTL map (`refCache`, 64 entries × 10 min) to avoid
    re-fetching the same character/anchor frame across the ~145 wave-2
    requests per project. Outputs are mirrored into local `/storage` so the
    UI never has to hit a third-party CDN. Magnific is masked behind the
    visible name "Animax Ultra"; Claude is masked as the in-house "Story
    Director", "Character Director", etc.
  - `DEMO_MODE=true` short-circuits every provider to deterministic stubs so
    the app boots without any API keys.
  - **SSRF guard**: All outbound asset fetches go through `lib/safeFetch.ts`,
    which enforces an http(s) scheme, a host allowlist (env
    `SAFE_FETCH_ALLOW_HOSTS` extends defaults), DNS-resolves the host and
    blocks RFC1918 / loopback / link-local / multicast addresses, and follows
    redirects manually re-validating each hop.
- **Queue safety**: `services/queue.ts` cascades terminal failures to all
  dependent tasks via `cascadeFailDependents`, and unknown stages throw in
  `runHandler` instead of silently completing. Video chunk handler throws
  (rather than completing) when the provider has not yet returned a URL, so the
  retry/backoff path is used. Production-pipeline idempotency keys are derived
  from the chunk `attempt_number` instead of `Date.now()` so duplicate starts
  are deduplicated.
- **Storage / billing**: Local disk storage rooted at
  `STORAGE_ROOT_PATH` (served at `/storage`); Razorpay payment provider with
  webhook signature verification.
- **Routes**: `/api/auth`, `/api/projects`, `/api/chunks`, `/api/song`,
  `/api/notifications`, `/api/payments`, `/api/admin`, plus `/api/healthz`
  and `/api/health` (returns `{ demoMode, engineLabel: "Animax Ultra" }`).
- **Encryption**: Provider keys are AES-256-GCM encrypted using
  `APP_ENCRYPTION_KEY` (see `lib/crypto.ts`).
- **V17 chunk pipeline**: `services/promptCompiler.ts` builds 2200-char
  Magnific prompts with character/env locks and the `@Video1` token in
  reference-video mode. `services/visualizationDirector.ts` issues distinct
  calls for the 5-image pack (seed/scene_board/start/end/element_1/2) and
  fills every column on `video_chunks`. `services/referenceVideo.ts` uses
  `ffprobe-static` + `ffmpeg-static` to download/probe/trim the previous
  chunk's clip to ≤10s and persist it to local storage; chunk N>1 is forced
  into `generation_mode='reference_video'`, queued sequentially via
  `dependsOn: [prevTaskId]`, and auto-enqueues `audio_chunk_generate`,
  `validation`, and `reference_video_trim` follow-ups.
- **Audio Director** (`services/audioDirector.ts`): plans dialogue + BGM +
  SFX per chunk through Claude, then renders with Magnific via a
  Hinglish-aware phonetic normalizer (`services/phoneticNormalizer.ts`).
- **Multi-key failover** (`providers/registry.ts`): `getActiveKey` returns
  `{id, key, source}`; `recordKeyError` bumps `error_count`, sets
  `cooldown_until` on 401/403/429/5xx, and logs a row to
  `provider_failover_events`. `withFailover` retries with the next key.
- **Vision fallback** (`providers/visionProvider.ts`): prefers Gemini 2.5
  Flash (or Pro for `highAccuracy`) when `GOOGLE_API_KEY`/`GEMINI_API_KEY`
  is configured; falls back to Claude vision otherwise.
- **Capability tester** (`services/capabilityTester.ts`): real probes for
  text, vision, image, text-to-video, image-to-video,
  reference-video-token (@Video1), prompt-budget, native-audio,
  multi-shot. Persisted to `provider_capability_tests`. Triggered by
  `POST /api/admin/provider-capability-tests/run`.
- **Export variants**: `handleExport` produces concat MP4, 720p MP4, 9:16
  MP4, an SRT generated from `chunk_audio_plans`, and a ZIP bundle (via
  `archiver`) — all rows recorded in `exported_files`.
- **UI cues** (`AppShell` + `ChunkInspector`): Demo Mode badge sourced
  from `/api/health`, and a "Reference Video" pill on chunks whose
  `generation_mode='reference_video'`.
- **Song Studio pipeline** (`jobs/handlers.ts`): six stages —
  `song_lyrics_generate` (Song Bible + Lyrics Timing Agent: writes
  `song_projects` + per-line `song_lyrics` rows with second-precise timing),
  `song_music_generate` (writes `song_projects.music_url`),
  `song_video_generate` (creates `song_video_chunks` rows + enqueues one
  internal `song_chunk_video` per 10s segment), `song_lipsync` (per-chunk
  Magnific lipsync), and `song_export` (SRT from `song_lyrics`, persists
  `final_video_url`, fires user notification). All stages enforce
  ownership via `loadSongForTask(task)` /
  `loadOwnedSongById(songId, userId, projectId)` to prevent cross-user
  songId tampering.
- **Notification fan-out** (`services/notifications.ts` +
  `handleNotification`): both queue-driven and direct callers persist to
  `notifications` and publish an SSE `notification` event on the project
  channel.
- **Live progress snapshots** (`jobs/queueWorker.ts:snapshotLoop`): every
  15 s, every active project (`status` in queued/generating/validating/
  exporting/production_locked) gets a JSON snapshot of task + chunk
  counts written to `live_progress_snapshots`, trimmed to the last 200
  per project via SQLite `ROW_NUMBER() OVER (PARTITION BY project_id)`.
- **Workflows are artifact-managed**: both servers run via the
  artifact-defined workflows `artifacts/api-server: API Server` (port
  8080) and `artifacts/animestudioai-web: web` (port 18134). Do NOT
  add manual `[[workflows.workflow]]` blocks in `.replit` for these
  services — they will collide on the same ports and one set will
  appear FAILED. The api-server's `[services.development].run` uses
  `sh -c 'PUBLIC_BASE_URL=https://${REPLIT_DEV_DOMAIN} pnpm ...'` so
  the public URL is injected for Magnific asset fetches; the web
  artifact's `[services.env]` supplies `PORT=18134` and `BASE_PATH=/`.
- **Fully autonomous pipeline** (`jobs/handlers.ts`): when the user
  submits the create-project wizard, `CreateProject.handleSubmit` POSTs
  to `/story-bible/generate` once. From there, every stage handler
  enqueues the next stage on success — `story_bible_generate ➜
  character_generate ➜ storyboard_generate ➜ visualization_generate ➜
  production_pipeline`. The user does not click any "Generate" button
  to advance the pipeline; only `production/start`,
  `story-bible/approve`, and `characters/approve-lock` remain as
  optional manual gates.
- **Credit-saving idempotency** (`services/queue.ts` +
  `routes/projects.ts`): all auto-chain enqueues use the new
  `enqueueStageOnce({ projectId, type, ... })` helper which checks
  `findInflightStage(projectId, type)` first. If a same-(project,type)
  task is in `queued|in_progress|processing|paused`, the existing task
  is returned and no new task is created. Manual generate routes
  (`story-bible/generate`, `characters/generate`,
  `storyboard/generate`, `visualization/generate`,
  `production/start`) call `findInflightStage` BEFORE
  `debitCredits(...)` and short-circuit with HTTP 202
  `{ deduped: true }` when an in-flight task exists, preventing
  double-debit on double-clicks. After a stage completes,
  `enqueueStageOnce` does NOT use a stable idempotency key, so a fresh
  manual click after completion legitimately starts a new run. Race-free
  in our single-Node + better-sqlite (synchronous) runtime; would need a
  DB-level uniqueness constraint if horizontally scaled.
- **Exact-duration selector + parallelized image generation**
  (`routes/projects.ts`, `jobs/handlers.ts`, `services/visualizationDirector.ts`,
  `lib/concurrency.ts`, `pages/app/CreateProject.tsx`):
  - The wizard now exposes per-format duration buttons
    (short: 1/2/3 min · episode: 20/22/24 min · series: 3–6 episodes)
    with per-option credit cost. The chosen `targetSeconds` is sent
    on POST and persisted to `projects.estimated_seconds`. The route
    also accepts both `genres[]`/`genre` and `voice`/`voiceStyle`
    aliases — earlier the wizard's `genres` array was silently
    dropped, leaving every project with `genre=null`.
  - `handleStoryBible` reads `estimated_seconds` and derives a
    target-aware scene plan: `short ≤180s` → 5–20 s × 4–15 scenes;
    `episode ≤1800s` → 30–90 s × 12–30 scenes; `series >1800s` →
    60–300 s × 25–40 scenes. The Claude prompt and the DB scene-insert
    clamp both use the band, so the planner can actually hit the
    requested target. The route caps `targetSeconds` at 12000 (the
    band ceiling).
  - `lib/concurrency.ts` exports `pool(items, limit, fn)` — a tiny
    bounded-concurrency runner. `handleCharacterGenerate` runs
    portraits in a 4-wide pool; then 3 model-sheet angles per
    character in a 6-wide pool, each one passing the just-generated
    portrait as `referenceUrls` so face/outfit stay on-model across
    angles. `handleVisualization` runs scenes in a 2-wide pool, and
    `buildVisualizationPack` does Wave 1 (`seed_frame` + `start_frame`
    in parallel) then Wave 2 (`end_frame`/`scene_board`/`element_1`/
    `element_2` in parallel), all of Wave 2 anchored to `start_frame`
    so the scene's environment, lighting, and palette stay consistent
    across all six images.
  - `toAbsoluteUrl(...)` in both handlers and visualizationDirector
    drops `/storage/...` refs when `PUBLIC_BASE_URL` is unset —
    passing a relative URL the upstream image API can't fetch was
    silently degrading consistency.
