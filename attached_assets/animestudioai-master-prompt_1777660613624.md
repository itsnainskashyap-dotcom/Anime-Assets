# MASTER BUILD PROMPT — AnimeStudioAI
### Paste this ENTIRE prompt into Replit Agent. Build the complete platform from scratch.

---

## WHAT YOU ARE BUILDING

**AnimeStudioAI** — A production-grade AI anime creation platform. Users create full anime productions — from story to finished video — entirely through AI. Multi-agent pipeline, chatbot-style interface, live playground visualization. Pink and black theme. Stunning, professional, unforgettable design.

This is NOT a prompt tool. This is a full anime production studio powered by AI.

---

## CRITICAL MODEL NAMES — USE EXACTLY AS WRITTEN

```javascript
const MODELS = {
  claude: 'claude-sonnet-4-6',                    // ALL Claude AI calls
  imageGen: 'nano-banana-pro',                     // ALL image generation (Magnific API)
  videoGen: 'seedance-2',                          // ALL video generation (Freepik API)
  ocr: 'gemini-2.0-flash',                         // Google OCR/vision for image reading
  imageAnalysis: 'gemini-2.0-flash'                // Google vision for frame analysis
};

const APIS = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  magnific: process.env.MAGNIFIC_API_KEY,          // nano-banana-pro image generation
  freepik: process.env.FREEPIK_API_KEY,            // seedance-2 video generation
  google: process.env.GOOGLE_API_KEY               // Gemini OCR + vision
};
```

**Never mention model names in the UI. Never say "Seedance", "Magnific", "Claude", "Gemini", or "Google" anywhere users can see.**

---

## DESIGN SYSTEM

### Visual Identity
- **App name:** AnimeStudioAI
- **Tagline:** "Your story. Your world. Your anime."
- **Theme:** Dark luxury editorial — pink and black

### Color Palette
```css
:root {
  --bg-primary: #080810;           /* deep near-black with purple tint */
  --bg-surface: #0F0F1A;
  --bg-card: #14141F;
  --bg-elevated: #1A1A2E;
  --border: #1E1E32;
  --border-glow: rgba(255, 75, 145, 0.3);

  --accent-pink: #FF4B91;          /* hot pink — primary accent */
  --accent-pink-soft: #FF7DB8;     /* soft pink — hover states */
  --accent-pink-dim: rgba(255, 75, 145, 0.15);
  --accent-purple: #9B5DE5;        /* purple — secondary accent */
  --accent-gold: #FFD700;          /* gold — premium/special elements */

  --text-primary: #F0ECF8;
  --text-secondary: #8B85A0;
  --text-muted: #3D3A52;
  --text-pink: #FF4B91;

  --success: #00F5A0;
  --error: #FF4444;
  --warning: #FFB800;

  --gradient-pink: linear-gradient(135deg, #FF4B91, #9B5DE5);
  --gradient-dark: linear-gradient(180deg, #0F0F1A, #080810);
  --glow-pink: 0 0 30px rgba(255, 75, 145, 0.4);
  --glow-purple: 0 0 20px rgba(155, 93, 229, 0.3);
}
```

### Typography
```html
<!-- Load in index.html -->
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+JP:wght@300;400;500&display=swap" rel="stylesheet">
```

- **Display/Logo:** `Syne` — bold, geometric, memorable
- **Body/UI:** `DM Sans` — clean, readable
- **Code/Prompts:** `JetBrains Mono`
- **Anime text accents:** `Noto Sans JP` — occasional Japanese character decorations

### Signature Visual Elements
- Animated gradient border glow on cards using `--border-glow`
- Sakura particle animation on landing page (CSS particles, pink dots falling)
- Scan line texture overlay on dark backgrounds (subtle CRT effect)
- Pink glow halos on active/hover states
- Noise grain texture on `--bg-primary` surface
- Japanese characters (decorative, background elements): アニメ スタジオ AI
- Loading states: pink shimmer skeleton loaders

---

## APP ARCHITECTURE

