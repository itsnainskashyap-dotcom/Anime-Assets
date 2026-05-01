# CREATE A FULL-STACK PRODUCTION APP — AnimeStudioAI V17 FINAL MASTER PROMPT

Build a complete production-ready full-stack SaaS web application named **AnimeStudioAI** on Replit.

This is the final master prompt. It includes everything from the beginning of the AnimeStudioAI planning process up to the latest research and corrections:
- full website and app UI
- full backend
- database schema
- server-side autonomous generation
- persistent queue
- background workers
- all agent behavior and system prompts
- Shared Production Memory / Continuity Brain
- Character Consistency Lock
- Nano Banana Pro image generation
- Gemini 2.5 Flash / Gemini 2.5 Pro vision validation
- Magnific API provider adapters
- `kling-v3-omni-pro` as the real hidden video model
- `Animax Ultra` as the user-facing video engine name
- Kling 3 Omni Pro reference-to-video workflow
- previous chunk video URL as `video_url` reference for next chunks
- `@Video1` prompt reference for video-to-video continuity
- 10-second chunks for safe reference-video compatibility
- song mode
- audio / Hinglish pronunciation
- admin panel
- multi API key failover
- billing and credits
- storage and export
- Studio Playground
- production hardening
- demo mode
- Replit execution order
- final acceptance checklist

Do not build only a landing page. Do not build only a prompt generator. Do not create a mock UI without backend. This must be a real full-stack app with working routes, database, queue, admin tools, state persistence, and extensible provider adapters.

---

# 0. REPLIT AGENT EXECUTION RULES

You are building the actual application, not describing it.

Build in phases, but keep everything connected:

1. Scaffold app structure.
2. Create database schema and migrations.
3. Implement auth and roles.
4. Build public website.
5. Build user app pages.
6. Build admin panel.
7. Build Shared Production Memory.
8. Build agents and system prompts.
9. Build persistent queue and workers.
10. Build provider adapters.
11. Build image generation pipeline.
12. Build video generation pipeline with reference-video support.
13. Build Gemini validation pipeline.
14. Build billing and credits.
15. Build storage and export.
16. Build Studio Playground live status.
17. Add error states, demo mode, logs, and testing pages.

If an API key is missing, do not fake success. Show a clear setup error, keep Demo Mode available, and provide admin capability tests.

Use clean production-ready code. Keep the app runnable in Replit.

---

# 1. PRODUCT IDENTITY

App name: **AnimeStudioAI**

User-facing video engine name: **Animax Ultra**

Hidden actual video model ID: **kling-v3-omni-pro**

Image generation model: **nano-banana-pro** through a Freepik/Magnific-compatible image provider adapter.

Vision validation model:
- default fast validation: `gemini-2.5-flash`
- high accuracy validation: `gemini-2.5-pro`
- experimental optional validation: `gemini-3-pro-preview`, only if available and enabled by admin

Important naming rule:
- Users must only see **Animax Ultra** as the video engine.
- The hidden model ID `kling-v3-omni-pro` may appear only inside internal provider config, provider adapter code, capability tests, and admin technical diagnostics.
- Normal user UI, marketing pages, project exports, and user-facing status messages must not expose raw provider/model names.

Correct user-facing text:
- “Animax Ultra is preparing your cinematic chunk.”
- “Animax Ultra render completed.”
- “Production Engine is generating video.”
- “Visual Engine is creating scene references.”
- “Using previous video as continuity reference.”

Incorrect user-facing text:
- “Kling is generating.”
- “kling-v3-omni-pro started.”
- “Magnific endpoint called.”

---

# 2. CORE PRODUCT GOAL

Build AnimeStudioAI as a premium AI anime production studio.

Users can enter:
- simple idea
- story prompt
- script
- uploaded document
- lyrics concept
- music video idea

The platform autonomously creates:
- story bible
- character canon
- Character Consistency Lock
- environment canon
- storyboard
- cinematic scene-board images
- first scene seed frame
- start/end frames
- element reference images
- 10-second video chunks
- next-chunk continuity using previous chunk video URL
- native audio / voiceover where supported
- Hinglish/Hindi pronunciation-safe dialogue
- final stitched anime video
- anime song/music video up to 3 minutes
- subtitles / lyrics files
- project ZIP export
- admin monitoring
- billing and credit management

The app must be fully server-side and autonomous. If the user closes the tab, logs out, refreshes, loses internet, or switches devices, generation must continue on the server.

---

# 3. TECH STACK

Use:

```txt
Frontend: React 18 + Vite
Styling: Tailwind CSS + shadcn/ui + Framer Motion
Backend: Node.js + Express
Database: SQLite using better-sqlite3 for Replit
Auth: JWT + bcrypt
Realtime: Server-Sent Events (SSE)
Queue: persistent SQLite-backed task queue
Uploads: multer
Video processing: FFmpeg + fluent-ffmpeg + ffmpeg-static
Storage: local-first storage adapter, object-storage-ready
Payments: Razorpay
State: frontend state is only a viewer/cache; backend database is source of truth
```

Generation state must never depend on the frontend session.

---

# 4. ENVIRONMENT VARIABLES

Use Replit Secrets.

```env
# =========================
# App
# =========================
APP_NAME=AnimeStudioAI
APP_ENV=production
APP_BASE_URL=
DEMO_MODE=false

# =========================
# Auth / Security
# =========================
JWT_SECRET=
SESSION_KEY=
APP_ENCRYPTION_KEY=
ADMIN_EMAIL=
ADMIN_PASSWORD=

# =========================
# Text / Agent Planning
# =========================
ANTHROPIC_API_KEY=
TEXT_MODEL=claude-sonnet-4-6

# =========================
# Image Generation
# =========================
IMAGE_PROVIDER=freepik_or_magnific
IMAGE_MODEL=nano-banana-pro
IMAGE_MODEL_FAST=nano-banana-pro-flash
FREEPIK_API_KEY=
MAGNIFIC_API_KEY=
IMAGE_PROMPT_MAX_CHARS=1000

# =========================
# Video Generation
# =========================
VIDEO_PROVIDER=magnific
VIDEO_MODEL_HIDDEN=kling-v3-omni-pro
VISIBLE_VIDEO_MODEL_NAME=Animax Ultra
VIDEO_STANDARD_ENDPOINT=/v1/ai/video/kling-v3-omni-pro
VIDEO_REFERENCE_ENDPOINT=/v1/ai/reference-to-video/kling-v3-omni-pro
VIDEO_DURATION_SECONDS=10
VIDEO_PROMPT_MAX_CHARS=2500
VIDEO_TARGET_PROMPT_CHARS=2200
VIDEO_DEFAULT_ASPECT_RATIO=16:9
VIDEO_DEFAULT_CFG_SCALE=0.5
VIDEO_USE_NATIVE_AUDIO=true

# =========================
# Vision / OCR / Validation
# =========================
GOOGLE_API_KEY=
VISION_MODEL=gemini-2.5-flash
OCR_MODEL=gemini-2.5-flash
HIGH_ACCURACY_VISION_MODEL=gemini-2.5-pro
EXPERIMENTAL_BEST_VISION_MODEL=gemini-3-pro-preview
TRANSCRIPTION_PROVIDER=whisper_or_equivalent
TRANSCRIPTION_MODEL=hindi-hinglish-best

# =========================
# Fallback Audio / Song Mode
# =========================
TTS_PROVIDER=magnific
TTS_API_KEY=
MUSIC_PROVIDER=magnific
MUSIC_API_KEY=
SFX_PROVIDER=magnific
SFX_API_KEY=
LIPSYNC_PROVIDER=magnific
LIPSYNC_MODEL=latent-sync
AUDIO_ISOLATION_PROVIDER=magnific
AUDIO_ISOLATION_MODEL=sam-audio
SONG_MODE_MAX_SECONDS=180
SONG_CHUNK_SECONDS=10

# =========================
# Payments
# =========================
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
PAYMENT_PROVIDER=razorpay

# =========================
# Storage
# =========================
STORAGE_PROVIDER=local
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET=
STORAGE_PUBLIC_URL=
```

