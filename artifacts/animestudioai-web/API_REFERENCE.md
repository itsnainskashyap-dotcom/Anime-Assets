# AnimeStudioAI API Reference (for the frontend)

The Express API is mounted at `/api`. Use the relative base `import.meta.env.BASE_URL + 'api'` (which resolves to `/api`) so the proxy routes correctly.

Auth: JWT bearer token returned by `POST /api/auth/login` and `POST /api/auth/register`. Send as `Authorization: Bearer <token>` on every protected request. Persist in localStorage.

User shape (from `/api/auth/me`):
`{ id: string, email: string, displayName: string|null, credits: number, isAdmin: boolean, roles: string[] }`

## Public

| Method | Path                            | Body / Query                                  | Notes |
|--------|---------------------------------|-----------------------------------------------|-------|
| GET    | `/api/healthz`                  | —                                             | `{ status: "ok" }` |
| POST   | `/api/auth/register`            | `{ email, password, displayName? }`           | returns `{ token, user }` |
| POST   | `/api/auth/login`               | `{ email, password }`                         | returns `{ token, user }` |
| POST   | `/api/auth/logout`              | —                                             | best-effort |
| GET    | `/api/auth/me`                  | —                                             | returns `user` |
| GET    | `/api/payments/credit-packs`    | —                                             | array of `{ id, name, credits, price_paise, currency, bonus_credits }` |

## Projects (auth required)

| Method | Path                                          | Body / Notes                                   |
|--------|-----------------------------------------------|------------------------------------------------|
| POST   | `/api/projects`                               | `{ title, format, genres[], voice, storyPrompt, durationLabel }` |
| GET    | `/api/projects`                               | list                                           |
| GET    | `/api/projects/:id`                           | detail                                          |
| DELETE | `/api/projects/:id`                           | —                                              |
| POST   | `/api/projects/:id/story-bible/generate`      | enqueue story bible job                        |
| POST   | `/api/projects/:id/story-bible/approve`       | gate                                           |
| POST   | `/api/projects/:id/characters/generate`       | enqueue characters job                         |
| POST   | `/api/projects/:id/characters/approve-lock`   | locks the consistency canon                    |
| POST   | `/api/projects/:id/storyboard/generate`       | enqueue storyboard job                         |
| POST   | `/api/projects/:id/visualization/generate`    | enqueue visualization pack job                 |
| POST   | `/api/projects/:id/cost-estimate`             | returns `{ credits, etaMinutes }`              |
| POST   | `/api/projects/:id/production/start`          | begin chunk production                         |
| POST   | `/api/projects/:id/production/pause`          | —                                              |
| POST   | `/api/projects/:id/production/resume`         | —                                              |
| POST   | `/api/projects/:id/production/cancel`         | —                                              |
| GET    | `/api/projects/:id/production/status`         | `{ stage, progress, scenesComplete, chunksComplete, etaMs, etc. }` |
| GET    | `/api/projects/:id/chunks`                    | array of chunks `{ id, sceneId, index, status, progress, durationSec, prompt, videoUrl, startImageUrl, endImageUrl }` |
| GET    | `/api/projects/:id/playground/events`         | **SSE stream** (`text/event-stream`). First event is `event: history` with `{ events, agentLogs }`; subsequent events are `event: playground` and `event: agent_log`. Reconnect on close. |
| GET    | `/api/projects/:id/agents`                    | agent runs list                                |
| GET    | `/api/projects/:id/memory`                    | shared production memory snapshot              |

## Chunks (auth required)

| Method | Path                                                | Body / Notes                                |
|--------|------------------------------------------------------|---------------------------------------------|
| POST   | `/api/chunks/:id/retry`                              | retry chunk generation                      |
| GET    | `/api/chunks/:id/visualization-pack`                 | start/end frames + scene board references   |
| GET    | `/api/chunks/:id/reference-video`                    | returns the previous chunk's reference clip |
| POST   | `/api/chunks/:id/reference-video`                    | `{ url }` set by URL                        |
| POST   | `/api/chunks/:id/reference-video/upload` (multipart) | field `file` (mp4 ≤ 25 MB)                  |

## Song mode (auth required)

| Method | Path                                                  | Notes |
|--------|-------------------------------------------------------|-------|
| POST   | `/api/projects/:projectId/song/create`                | `{ title, lyricsConcept, durationSeconds }` |
| POST   | `/api/song/:songId/generate-lyrics`                   | enqueue |
| POST   | `/api/song/:songId/generate-music`                    | enqueue |
| POST   | `/api/song/:songId/generate-video`                    | enqueue |
| POST   | `/api/song/:songId/lipsync`                           | enqueue |
| POST   | `/api/song/:songId/export`                            | enqueue |
| GET    | `/api/song/:songId`                                   | detail |
| GET    | `/api/song/:songId/chunks`                            | chunks |