### Tech Stack
- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express
- **Auth:** JWT (simple email/password — no OAuth)
- **Database:** SQLite via `better-sqlite3` (persist projects, users, jobs)
- **Real-time:** Server-Sent Events (SSE) for live pipeline progress
- **State:** React Context + localStorage for UI state
- **File serving:** Express static for generated assets

### Pages
```
/                → Landing page (public)
/login           → Login/Signup
/app             → Main app interface (protected)
  Layout: left sidebar + center chat + right playground
```

---

## PAGE 1 — LANDING PAGE (`/`)

### Hero Section
Full-screen dark background with:
- Large animated title: **"AnimeStudioAI"** — letters animate in one by one
- Below title: **"Your story. Your world. Your anime."**
- Falling sakura particles (CSS animation, pink semi-transparent circles)
- Background: dark gradient with subtle anime line-art pattern (CSS)
- Two CTA buttons: **"Start Creating"** (pink filled) + **"Watch Demo"** (outline)
- Japanese decoration text floating in background: アニメ スタジオ AI (very low opacity)

### Features Section
3-column grid:

```
[🎭 AI Storytelling]    [🎨 Character Studio]    [🎬 Auto Production]
Write or upload your   Generate characters      From story to finished
story. AI builds       from every angle with    anime. Fully automated
the entire narrative   consistent design        production pipeline.
structure.             across every scene.
```

### Anime Types Showcase
Horizontal scroll of anime style cards with example aesthetics:
Shonen / Shojo / Isekai / Mecha / Slice of Life / Dark Fantasy / Cyberpunk Anime / Chibi / Historical / Horror

### How It Works
Step flow: Story Input → Character Generation → Scene Storyboard → Video Production → Final Export

### Footer
AnimeStudioAI logo + links + "Powered by AI" (no model names)

---

## PAGE 2 — AUTH (`/login`)

Split screen:
- Left: Dark panel with logo + tagline + decorative anime character silhouette (CSS art)
- Right: Auth form

Form has two modes (tabs): **Sign In** / **Sign Up**

Sign Up fields: Name, Email, Password, Confirm Password
Sign In fields: Email, Password

JWT stored in localStorage. Protected routes redirect to `/login` if no valid token.

Backend:
```javascript
// Users table in SQLite
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  password_hash TEXT,
  created_at TEXT,
  plan TEXT DEFAULT 'free'
);
```

---

## PAGE 3 — MAIN APP (`/app`)

### Layout — Three Panel

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOPBAR: AnimeStudioAI logo · [Project Name] · [New] [Save] [Export] │
├──────────────┬─────────────────────────┬─────────────────────────────┤
│              │                         │                             │
│   SIDEBAR    │    CHAT PANEL           │    PLAYGROUND               │
│   (280px)    │    (flex, center)       │    (flex, right)            │
│              │                         │                             │
│  Project     │  Conversation with      │  Live visualization:        │
│  navigator   │  the AI Director        │  - Character sheets         │
│              │                         │  - Storyboard frames        │
│  Story       │  User types here,       │  - Video chunks             │
│  Acts        │  AI responds,           │  - Progress timeline        │
│  Characters  │  pipeline updates       │  - Final video player       │
│  Scenes      │  shown inline           │                             │
│  Production  │                         │                             │
│              │                         │                             │
│  [Settings]  │  [Input box]            │  [Full screen toggle]       │
└──────────────┴─────────────────────────┴─────────────────────────────┘
```

### Sidebar
- AnimeStudioAI mini logo at top
- **Project Navigator:** expandable tree
  - 📖 Story
    - Acts (1, 2, 3...)
  - 👥 Characters (each character with thumbnail)
  - 🎬 Scenes (each scene with frame thumbnail)
  - 🎞️ Production (video chunks with progress)
- **Bottom:** Settings, user avatar, plan badge

### Chat Panel (Center)
- Dark background, subtle scan-line texture
- AI "Director" avatar at top: pink circle with anime eye icon
- Messages alternate: user (right, pink bubble) / AI Director (left, dark card)
- AI Director messages can contain:
  - Text responses
  - Inline image grids (character designs, scene frames)
  - Progress cards (pipeline steps)
  - Action buttons ("Approve", "Regenerate", "Continue")
  - Story display cards (acts, characters)
- Input box at bottom:
  - Text input (multiline)
  - Attachment button (upload story document/PDF)
  - Send button (pink gradient)
  - Below input: quick action chips: [New Story] [Upload Story] [Generate Characters] [Start Production]

### Playground (Right Panel)
- Tabbed view: **Characters** | **Storyboard** | **Production** | **Final Video**
- **Characters tab:** Grid of character cards — each shows character name, all generated angles (front/side/back/close-up), type badge
- **Storyboard tab:** Scene grid — thumbnails in order with act labels and timestamps
- **Production tab:** Timeline view — each 10s chunk with thumbnail, status badge, progress bar
- **Final Video tab:** Video player + download button

---

## FEATURE: STORY CREATION FLOW

### Step 1 — Story Type Selection

When user starts a new project, chat panel shows a story type selector:

**Format:**
```
SHORT STORY          LONG STORY
└ 30s               └ 5 min
└ 1 min             └ 10 min
└ 2 min             └ 20 min
└ 5 min             └ More (custom)
                    
                    └ MOVIE (feature)
                    └ SERIES (episodes)