If an exact model ID is unavailable, the provider capability test must surface a clear admin error and allow the admin to update the model ID. Never silently pretend an unavailable model worked.

---

# 5. SERVER-SIDE AUTONOMOUS GENERATION

All production tasks run server-side:
- story generation
- character generation
- environment generation
- image generation
- video generation
- validation
- retries
- stitching
- exports
- billing updates
- notifications
- provider failover
- cleanup

User may:
- log out
- close browser
- refresh
- switch devices
- lose internet
- return later

Jobs must continue and recover through the persistent queue.

Frontend role:
- start jobs
- pause/resume/cancel
- approve gates
- watch progress
- reconnect via SSE
- inspect outputs
- download exports

Frontend must not own job execution state.

---

# 6. PROVIDER ARCHITECTURE

Create provider adapters.

```txt
server/providers/
  registry.js
  textProvider.js
  imageProvider.js
  videoProvider.js
  magnificProvider.js
  freepikProvider.js
  visionProvider.js
  transcriptionProvider.js
  ttsProvider.js
  musicProvider.js
  soundEffectsProvider.js
  lipSyncProvider.js
  paymentProvider.js
  storageProvider.js
```

Do not hardcode provider calls inside agents. Agents produce structured payloads; provider adapters execute API calls.

---

# 7. VIDEO PROVIDER CAPABILITIES

Create `server/providers/magnificCapabilities.js`.

```js
const MAGNIFIC_CAPABILITIES = {
  provider: 'magnific',
  visibleModelName: 'Animax Ultra',
  hiddenModelId: 'kling-v3-omni-pro',

  supportsTextToVideo: true,
  supportsImageToVideo: true,
  supportsVideoReference: true,

  standardVideoEndpoint: '/v1/ai/video/kling-v3-omni-pro',
  referenceVideoEndpoint: '/v1/ai/reference-to-video/kling-v3-omni-pro',

  referenceVideoPromptToken: '@Video1',
  referenceVideoMinDurationSeconds: 3,
  referenceVideoMaxDurationSeconds: 10,

  outputDurationSeconds: 10,
  maxVideoDurationSeconds: 15,

  promptMaxChars: 2500,
  targetPromptChars: 2200,

  supportsStartImage: true,
  supportsReferenceStartImage: true,
  supportsImageUrlInReferenceMode: true,

  supportsElements: true,
  requiredExtraElementImageWhenUsingElements: true,

  supportsEndImageInStandardSingleScene: true,
  supportsEndImageWithMultiPrompt: false,
  supportsEndImageWithReferenceVideo: false,

  supportsMultiShot: true,
  maxMultiShots: 6,

  nativeAudio: true,
  aspectRatios: ['auto', '16:9', '9:16', '1:1'],

  cfgScaleDefault: 0.5,
  cfgScaleMin: 0,
  cfgScaleMax: 1
};

module.exports = MAGNIFIC_CAPABILITIES;
```

Important:
- Use standard endpoint for first chunk of a scene.
- Use reference-to-video endpoint for later chunks if `reference_video_url` exists.
- When using reference-to-video, include `video_url` and reference it in prompt as `@Video1`.
- Reference video must be 3–10 seconds.
- Use 10-second chunks so previous chunk is always a valid reference.
- Do not pass a 15-second reference video.
- If the generated previous chunk exceeds 10 seconds for any reason, trim it to a 10-second continuity reference clip before using it.
- When using elements, provide extra element images distinct from the start image.
- Do not send `end_image_url` in reference-to-video mode unless capability tests prove it is supported.
- Do not send `end_image_url` in multi-prompt mode.

---

# 8. MAGNIFIC PROVIDER ADAPTER

Create `server/providers/magnificProvider.js`.

```js
const MAGNIFIC_CAPABILITIES = require('./magnificCapabilities');

function assertPromptLimit(prompt) {
  if ((prompt || '').length > MAGNIFIC_CAPABILITIES.promptMaxChars) {
    throw new Error(`Prompt exceeds ${MAGNIFIC_CAPABILITIES.promptMaxChars} chars`);
  }
}

function buildStandardVideoPayload(task) {
  assertPromptLimit(task.prompt);

  const body = {
    prompt: task.prompt,
    negative_prompt: task.negativePrompt,
    duration: String(task.durationSeconds || 10),
    aspect_ratio: task.aspectRatio || '16:9',
    cfg_scale: task.cfgScale ?? MAGNIFIC_CAPABILITIES.cfgScaleDefault
  };

  if (task.startImageUrl) body.image_url = task.startImageUrl;
  if (task.webhookUrl) body.webhook_url = task.webhookUrl;

  return body;
}

function buildReferenceVideoPayload(task) {
  assertPromptLimit(task.prompt);

  if (!task.referenceVideoUrl) {
    throw new Error('referenceVideoUrl is required for reference-to-video mode');
  }

  if (!task.prompt.includes('@Video1')) {
    throw new Error('Reference-video prompt must include @Video1');
  }

  const body = {
    video_url: task.referenceVideoUrl,
    prompt: task.prompt,
    negative_prompt: task.negativePrompt,
    duration: String(task.durationSeconds || 10),
    aspect_ratio: task.aspectRatio || '16:9',
    cfg_scale: task.cfgScale ?? MAGNIFIC_CAPABILITIES.cfgScaleDefault
  };

  if (task.startImageUrl) body.image_url = task.startImageUrl;
  if (task.webhookUrl) body.webhook_url = task.webhookUrl;

  return body;
}

async function generateStandardVideo(task, apiKey) {
  const payload = buildStandardVideoPayload(task);
  const url = `${process.env.MAGNIFIC_API_BASE || 'https://api.magnific.com'}${MAGNIFIC_CAPABILITIES.standardVideoEndpoint}`;
  return postJson(url, payload, apiKey);
}

async function generateReferenceVideo(task, apiKey) {
  const payload = buildReferenceVideoPayload(task);
  const url = `${process.env.MAGNIFIC_API_BASE || 'https://api.magnific.com'}${MAGNIFIC_CAPABILITIES.referenceVideoEndpoint}`;
  return postJson(url, payload, apiKey);
}

async function runVideoGeneration(task, apiKey) {
  if (task.referenceVideoUrl) {
    return generateReferenceVideo(task, apiKey);
  }
  return generateStandardVideo(task, apiKey);
}

module.exports = {
  runVideoGeneration,
  generateStandardVideo,
  generateReferenceVideo,
  buildStandardVideoPayload,
  buildReferenceVideoPayload
};
```