## Notifications (auth required)

| GET  | `/api/notifications`           | list        |
| POST | `/api/notifications/:id/read`  | mark read   |

## Payments (auth required for create/history)

| GET  | `/api/payments/credit-packs`   | public      |
| POST | `/api/payments/create-order`   | `{ packId }` returns `{ orderId, amount_paise, currency, razorpayKeyId }` |
| POST | `/api/payments/webhook`        | server-only (do not call from frontend) |
| GET  | `/api/payments/history`        | list of payment_orders for the user |

## Admin (auth + admin role required)

All under `/api/admin/`. Roles: `read_only`, `support`, `operations`, `finance`, `super_admin`. The frontend should hide/disable actions the user lacks the role for (compare against `user.roles`).

| Method | Path                                                | Required role | Notes |
|--------|------------------------------------------------------|---------------|-------|
| GET    | `/api/admin/dashboard`                              | read          | KPI counts + recent jobs |
| GET    | `/api/admin/users`                                   | support       | |
| GET    | `/api/admin/projects`                                | support       | |
| GET    | `/api/admin/jobs?status=&limit=`                    | read          | |
| POST   | `/api/admin/jobs/:id/{retry,cancel,pause,resume}`   | operations    | |
| GET    | `/api/admin/provider-keys`                           | read          | masked |
| POST   | `/api/admin/provider-keys`                           | operations    | `{ providerName, key, label?, priority? }` |
| PATCH  | `/api/admin/provider-keys/:id`                      | operations    | |
| POST   | `/api/admin/provider-keys/:id/{test,enable,disable,set-priority}` | operations | |
| GET    | `/api/admin/provider-health`                         | read          | per-provider uptime |
| GET    | `/api/admin/provider-capability-tests`               | read          | |
| POST   | `/api/admin/provider-capability-tests/run`           | operations    | |
| GET    | `/api/admin/failover-events`                         | read          | |
| GET    | `/api/admin/failed-generations`                      | read          | |
| GET    | `/api/admin/billing`                                 | finance       | revenue, recent orders |
| POST   | `/api/admin/refund`                                  | finance       | `{ userId, credits, reason }` |
| GET    | `/api/admin/pricing-config`                          | finance       | |
| POST   | `/api/admin/pricing-config`                          | finance       | `{ operation, credits, description? }` |
| GET    | `/api/admin/storage`                                 | read          | |
| GET    | `/api/admin/audit-logs`                              | read          | |
| GET    | `/api/admin/song-ops`                                | support       | |
| GET    | `/api/admin/agent-runs`                              | support       | |
| GET    | `/api/admin/memory-conflicts`                        | support       | |
| GET    | `/api/admin/error-library`                           | read          | |
| POST   | `/api/admin/error-library`                           | operations    | |

## SSE event shapes

`event: history` — `{ events: PlaygroundEvent[], agentLogs: AgentLog[] }`
`event: playground` — `PlaygroundEvent`
`event: agent_log` — `AgentLog`

```ts
type PlaygroundEvent = {
  id: string;
  event_type: string;       // e.g. "stage_started" | "stage_completed" | "chunk_progress" | "agent_message"
  agent: string | null;     // e.g. "AI Director" | "Visual Engine" | "Production Engine"
  message: string;
  payload_json: string | null;
  created_at: string;       // ISO
};

type AgentLog = {
  id: string;
  agent_name: string;
  level: "info" | "warn" | "error";
  message: string;
  metadata_json: string | null;
  created_at: string;
};
```

EventSource note: pass auth via querystring (`?token=...`) or, since EventSource doesn't support headers, use `EventSource(`/api/projects/${id}/playground/events`)` with credentials and rely on a parallel `Authorization` cookie OR poll-fall-back. The SIMPLEST approach: use `fetch` + `ReadableStream` (the `@microsoft/fetch-event-source` library is great here, but plain fetch + ReadableStreamDefaultReader works too) so the bearer header can be sent.

## Error responses

`{ error: string }` with HTTP 400/401/402/403/404/409/415/429/500. 402 = insufficient credits.

## Razorpay payment flow

1. POST `/api/payments/create-order` -> `{ orderId, amount_paise, currency, razorpayKeyId }`
2. Open Razorpay Checkout JS (`https://checkout.razorpay.com/v1/checkout.js`) with that order.
3. Server captures via webhook; poll `/api/payments/history` or refetch `/api/auth/me` for updated balance.