```

**Anime Type selector** (shown simultaneously):

Beautiful grid of anime type cards — each card has:
- Type name
- 3-word aesthetic descriptor
- Unique border color

| Anime Type | Border Color | Descriptor |
|---|---|---|
| Shonen | `#FF6B35` | Action. Growth. Power. |
| Shojo | `#FF4B91` | Emotion. Romance. Beauty. |
| Isekai | `#9B5DE5` | Portal. Adventure. Magic. |
| Mecha | `#4DA6FF` | Metal. War. Pilot. |
| Slice of Life | `#27AE60` | Warm. Quiet. Real. |
| Dark Fantasy | `#8B0000` | Shadow. Myth. Dread. |
| Cyberpunk Anime | `#00FFCC` | Neon. Corp. Rebel. |
| Chibi | `#FFB8D1` | Cute. Round. Sweet. |
| Historical | `#C9A84C` | Honor. Era. Tradition. |
| Horror Anime | `#2C2C2C` | Fear. Dark. Unsettling. |
| Sports Anime | `#FFD700` | Drive. Team. Victory. |
| Psychological | `#6A0DAD` | Mind. Twist. Reality. |

**Voiceover Language:**
```
[ No Voiceover ]  [ English ]  [ Hinglish ]
```

### Step 2 — Story Input

Two options shown as tabs in chat:

**Tab A: "Write Story"**
- Large textarea
- AI auto-expands brief concepts into full story structure

**Tab B: "Upload Story"**
- Drop zone for PDF, TXT, DOCX
- Reads using Claude Sonnet 4.6 with Gemini OCR for image-based PDFs
- Shows extraction preview

### Step 3 — Story Analysis & Structure (Claude Sonnet 4.6)

After story input, Claude Sonnet 4.6 generates the full story bible:

```json
{
  "title": "string",
  "animeType": "string",
  "genre": ["string"],
  "synopsis": "string — 3 sentences",
  "themes": ["string"],
  "setting": {
    "world": "string",
    "timeperiod": "string",
    "mainLocations": ["string"]
  },
  "acts": [
    {
      "actNumber": 1,
      "title": "string",
      "summary": "string",
      "emotionalArc": "string",
      "keyEvents": ["string"],
      "estimatedDurationSeconds": 60
    }
  ],
  "characters": [
    {
      "id": "string",
      "name": "string",
      "role": "protagonist|antagonist|supporting|minor",
      "age": "string",
      "personality": ["trait1", "trait2", "trait3"],
      "appearance": {
        "hairColor": "string",
        "hairStyle": "string",
        "eyeColor": "string",
        "skinTone": "string",
        "height": "string",
        "build": "string",
        "outfit": "string — detailed",
        "distinguishingFeatures": "string"
      },
      "backstory": "string",
      "arc": "string — how they change",
      "voiceDescription": "string — for TTS"
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "actNumber": 1,
      "title": "string",
      "location": "string",
      "timeOfDay": "string",
      "charactersPresent": ["characterId"],
      "summary": "string",
      "emotionalTone": "string",
      "keyVisualMoment": "string",
      "dialogue": ["string"],
      "estimatedDurationSeconds": 30
    }
  ]
}
```