---

# 9. IMAGE PROVIDER: FREEPIK / NANO BANANA PRO

Create `server/providers/freepikProvider.js`.

The image provider must support:
- Freepik API key
- Magnific API key fallback
- image model ID `nano-banana-pro`
- optional fast model `nano-banana-pro-flash`
- text-to-image
- image editing if supported
- URL/base64 input/output as provider allows
- provider capability tests
- storage of generated images through storageProvider

Nano Banana Pro is used for:
- character anchors
- full-body references
- outfit references
- expression references
- environment references
- first scene seed frame
- start frame
- end frame
- cinematic scene-board key visual
- element reference images

Every generated image must be saved in storage and recorded in DB.

---

# 10. NANO BANANA PRO PROMPT RULES

All image prompts must be precise and cinematic. Do not let the app produce generic prompts.

Global quality markers to append:

```txt
premium cinematic anime film still, masterpiece, best quality, ultra-detailed, professional character sheet quality where applicable, clean anatomy, sharp face details, consistent outfit, controlled lighting, readable composition, high-end anime production art, no text, no watermark, no UI, no collage
```

Global negative image prompt:

```txt
blurry, low quality, extra limbs, duplicate characters, wrong costume, wrong hair color, wrong eye color, distorted face, broken hands, random text, watermark, logo, UI, cropped face, inconsistent character, cluttered background, mutated anatomy, bad perspective, extra fingers
```

Character anchor prompt template:

```txt
Create a clean anime character reference image for {character_name}.
Show {character_name} clearly with {exact_face_description}, {exact_hair_color} hair, {exact_eye_color} eyes, {skin_tone}, {body_type}, wearing {outfit_lock}.
Include signature props: {signature_props}.
Pose: neutral standing pose, front-facing or 3/4 view, full body visible if requested.
Style: premium cinematic anime film still, professional character sheet quality, ultra-detailed, clean anatomy, sharp face details, consistent outfit, readable silhouette.
No background clutter, no text, no watermark, no duplicate character, no costume drift.
```

First seed frame prompt template:

```txt
Create the exact first cinematic seed frame for scene {scene_id}, chunk {chunk_id}.
This image will become the first frame for Animax Ultra video generation.
Scene: {scene_title}.
Start state: {start_state}.
Main character must match locked identity: {compressed_character_lock}.
Environment: {environment_lock}.
Camera/framing: {start_camera}.
Lighting/mood: {lighting_mood}.
Action moment: held pose at the beginning of the chunk.
Style: premium cinematic anime film still, masterpiece, best quality, ultra-detailed, clean anatomy, sharp face details, consistent outfit, controlled lighting, readable composition.
No text, no watermark, no extra characters unless specified.
```

End frame prompt template:

```txt
Create the exact final landing frame for video chunk {chunk_id}.
This image will become the next chunk's start frame.
Target end state: {end_state}.
Main character must match locked identity: {compressed_character_lock}.
Environment: {environment_lock}.
Camera/framing: {end_camera}.
Emotion at ending: {ending_emotion}.
Style: premium cinematic anime film still, masterpiece, best quality, ultra-detailed, clean anatomy, sharp face details, consistent outfit, controlled lighting, readable composition.
No text, no watermark, no extra characters unless specified.
```

Scene-board key visual prompt template:

```txt
Create a cinematic anime scene-board key visual for video chunk {chunk_id}.
Story beat: {story_beat}.
Main subject: {main_subject_pose}.
Secondary subject/prop: {secondary_subject_or_prop}.
Environment: {environment_description}.
Action emphasis: {action_focus}.
Mood: {emotion}.
Camera feel: {camera_feel}.
Lighting: {lighting}.
Color mood: {color_mood}.
This image should guide the upcoming Animax Ultra video generation.
Style: premium cinematic anime film still, masterpiece, best quality, ultra-detailed, clean anatomy, sharp face details, consistent outfit, controlled lighting, readable composition, high-end anime production art.
No text, no watermark, no UI, no collage, no random extra characters.
```

Element reference prompt template:

```txt
Create a clean isolated anime reference image for {element_name}.
Purpose: {character_prop_or_environment_anchor}.
Must match approved canon: {relevant_lock}.
Show the element clearly from a 3/4 angle with readable shape and details.
This image will be used as an Animax Ultra element reference.
Style: premium anime production reference, clean silhouette, sharp details, consistent colors.
No text, no watermark, no background clutter, no duplicate characters.
```

---

# 11. DATABASE SCHEMA

Create at minimum these tables:

```txt
users
admin_roles
admin_user_roles
projects
project_settings
story_bibles
characters
character_refs
character_consistency_locks
environments
environment_refs
scenes
storyboard_chunks
visualization_packs
scene_visualizations
video_chunks
chunk_memory
chunk_validations
production_memory
memory_events
memory_conflicts
agent_runs
agent_handoffs
job_tasks
task_dependencies
parallel_groups
dependency_blockers
playground_events
agent_activity_logs
live_progress_snapshots
provider_keys
provider_call_logs
provider_key_health_logs
provider_failover_events
provider_capability_tests
payment_orders
credit_ledger
pricing_config
storage_usage
cleanup_queue
notifications
exported_files
song_projects
song_lyrics
song_video_chunks
admin_audit_logs
error_library
demo_assets
```

Important `video_chunks` fields:

```txt
id
project_id
scene_id
chunk_number
duration_seconds
status
attempt_number
prompt_text
negative_prompt_text
prompt_char_count
provider_model_visible_name
provider_model_hidden_id
generation_mode               # standard | reference_video
standard_endpoint
reference_endpoint
reference_video_url           # previous chunk video URL
reference_video_trimmed_url   # if trimming was needed
start_frame_image_url
end_frame_image_url
scene_board_image_url
element_1_url
element_2_url
video_url                     # current output video
audio_url
subtitles_url
validation_json
quality_score
retry_count
error_message
created_at
updated_at
```

Important `job_tasks` fields:

```txt
id
project_id
user_id
scene_id
chunk_id
type
stage
status
payload_json
idempotency_key
provider_key_id
locked_by_worker_id
lock_expires_at
heartbeat_at
retry_count
error_message
started_at
finished_at
created_at
updated_at
```

Important `provider_keys` fields:

```txt
id
provider_name
label
encrypted_key
masked_key
enabled
priority
status
last_success_at
last_failure_at
cooldown_until
error_count
notes
created_at
updated_at
```

---

# 12. SHARED PRODUCTION MEMORY / CONTINUITY BRAIN

