# Overview

This project is a pnpm workspace monorepo using TypeScript, focused on building AnimeStudioAI, a premium dark cinematic anime studio SaaS. The platform aims to provide a comprehensive suite of AI-powered tools for anime creation, from story generation to video production and audio direction. It targets a niche market with high-quality, AI-driven content creation capabilities.

# User Preferences

I want iterative development. I want to be asked before major changes are made to the codebase. I prefer clear and concise explanations.

# System Architecture

The project is structured as a pnpm workspace monorepo.

**Core Technologies:**
- **Monorepo Tool**: pnpm workspaces
- **Node.js**: Version 24
- **TypeScript**: Version 5.9
- **API Framework**: Express 5
- **Database**: SQLite (for `api-server` artifact) with Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API Codegen**: Orval (from OpenAPI spec)
- **Build Tool**: esbuild (CJS bundle)

**UI/UX Decisions (AnimeStudioAI web):**
The web artifact (`artifacts/animestudioai-web`) uses reusable UI primitives for consistency.
- **Loading States**: `animated-loader.tsx` for data fetches and queue polling.
- **Page Headers**: `page-header.tsx` for consistent section titles and actions.
- **Visual Selection**: `anime-poster.tsx` for visual option selection (genres, art styles, characters).
- **Artwork**: Pre-generated anime artwork is aliased via `@assets/`.
- **Animations**: Uses `framer-motion` with `easeOut` cubic-bezier for smooth transitions.
- **Navigation**: `layoutId="active-nav-pill"` for active route highlighting in `AppShell.tsx`.
- **Section Reveals**: Uses `whileInView` with `viewport={{ once: true, margin: "-80px" }}` for one-time animation on scroll.

**Technical Implementations and Features:**

- **Database Management**: SQLite via `better-sqlite3` with WAL mode and foreign keys enabled. Schema initialized from `src/db/schema.sql`.
- **Authentication**: JWT (HS256) based, with super admin bootstrapping via environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).
- **Job Queue**: Persistent worker queue using SQL-level worker locking, heartbeats, and orphan-recovery. Features include cascading terminal failures to dependent tasks and idempotency keys for production pipelines.
- **AI Integration (Providers)**:
    - **Text + Vision**: Anthropic Claude (`claude-sonnet-4-6`) for story bible, song lyrics, and chunk validation. Utilizes streaming for long responses and large `maxTokens` to avoid truncation.
    - **Image/Video/Music/TTS/SFX/Lipsync/Transcription**: Magnific HTTP API (branded as "Animax Ultra") for various media generation. Supports configurable endpoints via environment variables. Image generation uses **Google Imagen 4 Ultra** (`/v1/ai/text-to-image/imagen4-ultra`) with aspect ratio normalisation, `person_generation: allow_adult`, `safety_settings: block_only_high`, and `enhance_prompt: true`. Reference images and inference steps are not supported by Imagen 4 and are silently ignored.
    - **Vision Fallback**: Prefers Gemini 2.5 Flash/Pro, falling back to Claude vision.
    - **Demo Mode**: `DEMO_MODE=true` short-circuits providers to deterministic stubs.
    - **SSRF Guard**: `lib/safeFetch.ts` enforces scheme, host allowlist, DNS resolution, and blocks private IPs.
    - **Multi-key Failover**: `providers/registry.ts` manages multiple provider keys, implementing retries and cooldowns for failed keys.