This is shown in chat as a beautiful structured card, and in sidebar as the project tree.

---

## FEATURE: CHARACTER GENERATION PIPELINE

### Multi-Agent Character System

For each character in the story bible, the pipeline runs:

**Agent 1 — Character Design Prompt Writer (Claude Sonnet 4.6)**
Writes optimized nano-banana-pro prompts for each required angle.

Required angles per character:
1. Full body front view
2. Full body 3/4 view left
3. Full body 3/4 view right
4. Back view
5. Face close-up (front)
6. Face close-up (3/4 angle)
7. Action pose (relevant to character role)
8. Emotional expression sheet (4 expressions in one image)

For each angle, Claude writes:
```json
{
  "angle": "full-body-front",
  "prompt": "string — 120-150 words. Include: exact character appearance, anime type style, lighting, background, pose, expression, outfit details, art quality markers",
  "negativePrompt": "string — what to avoid",
  "styleModifiers": ["string", "string"]
}
```

**Agent 2 — Image Generator (nano-banana-pro via Magnific)**
Generates each angle image from the prompt.

**Agent 3 — Consistency Validator (Gemini 2.0 Flash vision)**
After each image is generated:
- Reads the image using Gemini vision
- Compares against the character appearance spec
- Checks: hair color match, outfit match, eye color, distinguishing features
- Returns: `{ consistent: boolean, issues: [string], confidence: number }`
- If `consistent === false`: Claude Sonnet 4.6 writes a corrected prompt → regenerate
- Max 2 regeneration attempts per angle

**Agent 4 — Character Sheet Compiler**
After all angles pass validation:
- Assembles all 8 angles into the project
- Creates a "character consistency lock" JSON used by all future generation
- Shown in Playground → Characters tab as a beautiful character card

### Text/Book in Scene Detection

When a scene description mentions text (book, sign, letter, scroll, etc.):

**Special Text Frame Pipeline:**
1. Claude Sonnet 4.6 detects text elements in scene description
2. Writes a nano-banana-pro prompt specifically for the text element (book cover, sign, etc.)
3. nano-banana-pro generates the image with correct text styling for anime type
4. Gemini 2.0 Flash OCR reads the generated image to verify text is correct
5. If text is wrong: Claude rewrites prompt with more specific text rendering instructions → regenerate
6. Final verified text frame is stored as a reference image
7. This reference image is fed to Seedance 2.0 before video generation of that scene

---

## FEATURE: SCENE & ENVIRONMENT GENERATION

### For each scene in the story:

**Environment Agent (Claude Sonnet 4.6 → nano-banana-pro)**

Generates:
1. **Wide establishing shot** — full environment, no characters
2. **Mid shot environment** — environment with character placement zones
3. **Close-up elements** — important props, details

Each generation uses:
- Scene location + time of day + weather from story bible
- Anime type style rules
- Previous environment images as reference (Gemini reads them for consistency)

**Scene Storyboard Agent (Claude Sonnet 4.6)**

For each scene, creates a storyboard:
```json
{
  "sceneNumber": 1,
  "totalDurationSeconds": 30,
  "videoChunks": [
    {
      "chunkNumber": 1,
      "timeRange": "00:00-00:10",
      "description": "string",
      "cameraWork": "string",
      "charactersAction": "string",
      "dialogue": "string or null",
      "emotionalBeat": "string",
      "startingFramePrompt": "string — nano-banana-pro prompt for first frame",
      "cutFramePrompts": ["string", "string", "string"],
      "endingState": "string — exact last frame description",
      "audioDirection": {
        "voiceoverText": "string — actual words in selected language",
        "soundEffects": ["string"],
        "musicDirection": "string"
      }
    }
  ]
}
```

---

## FEATURE: VIDEO PRODUCTION PIPELINE (Multi-Agent)

### The Core Loop — runs automatically until story is complete