All agents share one central project memory. No agent should make isolated decisions.

Memory stores:
- story bible
- visual style
- world rules
- immutable character locks
- outfit locks
- prop locks
- environment canon
- camera language
- scene timeline
- chunk timeline
- audio voice style
- pronunciation rules
- approved decisions
- rejected outputs
- retry notes
- start/end frame continuity
- video reference continuity
- song bible
- lyrics timing map
- user edits
- admin overrides

Every chunk memory object must include:

```json
{
  "chunk_id": "SC_02_CH_03",
  "scene_id": "SC_02",
  "chunk_number": 3,
  "start_frame_image_url": "",
  "end_frame_image_url": "",
  "scene_board_image_url": "",
  "element_1_url": "",
  "element_2_url": "",
  "video_url": "",
  "reference_video_url": "",
  "reference_video_trimmed_url": "",
  "generation_mode": "reference_video",
  "end_state": "",
  "character_state": "",
  "environment_state": "",
  "camera_state": "",
  "audio_state": "",
  "validator_notes": [],
  "retry_notes": [],
  "next_start_instruction": ""
}
```

Before every agent runs:
1. load latest approved memory
2. read relevant sections
3. generate structured output
4. save output back to memory
5. write memory update summary
6. never override locked canon without controlled revision

Every memory update creates:
- version snapshot
- `memory_events` record
- before/after summary
- source agent
- confidence
- warnings

Approved memory can only be changed through controlled revision.

---

# 13. CHARACTER CONSISTENCY LOCK

After Character Director finishes and user approves characters, create immutable `character_consistency_locks`.

For each character:

```json
{
  "character_id": "",
  "name": "",
  "exact_face_description": "",
  "exact_hair_color": "",
  "exact_eye_color": "",
  "skin_tone": "",
  "age_appearance": "",
  "body_type": "",
  "height_impression": "",
  "outfit_lock": "",
  "signature_props": [],
  "silhouette_notes": "",
  "do_not_change": [
    "hair color",
    "eye color",
    "face shape",
    "outfit silhouette",
    "signature prop"
  ],
  "approved_reference_images": {
    "face_ref": "",
    "full_body_ref": "",
    "outfit_ref": "",
    "expression_ref": ""
  },
  "lock_status": "approved_locked"
}
```

Rules:
- Prompt Compiler includes compressed character lock in every video prompt.
- Visualization Director uses lock in every Nano Banana prompt.
- Vision Validator compares generated images/video frames against lock.
- Retry Director strengthens prompts if drift occurs.
- Lock can only be modified through explicit user/admin revision.

---

# 14. AGENT SYSTEM

All agents output valid JSON only. No markdown. No freeform explanations outside JSON. If uncertain, include `warnings`.

Every agent run stores:
- agent_name
- status
- last_action
- memory_read
- memory_updates
- depends_on
- outputs
- warnings
- retry_notes
- started_at
- updated_at
- completed_at

Agent statuses:
- idle
- queued
- running
- waiting_dependency
- validating
- retrying
- completed
- failed
- paused
- cancelled

Mandatory agents:
- Story Director
- Character Director
- Environment Director
- Storyboard Director
- Visualization Director
- Prompt Compiler
- Audio Director
- Video Provider Agent
- Video Validator
- Retry Director
- Export Agent
- Song Bible Agent
- Lyrics Timing Agent
- Song Video Agent
- Lip Sync Agent
- Cost Estimator
- Notification Agent
- Provider Failover Manager
- Admin Ops Agent

---

# 15. AGENT HANDOFF CHAIN

Standard video project:

```txt
User Prompt
→ Story Director
→ Shared Production Memory
→ Character Director + Environment Director + Preliminary Cost Estimator
→ Character Consistency Lock Approval
→ Storyboard Director
→ Visualization Director
→ Prompt Compiler
→ Audio Director
→ Video Provider Agent
→ Provider Poller
→ Video Validator
→ Retry Director OR Approval
→ Reference Save Step
→ Next Chunk
→ Export Agent
```

Song Mode:

```txt
Song Idea
→ Song Bible Agent
→ Lyrics Timing Agent
→ Music Provider
→ Song Storyboard Director
→ Visualization Director
→ Prompt Compiler
→ Video Provider Agent
→ Lip Sync Agent if needed
→ Validator
→ Export Agent
```

---

# 16. AGENT SYSTEM PROMPTS AND OUTPUT CONTRACTS

## 16.1 Story Director

System prompt:

```txt
You are the Story Director for AnimeStudioAI. Convert the user's idea into a cinematic anime story bible. Use the user's requested language, genre, length, tone, and style references. Anime names or studio names may be used as inspiration references, but do not create direct copies of copyrighted characters or plots. Build a coherent story that can be divided into 10-second video chunks. Output valid JSON only.
```

Output:

```json
{
  "title": "",
  "logline": "",
  "genre": "",
  "themes": [],
  "tone": "",
  "acts": [],
  "scenes": [],
  "characters": [],
  "visual_style": {},
  "world_rules": [],
  "memory_read": [],
  "memory_updates": {},
  "warnings": []
}
```

## 16.2 Character Director

System prompt:

```txt
You are the Character Director. Create a strict character canon and reference image prompts for each character. Preserve identity across the entire project. Define exact face, hair, eyes, outfit, props, silhouette, and do-not-change rules. Output valid JSON only.
```

Output:

```json
{
  "characters": [
    {
      "name": "",
      "role": "",
      "face": "",
      "hair": "",
      "eyes": "",
      "skin_tone": "",
      "body_type": "",
      "outfit": "",
      "props": [],
      "personality": "",
      "do_not_change": []
    }
  ],
  "character_lock_candidates": [],
  "reference_image_prompts": [],
  "memory_updates": {},
  "warnings": []
}
```

## 16.3 Environment Director

System prompt:

```txt
You are the Environment Director. Create location canon, environment references, lighting rules, weather, time-of-day, color palette, and world consistency rules. Output valid JSON only.
```

Output:

```json
{
  "locations": [],
  "lighting_rules": [],
  "weather_rules": [],
  "time_of_day_rules": [],
  "color_palette": [],
  "environment_reference_prompts": [],
  "memory_updates": {},
  "warnings": []
}
```

## 16.4 Storyboard Director

System prompt:

```txt
You are the Storyboard Director. Break every scene into exactly 10-second chunks. Each chunk must have a start state, action timeline, emotional beat, camera plan, audio notes, and target end state. Chunk N+1 must continue from chunk N. Output valid JSON only.
```

Output:

```json
{
  "scene_id": "",
  "chunks": [
    {
      "chunk_id": "",
      "duration": 10,
      "goal": "",
      "start_state": "",
      "action_timeline": [],
      "end_state": "",
      "visual_beats": [],
      "camera_plan": "",
      "dialogue": "",
      "audio_notes": "",
      "requires_video_reference": true
    }
  ],
  "memory_updates": {},
  "warnings": []
}
```

## 16.5 Visualization Director

System prompt:

```txt
You are the Visualization Director for AnimeStudioAI. Prepare visual references before video generation. Read Shared Production Memory, Character Consistency Lock, Environment Canon, and chunk plan. For chunk 1 of a scene, generate the first scene seed frame. For chunk N>1, use previous chunk's approved end frame as the start frame and previous chunk video URL as reference_video_url. Always create an end frame, scene-board image, element_1 reference, and element_2 reference. Element images must be distinct from start/end frames. Output valid JSON only.
```

Output:

```json
{
  "chunk_id": "",
  "chunk_number": 0,
  "scene_visual_brief": "",
  "shot_visualization_plan": "",
  "first_scene_seed_frame_prompt": "",
  "start_frame_prompt": "",
  "end_frame_prompt": "",
  "scene_board_prompt": "",
  "element_1_prompt": "",
  "element_2_prompt": "",
  "negative_image_prompt": "",
  "reference_video_url": "",
  "scene_board_summary": "",
  "memory_read": [],
  "memory_updates": {},
  "warnings": []
}
```

## 16.6 Prompt Compiler

System prompt:

```txt
You are the Prompt Compiler. Compile the final Animax Ultra video prompt and payload. Use latest approved Shared Production Memory only. Keep prompt under 2500 characters and target 2000-2200 characters. For chunk 1, use standard image-to-video. For chunk N>1, use reference-to-video, include @Video1 in the prompt, and set video_url to the previous chunk's video. Never include stale details. Do not include end_image_url in reference-to-video or multi-prompt mode unless provider capability test proves support. Output valid JSON only.
```

Output:

```json
{
  "generation_mode": "standard | reference_video",
  "prompt": "",
  "negative_prompt": "",
  "prompt_char_count": 0,
  "payload": {
    "video_url": "",
    "image_url": "",
    "prompt": "",
    "negative_prompt": "",
    "duration": "10",
    "aspect_ratio": "16:9",
    "cfg_scale": 0.5
  },
  "compression_notes": [],
  "warnings": []
}
```

Prompt rules:
- if `generation_mode=reference_video`, prompt must include `@Video1`
- hard max: 2500 chars
- include character lock
- include start state
- include target action
- include camera motion
- include audio notes
- include continuity instruction
- do not include long story bible text

Reference-video prompt template:

```txt
@Video1 Continue the motion, camera rhythm, animation style, character identity, lighting, and visual continuity from the previous clip. Start from the provided image frame: {start_state}. The character must match: {compressed_character_lock}. Scene goal: {chunk_goal}. Action over 10 seconds: {action_timeline}. Camera: {camera_plan}. Emotion: {emotion}. Audio: {audio_notes}. End by reaching: {target_end_state}. Keep cinematic anime quality, stable face, consistent outfit, no text artifacts.
```

## 16.7 Audio Director

System prompt:

```txt
You are the Audio Director. Create dialogue, voiceover, BGM, SFX, pronunciation guide, timing, and phonetic Hinglish/Hindi lines. Avoid chat abbreviations. Keep speech natural and short. Output valid JSON only.
```

Output:

```json
{
  "original_dialogue": "",
  "phonetic_dialogue": "",
  "pronunciation_guide": "",
  "pause_map": [],
  "emotion": "",
  "timing": "",
  "bgm_prompt": "",
  "sfx_prompt": "",
  "audio_mix_note": "",
  "generate_audio": true,
  "has_lipsync": false
}
```

## 16.8 Video Validator

System prompt:

```txt
You are the Video Validator. Inspect generated video keyframes and audio against character lock, environment canon, storyboard, start frame, end frame, reference video continuity, and audio plan. Return strict JSON with scores and pass/fail. Output valid JSON only.
```

Output:

```json
{
  "score": 0,
  "character_consistency": 0,
  "outfit_match": 0,
  "environment_match": 0,
  "story_beat_match": 0,
  "continuity": 0,
  "reference_motion_following": 0,
  "motion_quality": 0,
  "audio_quality": 0,
  "visual_cleanliness": 0,
  "ocr_text_found": false,
  "extra_characters_detected": false,
  "pass": false,
  "retry_recommendation": "",
  "memory_updates": {},
  "warnings": []
}
```

## 16.9 Retry Director

System prompt:

```txt
You are the Retry Director. Analyze failed output and choose targeted fixes. Do not regenerate everything unless needed. Save failure reasons to memory so future attempts avoid the same issue. Output valid JSON only.
```

Output:

```json
{
  "retry_type": "",
  "fix_plan": "",
  "regenerate_assets": [],
  "prompt_changes": [],
  "keep_assets": [],
  "memory_updates": {},
  "warnings": []
}
```

---

# 17. VIDEO GENERATION WORKFLOW

## 17.1 Chunk duration rule

All normal cinematic chunks are exactly 10 seconds.

Reason:
- previous chunk is used as reference video for next chunk
- reference videos must fit 3–10 second constraints
- 10 seconds gives enough motion while keeping compatibility

Song Mode also uses 10-second chunks.

## 17.2 Chunk 1 workflow

For first chunk of every new scene:

1. Storyboard Director creates chunk plan.
2. Visualization Director generates first scene seed frame via Nano Banana Pro.
3. Visualization Director generates end frame, scene board, and element references.
4. Gemini validates images.
5. Prompt Compiler creates standard image-to-video payload.
6. Video Provider calls standard endpoint.
7. Video output URL is stored as `video_url`.
8. End frame is stored.
9. The output video URL becomes `reference_video_url` for the next chunk.

Payload for chunk 1:

```json
{
  "image_url": "<first_scene_seed_frame_url>",
  "prompt": "<standard prompt under 2500 chars>",
  "negative_prompt": "<negative prompt>",
  "duration": "10",
  "aspect_ratio": "16:9",
  "cfg_scale": 0.5
}
```

## 17.3 Chunk N > 1 workflow

For every subsequent chunk:

1. Wait until previous chunk has `video_url`.
2. If previous video is longer than 10 seconds, trim to a 3–10 second reference clip.
3. Save trimmed clip as `reference_video_trimmed_url`.
4. Use previous approved end frame as start frame image.
5. Generate or reuse end frame, scene-board, and element references.
6. Gemini validates visuals.
7. Prompt Compiler creates reference-to-video payload.
8. Prompt includes `@Video1`.
9. Provider calls reference-to-video endpoint.
10. Output video URL is saved as current chunk `video_url`.
11. Current video becomes next chunk reference.

Payload:

```json
{
  "video_url": "<previous_chunk_video_or_trimmed_reference_url>",
  "image_url": "<previous_chunk_end_frame_image_url>",
  "prompt": "@Video1 Continue the motion and style from the previous clip...",
  "negative_prompt": "<negative prompt>",
  "duration": "10",
  "aspect_ratio": "16:9",
  "cfg_scale": 0.5
}
```

## 17.4 Scene transition workflow

If the story intentionally changes location/time/scene:
- create a new scene seed frame
- do not force previous video reference if the cut should be clean
- still preserve character lock
- save transition reason in memory
- first chunk of new scene can use standard image-to-video