- **Storage**: Local disk storage rooted at `STORAGE_ROOT_PATH`, served at `/storage`.
- **Payment Processing**: Razorpay integration with webhook signature verification.
- **Data Encryption**: Provider keys are AES-256-GCM encrypted using `APP_ENCRYPTION_KEY`.
- **V17 Chunk Pipeline**: `services/promptCompiler.ts` builds prompts for Magnific. `services/visualizationDirector.ts` handles image generation for video chunks. `services/referenceVideo.ts` downloads, probes, and trims video clips.
- **Audio Director**: `services/audioDirector.ts` plans dialogue, BGM, and SFX, utilizing Magnific with phonetic normalization.
- **Capability Tester**: `services/capabilityTester.ts` performs real probes for various AI capabilities, persisted to `provider_capability_tests`.
- **Export Variants**: Generates concatenated MP4, 720p MP4, 9:16 MP4, SRT, and ZIP bundles via `archiver`.
- **Song Studio Pipeline**: Six-stage pipeline for song creation: `song_lyrics_generate`, `song_music_generate`, `song_video_generate`, `song_lipsync`, and `song_export`. Enforces ownership for tasks.
- **Notifications**: Queue-driven and direct notifications persisted to `notifications` and published via SSE.
- **Live Progress Snapshots**: Every 15 seconds, active projects' task and chunk counts are snapshotted to `live_progress_snapshots`.
- **Autonomous Pipeline**: After initial project submission, stages automatically enqueue the next stage (e.g., `story_bible_generate` -> `character_generate` -> `storyboard_generate` -> `visualization_generate` -> `production_pipeline`).
- **Credit-saving Idempotency**: `enqueueStageOnce` prevents duplicate tasks and `findInflightStage` checks before debiting credits to avoid double-charging.
- **Exact-duration Selector + Parallelized Image Generation**:
    - Project wizard allows selecting target durations (short, episode, series) impacting credit cost and `estimated_seconds`.
    - `handleStoryBible` generates scene plans based on `estimated_seconds`.
    - `lib/concurrency.ts` provides a bounded-concurrency runner (`pool`) for parallel image generation tasks (e.g., character portraits, model sheets, scene visualizations).
    - `toAbsoluteUrl` ensures correct `PUBLIC_BASE_URL` usage for upstream image APIs.
- **Storyboard Composer**: `services/storyboardComposer.ts` generates a composite anime storyboard image for each 10s video chunk. This involves a two-phase pipeline:
    1. **Plan**: Claude generates shot breakdown (6-12 shots with details).
    2. **Render**: Magnific generates a grid-based storyboard image using character portraits and `start_frame_url`.
    - Storyboard generation is a mandatory gating step before video generation.
    - Storyboard sheets are prioritized in `imageRefsApi` for Kling-Omni-Pro.
    - Fix for `mime_type` requirement on `reference_images[]` in Magnific API.

# External Dependencies

- **AI Integrations**:
    - Anthropic Claude (via Replit AI Integrations proxy)
    - Magnific HTTP API (defaults to Freepik base `https://api.freepik.com`)
    - Google Gemini (optional fallback for vision)
- **Database**: PostgreSQL (for general monorepo) and SQLite (`better-sqlite3` for `api-server`).
- **Payment Gateway**: Razorpay
- **Video Processing**: `ffprobe-static`, `ffmpeg-static`
- **File Archiving**: `archiver` library

# Recent Feature Additions

- **Auto-Tab Navigation** (`ProjectDetail.tsx`): After story finalization, the UI automatically navigates to the "Characters" tab. As pipeline stages complete, the tab advances to match the current stage. A `userNavigatedRef` prevents the system from overriding manual user navigation. Animated toast notifications appear on auto-advance.
- **Repair AI Agent** (`artifacts/api-server/scripts/repairAgent.mjs`): Autonomous multi-agent code self-healing service running as its own workflow. 5-agent pipeline: Watcher (polls `agent_activity_logs` every 30s for errors) → Analyzer (Claude identifies affected files) → Fixer (Claude writes patches) → Validator (tsc --noEmit check) → Applier (writes files and restarts workflow). Rate-limited to 8 fixes/hour. Logs to `data/repair-log.jsonl`. Only modifies `.ts`/`.tsx` files inside `artifacts/`.
- **Character Generation**: Full-body 9:16 portrait as primary reference; 3 model sheets (front, three-quarter, back) also 9:16. HIGH_QUALITY_STEPS=4. All 4 images required before character is locked.
- **Story Bible Localization**: JSON structural fields in English; sampleDialogue + keyDialogue in selected voiceover language only.
- **Playground Events**: `character_generate`, `character_generated`, `character_sheet_ready`, `character_locked` events fire at correct pipeline stages.