```
FOR EACH SCENE:
  FOR EACH CHUNK (10 seconds each):

    AGENT 1 — PROMPT WRITER (Claude Sonnet 4.6)
    Writes optimized JSON video prompt for this 10s chunk
    Knows: full story, current scene, previous chunk state, next chunk need
    
    AGENT 2 — REFERENCE ASSEMBLER
    Assembles reference images:
    [first frame] + [cut frames] + [character sheets] + [text frames if needed]
    
    AGENT 3 — VIDEO GENERATOR (Seedance 2.0 via Freepik)
    Receives: JSON prompt + reference images
    Outputs: 10s video with audio (VO + SFX + music)
    
    AGENT 4 — FRAME ANALYZER (Gemini 2.0 Flash vision)
    Reads the generated video's first and last frames
    Validates: character consistency, physics continuity, story accuracy
    Returns: { valid: boolean, issues: [string], lastFrameDescription: string }
    
    AGENT 5 — VALIDATOR
    If valid: proceed to next chunk
    If invalid: Claude Sonnet 4.6 corrects the prompt → Seedance regenerates
    Max 2 retries per chunk
    
    CONTINUITY BRIDGE:
    Last frame of chunk N → first frame of chunk N+1 (automatically)
    First chunk of next scene → last video of previous scene as reference (not just frame)
    This ensures scenes connect naturally, not just frames

END LOOP
→ All chunks stitched by FFmpeg → Final video
```

### Seedance Prompt Optimization for Voiceover

**CRITICAL — Hinglish pronunciation fix:**

When voiceover language is Hinglish, Claude Sonnet 4.6 applies these rules:
```
HINGLISH VOICEOVER RULES FOR SEEDANCE:
1. Write all Hindi words in Latin script with phonetic spelling
   BAD: "Yeh moment bahut important hai"
   GOOD: "Yeh mo-ment ba-hut im-por-tant hai" (syllable breaks for TTS)
   
2. Avoid complex Hindi conjuncts — break them: "kyunki" → "kyun-ki"
3. Stress markers: add CAPS to stressed syllables: "BILKUL sahi kaha"
4. Pause markers: use [pause] for dramatic beats
5. Number pronunciation: write as words — "3" → "teen"
6. English words in Hindi context: keep them English — "college" not "kaaleej"
7. Emotion markers: [excited] [sad] [whisper] [angry] before relevant lines
8. Test phrase at start: always begin with a short English phrase so Seedance 
   calibrates voice before Hindi content
```

### Optimized JSON Prompt for Seedance 2.0

Every video chunk prompt sent to Seedance uses this JSON structure:

```json
{
  "generation": {
    "duration": 10,
    "resolution": "720p",
    "aspectRatio": "16:9",
    "frameRate": 24
  },
  "continuity": {
    "mode": "continue-from-reference",
    "firstFrameIsProvided": true,
    "previousVideoIsProvided": true,
    "matchFirstFrameExactly": true,
    "physicsVector": "string",
    "cameraCarryover": "string"
  },
  "scene": {
    "description": "string — 80-100 words visual description",
    "location": "string",
    "timeOfDay": "string",
    "atmosphere": "string",
    "lightingSetup": {
      "primarySource": "string",
      "colorTemperature": "number",
      "shadowDepth": "string"
    }
  },
  "animeStyle": {
    "type": "string — e.g. Shonen",
    "styleDescriptors": ["string", "string", "string"],
    "lineWeight": "string — thin/medium/bold",
    "colorSaturation": "string — vibrant/muted/pastel",
    "shadingStyle": "string — cel/soft/detailed"
  },
  "characters": [
    {
      "name": "string",
      "appearanceLock": {
        "hair": "string",
        "eyes": "string",
        "outfit": "string",
        "features": "string"
      },
      "position": "string",
      "action": "string",
      "expression": "string",
      "movementPhysics": {
        "speed": "number 0.0-1.0",
        "direction": "string",
        "acceleration": "string"
      }
    }
  ],
  "camera": {
    "startAngle": "string",
    "endAngle": "string",
    "movement": "string",
    "distanceFromSubject": "string",
    "focalLength": "string"
  },
  "cutMoments": [
    {"atSecond": 3, "description": "string", "referenceFrameProvided": true},
    {"atSecond": 6, "description": "string", "referenceFrameProvided": true},
    {"atSecond": 8, "description": "string", "referenceFrameProvided": true}
  ],
  "audio": {
    "voiceover": {
      "text": "string — actual words with phonetic markers for Hinglish",
      "language": "english|hinglish",
      "startAtSecond": 0.5,
      "tone": "string",
      "emotionMarkers": ["string"],
      "pausePoints": ["string"]
    },
    "soundEffects": [
      {"sound": "string", "atSecond": "number", "volume": "number 0.0-1.0"}
    ],
    "backgroundMusic": {
      "genre": "string",
      "bpm": "number",
      "instruments": ["string"],
      "energyArc": "string"
    }
  },
  "endingFrame": {
    "characterPositions": "string",
    "cameraAngle": "string",
    "lightingState": "string",
    "fullDescription": "string — for next chunk to continue from"
  }
}
```