## 17.5 Reference-video fallback

If reference-to-video fails:
1. retry once with same reference video
2. if invalid length, trim and retry
3. if provider rejects reference mode, fall back to image-to-video using previous end frame
4. save fallback note in memory
5. do not fake success

---

# 18. VISION / OCR VALIDATION

Use Gemini validation stack:
- normal image/frame checks: `gemini-2.5-flash`
- final chunk approval: `gemini-2.5-pro`
- experimental best quality: `gemini-3-pro-preview`, only if enabled and available

Every vision validation returns strict JSON:

```json
{
  "asset_id": "",
  "asset_type": "start_frame | end_frame | scene_board | character_anchor | element_reference | video_frame",
  "character_match_score": 0.0,
  "outfit_match_score": 0.0,
  "environment_match_score": 0.0,
  "prop_match_score": 0.0,
  "composition_score": 0.0,
  "story_beat_match_score": 0.0,
  "reference_motion_match_score": 0.0,
  "ocr_text_found": false,
  "ocr_text": [],
  "extra_characters_detected": false,
  "anatomy_issues": [],
  "continuity_issues": [],
  "pass": false,
  "regenerate_required": false,
  "regenerate_reason": "",
  "warnings": []
}
```

Pass rules:
- character match >= 0.78
- outfit match >= 0.80
- environment match >= 0.70
- story beat match >= 0.70
- no unwanted text
- no major anatomy issues
- no wrong main character
- no severe continuity break

If fail:
- regenerate only failed asset
- save reason to Shared Production Memory
- do not proceed to video prompt until required visuals pass

---

# 19. NATIVE HINGLISH / HINDI AUDIO

Audio Director must transform dialogue into pronunciation-safe Latin-script Hindi/Hinglish.

Rules:
- avoid abbreviations: `nhi`, `krna`, `pta`, `m`
- write full words: `nahi`, `karna`, `pata`, `main`
- add syllable breaks only when needed:
  - `kyun-ki`
  - `ba-hut`
  - `is-liye`
  - `samajh-te`
- add pause markers:
  - `[pause]`
  - `...`
- keep dialogue short
- 1–2 lines per 10-second chunk
- add stress markers in CAPS only when emotionally needed
- voice must remain clear over music

Example:

Input:

```txt
Tum samajhte kya ho ye jung abhi khatam nahi hui
```

Phonetic output:

```txt
Tum samajh-te kya ho... [pause] ye jung abhi khatam nahi hui.
```

---

# 20. SAFE PARALLEL EXECUTION

Parallelize only safe independent tasks.

Safe parallel:
- Character Director + Environment Director
- preliminary cost estimate
- image prompt writing for start/end/scene-board/elements
- Nano Banana image generation after prompts ready
- independent validations
- audio planning while visuals validate
- reference video trimming while prompt compiler prepares next chunk

Sequential:
- story approval before final storyboard
- character lock before final visualization
- previous chunk video URL before next chunk reference-to-video
- visualization validation before video prompt
- video validation before final approval
- all chunks approved before export

Create tables:
- task_dependencies
- parallel_groups
- dependency_blockers

---

# 21. WORKER SYSTEM

Create workers:
- queue worker
- provider submit worker
- provider poller worker
- stuck job recovery worker
- failover worker
- visualization worker
- validation worker
- reference video trim worker
- export worker
- notification worker
- cleanup worker

Every job task has:
- locked_by_worker_id
- lock_expires_at
- heartbeat_at
- idempotency_key
- retry_count
- provider_key_id
- payload_json
- status
- error_message

If heartbeat expires:
- recovery worker reclaims task
- check idempotency before rerunning
- never duplicate paid work

Idempotency key format:

```txt
project_id + scene_id + chunk_id + stage + asset_type + attempt_number
```

Before every expensive step:
- check if successful output exists
- reuse completed output unless explicit regeneration requested
- avoid duplicate provider calls

---

# 22. STUDIO PLAYGROUND WORKFLOW

Build a live Studio Playground where users can watch production.

Modules:
- Agent Graph View
- Chunk Rail View
- Memory Pulse View
- Live Preview Dock
- Current Stage Hero Card
- Event Feed
- Dependency Map
- Retry Path View
- Reference Video Continuity View

Show:
- active agents
- queued agents
- blocked agents
- completed agents
- generated thumbnails
- elapsed time
- progress timeline
- current chunk status
- whether current chunk uses reference video
- `@Video1` reference badge
- smooth animated connectors
- live SSE updates

Click agent:
- memory read
- outputs
- warnings
- dependency blockers
- retry notes

Click chunk:
- prompt
- payload
- reference video preview
- start/end frame preview
- validation JSON
- retry history
- generated video player

Store:
- agent_activity_logs
- playground_events
- live_progress_snapshots

---

# 23. UI / UX DESIGN SYSTEM

The frontend must feel premium, cinematic, smooth, and modern. It must not look AI-generated.

Use:
- React
- Tailwind CSS
- shadcn/ui
- Framer Motion
- lucide-react for clean icons if needed

Style:
- dark cinematic anime studio UI
- black / deep charcoal base
- dark violet panels
- magenta, blue, cyan accents
- premium SaaS layout
- generous spacing
- clean card hierarchy
- subtle glow
- no clutter
- no random neon overload
- no weird AI-generated icons

Use uploaded/generated images:
- hero backgrounds
- section backgrounds
- project thumbnails
- feature/card visuals
- scene-board cards
- song preview artwork

Icons:
- clean SVG or transparent PNG-style icons
- no ugly AI-looking icons
- consistent style
- transparent backgrounds for button icons

Every page needs:
- loading state
- empty state
- success state
- error state
- reconnect state for SSE loss

Public pages:
- Landing
- Features
- Pricing
- Login
- Signup

User pages:
- Dashboard
- Projects Library
- Create Project Wizard
- Story Bible Editor
- Character Studio
- Environment Studio
- Storyboard Builder
- Visualization Pack Viewer
- Studio Playground
- Production Timeline
- Chunk Inspector
- Song Studio
- Final Export
- Billing
- Notifications
- Profile / Settings

Admin pages:
- Admin Overview
- Users
- Projects
- Jobs / Queue
- Provider Keys
- Provider Health
- Capability Tests
- Failed Generations
- Billing / Refunds
- Pricing Config
- Song Ops
- Storage Monitor
- Agent Monitor
- Memory Inspector
- Audit Logs
- Error Library
- Settings

---

# 24. APPROVAL WORKFLOW

State machine:

```txt
draft
→ generated
→ waiting_user_approval
→ approved
→ production_locked
→ queued
→ generating
→ validating
→ completed
```

Controls:
- Approve Story Bible
- Request Regeneration
- Edit Manually
- Approve Characters
- Approve Character Lock
- Approve Storyboard
- Approve Visualization Pack
- Approve Cost Estimate
- Start Production
- Pause
- Resume
- Cancel
- Retry Chunk
- Export

