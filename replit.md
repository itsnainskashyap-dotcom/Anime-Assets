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
    lyrics, and chunk validation (vision).
  - **Image / Video / Music / TTS / SFX / Lipsync / Transcription**: Magnific
    HTTP API (defaults to Freepik base `https://api.freepik.com`,
    `x-freepik-api-key` header). All endpoints are configurable via env vars
    (`MAGNIFIC_*_ENDPOINT`). Outputs are mirrored into local `/storage` so the
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
  `/api/notifications`, `/api/payments`, `/api/admin`, plus `/api/healthz`.
- **Encryption**: Provider keys are AES-256-GCM encrypted using
  `APP_ENCRYPTION_KEY` (see `lib/crypto.ts`).