---

## FEATURE: SERIES & MOVIE MODE

### When user selects SERIES:
- Episode selector: how many episodes, episode length (22 min / 45 min)
- Each episode is its own project linked in a series
- Character consistency is maintained across episodes using character sheet lock
- Previously generated episode's final scene feeds into next episode's opening

### When user selects MOVIE:
- Acts automatically structured as 3-act feature: setup (25%) / confrontation (50%) / resolution (25%)
- Production splits into 5-minute production blocks
- Each block processed sequentially

---

## FEATURE: REAL-TIME PROGRESS UI

### Chat Panel — Pipeline Messages

As pipeline runs, AI Director posts progress messages in chat:

```
🎭 AI Director
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analyzing your story...
Found 3 acts, 5 characters, 12 scenes.

[Story Bible card — expandable]
```

```
🎭 AI Director
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generating characters...

[Character grid — shows each character with loading skeleton 
then fills in as images complete]

✓ Yuki — all 8 angles complete
✓ Kenji — all 8 angles complete
⚡ Villain — generating angle 4/8...
```

```
🎭 AI Director
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Production in progress...

Scene 1 of 12
[Progress bar: ████████░░░░░░░░ 3/10s chunks]

⚡ Generating...
```

### Playground Right Panel — Live Timeline

Visual production timeline:
```
ACT 1 ──────────────────────────────────────────
  Scene 1 [████████████████████] ✓ 1:20
  Scene 2 [████████████░░░░░░░░] ⚡ 0:48/1:10
  Scene 3 [░░░░░░░░░░░░░░░░░░░░] ○ pending

ACT 2 ──────────────────────────────────────────
  Scene 4 [░░░░░░░░░░░░░░░░░░░░] ○ pending
```

Click any completed scene → plays it in the playground video player.

### SSE Implementation

```javascript
// server/routes/pipeline.js
app.get('/api/pipeline/stream/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Register this response with the job
  jobEventEmitters.set(req.params.jobId, sendEvent);

  req.on('close', () => {
    jobEventEmitters.delete(req.params.jobId);
  });
});
```

Events emitted: `story_analyzed`, `character_generating`, `character_complete`, `character_validated`, `scene_generating`, `chunk_generating`, `chunk_complete`, `chunk_failed`, `chunk_retrying`, `scene_complete`, `stitching`, `complete`, `error`

---

## DATABASE SCHEMA (SQLite)

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  title TEXT,
  anime_type TEXT,
  story_format TEXT,     -- 'short' | 'long' | 'movie' | 'series'
  duration_seconds INTEGER,
  voiceover_language TEXT,
  status TEXT DEFAULT 'draft',
  story_bible TEXT,      -- JSON blob
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Characters
CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  name TEXT,
  role TEXT,
  appearance_spec TEXT,  -- JSON blob
  consistency_lock TEXT, -- JSON blob
  image_angles TEXT,     -- JSON blob: { front: url, side: url, ... }
  created_at TEXT DEFAULT (datetime('now'))
);