Autopilot:
- user can enable autopilot
- autopilot may skip intermediate approvals
- character lock and cost estimate should still be approved unless user explicitly disables approval

---

# 25. COST ESTIMATION AND BILLING

Cost Estimator calculates:
- total scenes
- total chunks
- character images
- environment images
- visualization images
- reference video generation count
- standard video generation count
- video-to-video generation count
- audio validation
- song/music cost
- lipsync fallback buffer
- retry buffer
- export/storage cost

Display:
- estimated credits
- reserved credits
- used credits
- refunded credits
- remaining credits
- retry reserve

Use Razorpay:
- credit packs
- subscriptions
- webhook verification
- invoice history
- refunds
- failed payment handling
- admin credit adjustment

Do not deduct credits for provider failures that produce no usable output. Refund locked credits when appropriate.

Admin pricing config:
- credit pack prices
- subscription plans
- provider cost multiplier
- per-operation credit cost
- retry buffer percentage
- free trial credits
- storage limits

---

# 26. SONG STUDIO

Song Mode supports up to 180 seconds.

Song chunks use 10-second chunks.

Inputs:
- song type
- duration
- language
- vocal style
- music style
- visual style
- lyric direction
- lipsync mode

Pipeline:
1. Song Bible Agent creates song bible
2. Lyrics Timing Agent creates lyrics + timestamp map
3. Music provider generates full track
4. Storyboard splits into 10-second chunks
5. Visualization Packs created
6. Animax Ultra generates visuals
7. reference-video continuity used after first chunk
8. singer-visible chunks may use lipsync repair if needed
9. final video assembled with song audio

Export:
- final anime music video MP4
- full song audio
- lyrics TXT
- lyrics SRT
- timestamp map JSON
- song bible JSON
- video chunks
- project ZIP

---

# 27. FINAL EXPORT AND STORAGE

Use storageProvider for all files.

Store:
- generated frames
- scene-board images
- element refs
- video chunks
- reference clips
- audio files
- exports
- ZIP packages
- thumbnails

FFmpeg export:
- normalize FPS
- normalize resolution
- preserve audio sync
- stitch approved chunks
- attach subtitles when needed
- export H.264 MP4 + AAC
- generate poster thumbnail
- generate preview GIF if feasible
- create project ZIP

Safe concat approach:
1. transcode/normalize every chunk
2. create concat list
3. concat normalized chunks
4. mux subtitles/audio if required
5. export final MP4

Example:

```bash
ffmpeg -i input.mp4 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24" -c:v libx264 -preset veryfast -crf 18 -c:a aac -ar 48000 -ac 2 normalized.mp4
ffmpeg -f concat -safe 0 -i concat.txt -c copy stitched.mp4
ffmpeg -f concat -safe 0 -i concat.txt -c:v libx264 -crf 18 -preset veryfast -c:a aac -movflags +faststart final.mp4
```

Export variants:
- 720p MP4
- 1080p MP4 if source allows
- 9:16 social cut
- no-subtitle clean version
- burned-in subtitle version
- separate SRT
- project ZIP

---

# 28. STORAGE QUOTA AND CLEANUP

Storage quota:
- free plan limit
- paid plan limits
- dashboard storage usage
- admin storage monitor
- cleanup warnings

Deletion:
- user can delete project
- admin can hard-delete failed/abandoned projects
- related files move to cleanup queue
- cleanup worker deletes safely after retention period

---

# 29. ADMIN PANEL

Admin roles:
- super_admin
- operations_admin
- finance_admin
- support_admin
- read_only_admin

Permissions:
- super_admin: all
- operations_admin: jobs, providers, projects, retries, memory inspector
- finance_admin: billing, refunds, credits, pricing
- support_admin: users, projects, limited retries
- read_only_admin: view only

Admin features:
- user management
- project monitor
- jobs/queue monitor
- provider keys
- provider health
- capability tests
- video reference capability test
- failed generations
- billing/refunds
- pricing config
- storage monitor
- agent monitor
- memory inspector
- error library
- audit logs
- notifications
- settings

Provider keys:
- add key
- edit label
- masked key
- enable/disable
- priority
- test key
- recent calls
- health
- cooldown
- force key for next retry
- remove key

Security:
- encrypt keys at rest
- never display full key after saving
- show masked key only

Failover triggers:
- credit exhausted
- insufficient balance
- rate limit
- timeout
- auth failure
- provider outage
- repeated provider error

Failover behavior:
1. mark key degraded/failed
2. log failure
3. select next healthy key
4. retry same task with same idempotency policy
5. continue workflow
6. show friendly status in UI

---

# 30. PROVIDER CAPABILITY TESTS

Admin can run tests:
- text-to-video
- image-to-video
- reference-to-video with `video_url`
- `@Video1` prompt requirement
- reference video length 3–10s
- start image + video reference combination
- elements
- native audio
- multi-shot
- webhook/polling
- prompt limit
- max duration
- cfg_scale range

Save results in `provider_capability_tests`.

If capability fails:
- disable that feature
- show admin warning
- choose fallback path

---

# 31. SECURITY

- bcrypt password hashing
- JWT auth
- role-based admin access
- rate limits
- encrypted provider keys
- masked keys only
- no keys in frontend
- server-side permission checks
- upload validation
- audit logs
- input sanitization
- file size limits
- allowed file types only
- secure storage paths

Rate limit:
- login/register
- generation start
- retry chunk
- payment order creation
- admin key actions
- provider tests

---

# 32. DEMO MODE

Demo Mode is for development only.

Rules:
- visible banner: “DEMO MODE: responses are simulated”
- never pretend demo output is real generation
- default off in production
- when Demo Mode is off, all provider calls must be real
- demo data must not mix with production data

---

# 33. ERROR MESSAGE LIBRARY

User-friendly messages:
- Credits are low. Add credits to continue production.
- Production is still running on the server. You can safely close this page.
- A provider key failed. The system is switching to a backup key.
- This chunk needs review because continuity score was low.
- Storage is almost full. Delete old exports or upgrade your plan.
- Export failed. The system saved all approved chunks and can retry export.
- Payment failed. No credits were deducted.
- Provider is temporarily unavailable. The job will retry automatically.
- The previous chunk reference video was missing or invalid. The system will fall back to image continuity.
- The prompt exceeded 2500 characters and was compressed automatically.
- The reference video was longer than 10 seconds, so it was trimmed before use.

Admin messages:
- Key entered cooldown after repeated failures.
- Capability mismatch detected.
- Reference-to-video capability failed.
- Job lock expired and was reclaimed.
- Duplicate task prevented by idempotency key.
- Memory conflict detected and requires review.
- Vision model ID failed; update validation model settings.

---

# 34. API ROUTES