-- Scenes
CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  scene_number INTEGER,
  act_number INTEGER,
  title TEXT,
  storyboard TEXT,       -- JSON blob
  environment_frames TEXT, -- JSON blob
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Video chunks
CREATE TABLE video_chunks (
  id TEXT PRIMARY KEY,
  scene_id TEXT REFERENCES scenes(id),
  chunk_number INTEGER,
  time_range TEXT,
  video_path TEXT,
  video_url TEXT,
  json_prompt TEXT,      -- the exact JSON prompt used
  last_frame_base64 TEXT,
  validation_result TEXT, -- JSON blob
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Jobs (pipeline tracking)
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  status TEXT,
  current_step TEXT,
  progress_percent INTEGER DEFAULT 0,
  steps_log TEXT,        -- JSON array
  error TEXT,
  started_at TEXT,
  completed_at TEXT
);
```

---

## FILE STRUCTURE

```
animestudioai/
├── server/
│   ├── index.js                    — Express entry point + middleware
│   ├── db.js                       — SQLite setup + schema
│   ├── auth.js                     — JWT auth middleware
│   ├── routes/
│   │   ├── auth.js                 — login/signup endpoints
│   │   ├── projects.js             — CRUD for projects
│   │   ├── pipeline.js             — pipeline start/status/SSE
│   │   └── assets.js               — serve generated files
│   ├── agents/
│   │   ├── storyAnalyzer.js        — Claude Sonnet 4.6 story → bible
│   │   ├── characterDesigner.js    — Claude → nano-banana-pro → Gemini validator
│   │   ├── sceneBuilder.js         — storyboard + environment generation
│   │   ├── promptWriter.js         — Claude Sonnet 4.6 JSON prompts per chunk
│   │   ├── videoGenerator.js       — Seedance 2.0 via Freepik
│   │   ├── frameAnalyzer.js        — Gemini 2.0 Flash vision
│   │   ├── validator.js            — consistency checker + retry logic
│   │   └── stitcher.js             — FFmpeg final assembly
│   ├── pipeline/
│   │   ├── orchestrator.js         — main pipeline controller
│   │   └── jobManager.js           — job state + SSE emitter
│   └── utils/
│       ├── imageUtils.js           — base64 helpers
│       └── ffmpegUtils.js          — video processing
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.css                     — global styles + CSS variables
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── ProjectContext.jsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Topbar.jsx
│   │   │   └── Layout.jsx
│   │   ├── chat/
│   │   │   ├── ChatPanel.jsx
│   │   │   ├── ChatMessage.jsx
│   │   │   ├── ChatInput.jsx
│   │   │   ├── StoryBibleCard.jsx
│   │   │   ├── CharacterGridCard.jsx
│   │   │   └── ProgressCard.jsx
│   │   ├── playground/
│   │   │   ├── PlaygroundPanel.jsx
│   │   │   ├── CharactersTab.jsx
│   │   │   ├── StoryboardTab.jsx
│   │   │   ├── ProductionTab.jsx
│   │   │   └── VideoTab.jsx
│   │   └── shared/
│   │       ├── AnimeTypeCard.jsx
│   │       ├── CharacterCard.jsx
│   │       ├── VideoPlayer.jsx
│   │       ├── ProgressTimeline.jsx
│   │       ├── SkeletonLoader.jsx
│   │       ├── Modal.jsx
│   │       └── Toast.jsx
│   └── pages/
│       ├── Landing.jsx
│       ├── Auth.jsx
│       └── App.jsx
├── index.html
├── vite.config.js
└── package.json
```

---

## PACKAGE.JSON DEPENDENCIES

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@anthropic-ai/sdk": "^0.27.0",
    "express": "^4.18.2",
    "better-sqlite3": "^9.4.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "node-fetch": "^3.3.2",
    "fluent-ffmpeg": "^2.1.3",
    "ffmpeg-static": "^5.2.0",
    "ffprobe-static": "^3.1.0",
    "multer": "^1.4.5",
    "uuid": "^9.0.0",
    "events": "^3.3.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
```

---

## ENVIRONMENT VARIABLES (Replit Secrets)

```
ANTHROPIC_API_KEY          = sk-ant-...
MAGNIFIC_API_KEY           = your-magnific-api-key
FREEPIK_API_KEY            = your-freepik-api-key
GOOGLE_API_KEY             = your-google-ai-api-key
JWT_SECRET                 = any-long-random-string
NODE_ENV                   = production
```

---

## CSS GLOBAL VARIABLES + ANIMATIONS

```css
/* Add to src/App.css */

/* Sakura particles */
@keyframes sakuraFall {
  0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
}

.sakura-particle {
  position: fixed;
  width: 8px;
  height: 8px;
  background: var(--accent-pink);
  border-radius: 50% 0 50% 0;
  opacity: 0.6;
  animation: sakuraFall linear infinite;
  pointer-events: none;
}

/* Pink glow pulse on active elements */
@keyframes pinkGlow {
  0%, 100% { box-shadow: 0 0 10px rgba(255, 75, 145, 0.3); }
  50% { box-shadow: 0 0 30px rgba(255, 75, 145, 0.7); }
}

.glow-active { animation: pinkGlow 2s ease-in-out infinite; }

/* Scan line texture */
.scanlines::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.1) 2px,
    rgba(0, 0, 0, 0.1) 4px
  );
  pointer-events: none;
}

/* Skeleton loader */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, #1A1A2E 25%, #2A1A3E 50%, #1A1A2E 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

/* Chat message slide in */
@keyframes messageSlideIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.chat-message { animation: messageSlideIn 0.25s ease-out; }

/* Noise grain overlay */
.noise-overlay::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 9999;
  opacity: 0.4;
}
```

---

## QUALITY CHECKLIST — BUILD COMPLETE WHEN ALL PASS

### Design
- [ ] Pink and black theme applied everywhere
- [ ] Syne font for display, DM Sans for body
- [ ] Sakura particles on landing page
- [ ] Scan line texture on main app background
- [ ] Pink glow on active/hover states
- [ ] No model names (Claude/Seedance/Magnific/Gemini) visible in UI

### Auth
- [ ] Signup creates user in SQLite with bcrypt password hash
- [ ] Login returns JWT stored in localStorage
- [ ] Protected routes redirect to /login
- [ ] JWT middleware on all `/api/*` routes

### Story Creation
- [ ] All anime types shown with correct colors
- [ ] Short/Long/Movie/Series format selection works
- [ ] Story duration options correct per format
- [ ] Voiceover language selector (No VO / English / Hinglish)
- [ ] Story upload (PDF/TXT) works with Gemini OCR
- [ ] Story input textarea generates full story bible via Claude Sonnet 4.6
- [ ] Story bible JSON stored in SQLite
- [ ] Story bible displayed as formatted card in chat

### Character Generation
- [ ] All 8 angles generated per character
- [ ] Gemini validates each image against spec
- [ ] Failed validations trigger Claude prompt rewrite + regeneration (max 2 retries)
- [ ] All angles shown in playground Characters tab
- [ ] Character consistency lock stored and used in all subsequent generation

### Text/Book Detection
- [ ] Scenes with text elements detected by Claude
- [ ] nano-banana-pro generates text frame
- [ ] Gemini OCR verifies text accuracy
- [ ] Text frame fed as reference to Seedance before that scene's video

### Video Production
- [ ] Storyboard generated per scene with 10s chunks
- [ ] Claude Sonnet 4.6 writes JSON prompt for every chunk
- [ ] Hinglish voiceover has phonetic syllable markers in all prompts
- [ ] First chunk uses nano-banana-pro start frame as first frame
- [ ] Subsequent chunks use FFmpeg-captured last frame
- [ ] Scene transitions use previous scene's last video as reference
- [ ] Gemini validates character consistency in generated chunks
- [ ] Failed chunks retry up to 2 times with corrected prompts
- [ ] All chunks stitch via FFmpeg into final video at 720p

### Real-time UI
- [ ] SSE connection established on pipeline start
- [ ] Chat messages appear as pipeline progresses
- [ ] Playground timeline updates in real time
- [ ] Completed chunks playable in playground immediately
- [ ] Final video plays in HTML5 player with download button

### Data Persistence
- [ ] All projects saved to SQLite
- [ ] Pipeline survives server restart (job state in DB)
- [ ] User's projects load on login

---

**Build this completely. Every page. Every agent. Every API integration. This is a production platform. Do not stop until every checklist item passes.**