```txt
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

POST /api/projects
GET  /api/projects
GET  /api/projects/:id
DELETE /api/projects/:id

POST /api/projects/:id/story-bible/generate
POST /api/projects/:id/story-bible/approve
POST /api/projects/:id/characters/generate
POST /api/projects/:id/characters/approve-lock
POST /api/projects/:id/storyboard/generate
POST /api/projects/:id/visualization/generate
POST /api/projects/:id/cost-estimate
POST /api/projects/:id/production/start
POST /api/projects/:id/production/pause
POST /api/projects/:id/production/resume
POST /api/projects/:id/production/cancel
GET  /api/projects/:id/production/status
GET  /api/projects/:id/chunks
POST /api/chunks/:id/retry
GET  /api/chunks/:id/visualization-pack
GET  /api/chunks/:id/reference-video
POST /api/chunks/:id/reference-video

GET  /api/projects/:id/playground/events
GET  /api/projects/:id/agents
GET  /api/projects/:id/memory

POST /api/projects/:id/song/create
POST /api/song/:songId/generate-lyrics
POST /api/song/:songId/generate-music
POST /api/song/:songId/generate-video
POST /api/song/:songId/lipsync
POST /api/song/:songId/export
GET  /api/song/:songId
GET  /api/song/:songId/chunks

GET  /api/notifications
POST /api/notifications/:id/read

POST /api/payments/create-order
POST /api/payments/webhook
GET  /api/payments/history

GET  /api/admin/dashboard
GET  /api/admin/users
GET  /api/admin/projects
GET  /api/admin/jobs
POST /api/admin/jobs/:id/retry
POST /api/admin/jobs/:id/cancel
POST /api/admin/jobs/:id/pause
POST /api/admin/jobs/:id/resume

GET  /api/admin/provider-keys
POST /api/admin/provider-keys
PATCH /api/admin/provider-keys/:id
POST /api/admin/provider-keys/:id/test
POST /api/admin/provider-keys/:id/enable
POST /api/admin/provider-keys/:id/disable
POST /api/admin/provider-keys/:id/set-priority

GET  /api/admin/provider-health
GET  /api/admin/provider-capability-tests
POST /api/admin/provider-capability-tests/run
GET  /api/admin/failover-events
GET  /api/admin/failed-generations
GET  /api/admin/billing
POST /api/admin/refund
GET  /api/admin/pricing-config
POST /api/admin/pricing-config
GET  /api/admin/storage
GET  /api/admin/audit-logs
GET  /api/admin/song-ops
GET  /api/admin/agent-runs
GET  /api/admin/memory-conflicts
GET  /api/admin/error-library
POST /api/admin/error-library
```

---

# 35. FILE STRUCTURE

```txt
client/
  pages/
    public/
    app/
    admin/
  components/
    playground/
    admin/
    project/
    billing/
    shared/
    ui/
  layouts/
  hooks/
  contexts/
  styles/

server/
  agents/
    storyDirector.js
    characterDirector.js
    environmentDirector.js
    storyboardDirector.js
    visualizationDirector.js
    promptCompiler.js
    audioDirector.js
    audioQualityValidator.js
    videoValidator.js
    retryDirector.js
    songBibleAgent.js
    lyricsTimingAgent.js
    songVideoAgent.js
    lipSyncAgent.js
    exportAgent.js
    costEstimator.js
    notificationAgent.js
    providerFailoverManager.js
    adminOpsAgent.js
  providers/
    registry.js
    magnificProvider.js
    magnificCapabilities.js
    freepikProvider.js
    textProvider.js
    imageProvider.js
    videoProvider.js
    visionProvider.js
    transcriptionProvider.js
    ttsProvider.js
    musicProvider.js
    soundEffectsProvider.js
    lipSyncProvider.js
    paymentProvider.js
    storageProvider.js
  routes/
  services/
    productionMemory.js
    characterConsistencyLock.js
    workerLocking.js
    idempotency.js
    providerPayloadMapper.js
    capabilityTester.js
    pricingService.js
    storageQuotaService.js
    cleanupService.js
    exportService.js
    phoneticNormalizer.js
    visionValidator.js
    referenceVideoService.js
    notificationService.js
  db/
    schema.sql
    migrations/
  jobs/
    queueWorker.js
    providerSubmitWorker.js
    providerPollerWorker.js
    recoveryWorker.js
    failoverWorker.js
    visualizationWorker.js
    validationWorker.js
    referenceVideoTrimWorker.js
    exportWorker.js
    notificationWorker.js
    cleanupWorker.js
  utils/

public/
  assets/
```

---

# 36. FINAL REPLIT IMPLEMENTATION CHECKLIST

The app is not complete until these work:

## User app
- Landing page
- Pricing
- Login/signup
- Dashboard
- Project creation wizard
- Story Bible editor
- Character Studio
- Environment Studio
- Storyboard Builder
- Visualization Pack Viewer
- Studio Playground
- Production Timeline
- Chunk Inspector
- Song Studio
- Final Export page
- Billing
- Notifications
- Profile/settings

## Backend
- Express routes
- SQLite DB
- auth + roles
- persistent job queue
- worker heartbeat
- idempotency
- SSE status
- storage provider
- export service

## AI pipeline
- Story Director
- Character Director
- Environment Director
- Storyboard Director
- Visualization Director
- Prompt Compiler
- Audio Director
- Video Provider Agent
- Video Validator
- Retry Director
- Export Agent
- Shared Production Memory
- Character Consistency Lock

## Video workflow
- Chunk 1 standard image-to-video
- Chunk N reference-to-video
- previous chunk video URL saved
- `@Video1` included in reference prompts
- reference video max 10 sec
- previous end frame as start image
- Nano Banana Pro references
- Gemini 2.5 Flash validation
- Gemini 2.5 Pro final validation

## Admin
- Provider keys
- Capability tests
- Failover logs
- Jobs monitor
- Agent monitor
- Memory inspector
- Billing/refunds
- Pricing config
- Storage monitor
- Audit logs
- Error library

## Reliability
- API failover
- retries
- fallback to image continuity
- reference trim worker
- no fake success
- demo mode clearly labeled
- useful error messages

---

# 37. FINAL DIRECTIVE

Build AnimeStudioAI as a real production-style SaaS application on Replit.

Non-negotiable:
1. Hidden video model is `kling-v3-omni-pro`.
2. User-facing video engine is `Animax Ultra`.
3. Image model is `nano-banana-pro`.
4. Gemini 2.5 Flash is default vision/OCR validator.
5. Gemini 2.5 Pro is used for high-accuracy final checks.
6. First chunk uses standard image-to-video.
7. Every later chunk uses previous chunk video URL as `video_url` if capability is available.
8. Every reference-video prompt must include `@Video1`.
9. Every chunk is 10 seconds.
10. Previous end frame remains the start image for the next chunk.
11. Element reference images must be distinct from start/end frames.
12. Prompt Compiler must stay under 2500 chars.
13. Character Consistency Lock is immutable after approval.
14. Every expensive task uses idempotency.
15. Workers use heartbeat and lock leases.
16. Provider failover works with multiple encrypted API keys.
17. FFmpeg export normalizes and stitches chunks.
18. UI remains premium and cinematic.
19. Admin has full operational control.
20. Never fake provider success.

The final result must feel like a premium autonomous anime production studio with strong continuity, live orchestration, reliable admin control, and export-ready videos.
