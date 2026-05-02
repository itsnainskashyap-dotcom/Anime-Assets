# AnimeStudioAI — Final UI Enhancement + Storyboard + Playground + Workflow Prompt
**Use this as the final Replit implementation prompt for the UI enhancement layer and connected workflow behavior.**

---

## CREATE A COMPLETE, POLISHED, CINEMATIC, PRODUCTION-GRADE WEB APPLICATION UI AND CONNECTED BACKEND LOGIC FOR `AnimeStudioAI`

You are building the **full UI enhancement layer plus the connected workflow behavior** for AnimeStudioAI.  
This prompt must **extend and improve the current AnimeStudioAI app**, not replace it blindly.  
Preserve everything valuable already present in the existing AnimeStudioAI prompt pack and current implementation, but **add all missing components, missing workflow logic, missing UI states, missing orchestration visibility, and missing backend integration behavior** described below.

The final result must feel like a **premium anime film studio operating system**, not a generic SaaS dashboard and not an AI-generated-looking template.

---

# 1. CORE PRODUCT DIRECTION

AnimeStudioAI is a **server-side autonomous anime content creation platform**.

A user can:
- write or refine a story,
- build a story bible,
- generate characters,
- generate environment packs,
- generate storyboard sheets,
- generate start/end frames,
- generate chunked videos,
- maintain continuity across chunks,
- generate songs / lyrics / lip-sync flows,
- inspect the whole pipeline visually,
- edit specific stages through chat,
- and receive final outputs.

The UI must communicate a feeling of:
- cinematic premium quality,
- handcrafted anime studio workflow,
- active intelligent orchestration,
- real progress visibility,
- and highly visual control without complexity overload.

---

# 2. DESIGN RULES

## 2.1 Visual identity
Use a **dark cinematic premium interface**.

Style goals:
- deep dark background
- refined contrast
- premium anime-studio mood
- smooth glass / layered panels where useful
- soft glow accents
- polished motion
- subtle gradients
- cinematic typography hierarchy
- dense but elegant professional layout

Avoid:
- generic AI-tool look
- flat boring SaaS cards
- loud overuse of gradients
- cheap neon overload
- cartoonish UI
- auto-generated icon feel

## 2.2 Asset rule
- Use uploaded/generated image assets as backgrounds where appropriate.
- Do **not** use obviously AI-generated icons.
- Create clean **PNG icons without background** and use them as UI icons/feature visuals where needed.
- Cards/sections that need visual support should include relevant generated images.
- UI must not look fake or template-like.

## 2.3 Motion rule
UI must remain **smooth, fluid, fast, and premium**.
Add subtle but polished motion using Framer Motion or equivalent:
- hover lift
- fade/slide section entry
- agent pulse states
- timeline progress animation
- glowing active nodes
- live status shimmer
- progress-line flow animation
- intelligent panel expansion
- skeleton loaders
- cinematic modal transitions

No laggy or overdone animation.

---

# 3. GLOBAL APP STRUCTURE

Create or enhance these main areas:

1. Landing page
2. Auth / onboarding
3. Create Project Wizard
4. Project Dashboard
5. Story Playground
6. Story Bible workspace
7. Character Studio
8. Environment Studio
9. Storyboard Builder
10. Visualization Pack Viewer
11. Chunk / Video Builder
12. Production Timeline
13. Final Output / Export Center
14. Credits / Billing / Usage
15. Profile / Settings
16. Admin Panel
17. Provider/API management
18. Queue / Worker monitor
19. Logs / Audit / Failure center

All major surfaces must feel visually consistent.

---

# 4. THE MOST IMPORTANT EXPERIENCE: STORY PLAYGROUND

## 4.1 Main concept
The **Playground** is the central interactive workspace where the entire production process is visible.

Everything important must appear here in animated, living form:
- Story
- Story Bible
- Characters
- Environments
- Storyboard
- Visualization Pack
- Production progress
- Final output previews

The Playground must not be static.  
It should feel like a **live studio floor** where work is happening.

## 4.2 Main layout
Use a desktop layout like this:

```txt
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Topbar: Project name | current stage | save status | generate controls | export shortcut   │
├───────────────────────────────┬───────────────────────────────────────┬─────────────────────┤
│ LEFT SIDEBAR                  │ MAIN PLAYGROUND CANVAS                │ RIGHT CHAT PANEL    │
│ Story / Bible / Characters    │ visual production stages              │ persistent chatbox   │
│ Environments / Storyboard     │ animated workflow cards               │ agent messages       │
│ Visualization / Chunks        │ active nodes + previews               │ edit requests        │
│ Final Output / Logs           │ timeline + selected stage detail       │ user commands        │
├───────────────────────────────┴───────────────────────────────────────┴─────────────────────┤
│ Bottom rail: chunk status | render queue | warnings | approvals | credits impact            │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 4.3 Persistent right-side chat panel
A **chatbox must remain open on one side** of the Playground.

This chatbox is essential.

It must show:
- user commands
- system guidance
- agent process logs in human-readable message form
- completion notifications
- warnings
- edit confirmations
- stage transitions

Examples:
- “Story Director is expanding Act 2 with stronger conflict.”
- “Story Bible Agent completed lore alignment.”
- “Character Director generated 4 main character candidates.”
- “Vision Analyzer extracted appearance cues from uploaded portrait.”
- “Storyboard Composer generated 8 panels for Chunk 03.”
- “Prompt Compiler prepared video prompt for Chunk 03.”
- “Animax Ultra payload prepared.”
- “Chunk 03 render completed.”

The chatbox must support:
- normal prompting
- rewrite commands
- act-specific editing
- scene-specific editing
- story finalization commands
- character editing commands
- storyboard regenerate commands
- chunk regenerate commands

User can type:
- “Rewrite the story”
- “Improve Act 2”
- “Make the climax darker”
- “Regenerate hero character”
- “Edit Chunk 4 prompt”
- “Regenerate storyboard for Scene 2 Chunk 1”
- “Change the environment to rainy Tokyo”

Also allow selecting an act/stage from the Playground and then editing it via chat.

---

# 5. STORY GENERATION FLOW

## 5.1 Story creation first
After project creation, the app must generate and display the **full story first** before character generation begins.

The full story must visibly include:
- title
- logline
- genre
- tone
- core theme
- setting
- protagonist summary
- antagonist / opposing force
- supporting cast summary
- story structure
- Act 1
- Act 2
- Act 3
- plot twists
- cliffhangers
- emotional beats
- climax
- resolution
- future hook if needed

## 5.2 Story quality requirements
Every generated story must be designed with:
- proper character development
- layered plot structure
- escalation
- conflict
- twists
- pacing
- cliffhangers
- climax
- emotional payoff
- coherence across acts

## 5.3 Finalize before next step
**Characters must NOT auto-build immediately after story write is generated.**

After the story is generated, show a **Story Finalization stage**.

UI must show:
- full story viewer
- act-by-act expandable cards
- edit buttons
- regenerate story button
- “Finalize Story” button
- “Edit specific act” action
- “Rewrite selected section” action

Only after the user finalizes the story should the character-building stage unlock.

## 5.4 Story editing workflow
User can:
- edit the whole story through chat
- select a specific act from Playground and edit it
- select a scene block and send instruction
- ask for rewrite
- ask for stronger climax
- ask for more romance
- ask for darker tone
- ask for more suspense
- ask for better plot twist

When story changes, Story Bible must re-sync automatically.

---

# 6. STORY BIBLE STAGE

After or alongside story finalization, create a **Story Bible** stage visible in the Playground.

It must show:
- world summary
- lore rules
- tone guide
- theme guide
- setting details
- timeline
- character relationships
- power/system rules if needed
- important props
- style references
- continuity constraints
- visual motifs

UI:
- Story Bible opens as animated cards
- sections expand smoothly
- can be edited through chat
- can be locked after approval

Agents visible:
- Story Director
- Story Bible Agent
- Continuity Brain

---

# 7. CHARACTER STUDIO

## 7.1 Unlock rule
Character generation appears only **after story finalization**.

Then the Playground reveals a **Character Panel** with all character names and statuses.

## 7.2 Character creation sources
User can:
1. let AI generate characters from the story,
2. upload reference images in chat,
3. upload a portrait directly,
4. combine story-based design + uploaded inspiration.

If user uploads a reference image, the system must use **Gemini 2.5 Flash vision analysis** to inspect the image and extract:
- appearance
- face structure
- hairstyle
- hair color
- skin tone
- outfit cues
- age vibe
- mood / attitude
- accessories
- character energy

Then build a character consistent with that reference.

If user uploads a direct portrait and wants that character used, the pipeline must support that too.

## 7.3 Character cards
Each character card must show:
- name
- role
- short bio
- appearance summary
- personality traits
- story function
- reference source status
- generation status
- approval status

Actions:
- regenerate
- edit
- lock character
- upload reference
- compare versions
- approve

## 7.4 Turnaround / angle sheets
After character image is generated and approved, automatically create a **turnaround sheet** for each character.

This must be one image containing multiple consistent angles:
- front
- left
- right
- back or 3/4 back
- upper body if needed
- expression strip optionally

If user uploads a portrait/reference character, the app must still auto-generate the full angle sheet with continuity.

This stage must appear visibly in Playground.

---

# 8. ENVIRONMENT STUDIO

Generate environment packs after story and primary characters are stable.

Show:
- main locations
- environment mood boards
- time-of-day variants
- weather variants if needed
- continuity notes

Actions:
- regenerate environment
- edit through chat
- lock environment
- compare variants

Use this to support consistency in storyboard and frame generation.

---

# 9. STORYBOARD BUILDER

## 9.1 Core rule
For each video chunk, create **one composite storyboard sheet**.

The storyboard sheet must be built **according to the same scene logic and same video prompt logic that will be sent to the video model**.

Very important:
- The storyboard must not be generic.
- The storyboard must reflect the exact shot flow implied by the actual chunk video prompt.
- Because the video model uses the storyboard to understand cut structure and scene progression, the storyboard generation prompt and the video generation prompt must be aligned.

## 9.2 Storyboard chunk rule
Default chunk duration for storyboard planning:
- 10 seconds per storyboard chunk in storyboard planning mode
- If the video stage later supports 15-second chunk generation, storyboard can still map the required cut sequence precisely for that chunk duration
- panel count should adapt to shot density

Storyboard sheet rules:
- 1 chunk = 1 sheet
- 4–12 numbered panels
- default 8
- cinematic anime style
- consistent character appearance
- consistent environment
- no social UI overlays
- only title “STORYBOARD” and panel numbers
- clean professional grid

## 9.3 Storyboard UI placement
Add or preserve these exact surfaces:
- Create Wizard: Storyboard Mode step
- Storyboard Builder page
- Visualization Pack page
- Playground Storyboard stage
- Chunk Inspector Storyboard tab
- Production Timeline storyboard markers
- Admin Storyboard Ops

## 9.4 Storyboard generation relationship to video prompt
For every chunk:
1. Shot Planner creates structured shot list.
2. Prompt Compiler builds the chunk video prompt.
3. Storyboard Composer uses the same shot plan + same scene intent + same character/environment locks to create the storyboard sheet.
4. The storyboard is stored, previewed, validated, and passed as a reference image.
5. Only then the video payload is finalized.

---

# 10. VISUALIZATION PACK

For every chunk, create a Visualization Pack that contains:
- start frame
- end frame
- storyboard sheet
- character refs
- environment refs
- angle sheets if useful
- continuity memory summary
- prompt summary

This must appear as a dedicated stage in the Playground and as a dedicated page/viewer.

Everything should animate in and feel alive.

---

# 11. VIDEO GENERATION WORKFLOW

## 11.1 Hidden provider behavior
Keep the user-facing video model name as **Animax Ultra** in the UI.

Internally, the real video model is:
`kling-v3-omni-pro`

Do not expose raw provider details in normal user-facing UI except where admin/dev visibility is required.

## 11.2 Chunk generation logic
The video pipeline must:
- split scenes into chunks
- maintain continuity
- generate video prompts per chunk
- prepare start frame and end frame
- prepare storyboard sheet
- attach required references
- send payload to the video provider
- store outputs
- extract approved ending continuity for next chunk

## 11.3 Reference behavior
For chunk 1:
- use start frame
- use end frame guidance if supported in flow
- use storyboard
- use character refs
- use environment refs
- use element refs

For chunk 2 and onward:
- use previous chunk approved end frame as next start continuity source
- if provider route supports reference video through the current Magnific mapping, send previous chunk video reference URL as well
- also send storyboard + image references as needed

Implement provider payload mapping so chunk n can use:
- `start_image_url`
- `end_image_url`
- `image_url` or equivalent reference fields
- `elements`
- `reference_video_url` or equivalent supported field if the route supports it

## 11.4 Continuity rule
The approved ending result of one chunk becomes continuity input for the next chunk.

Continuity memory must track:
- exact character look
- environment state
- prop state
- lighting/time state
- motion continuity
- emotional continuity
- shot intent continuity

---

# 12. PROMPT GENERATION RULES

## 12.1 Story prompt quality
Story prompts must aim for:
- strong narrative structure
- compelling arc
- emotional clarity
- cinematic readability

## 12.2 Character image generation prompts
For character generation through the image model, prompt templates must include quality markers and clear structure.

Use premium quality language such as:
- masterpiece
- best quality
- ultra-detailed
- professional character sheet quality
- anime production design sheet
- consistent identity
- clean silhouette
- sharp facial features
- high fidelity costume detail

Include negative prompt patterns to reduce:
- blurry
- low quality
- extra limbs
- duplicate characters
- wrong costume
- wrong color palette
- inconsistent face
- deformed hands
- bad anatomy

## 12.3 Storyboard prompt rule
Storyboard prompt must be created using the same chunk understanding as the video prompt.

## 12.4 Video prompt rule
Chunk video prompts must be compact, precise, continuity-aware, and aligned with storyboard structure.

---

# 13. PLAYGROUND STAGES THAT MUST BE VISIBLE

The Playground must visually show these stages in order, with animated cards or connected nodes:

1. Story Intake
2. Story Director
3. Story Finalization
4. Story Bible
5. Character Studio
6. Character Turnaround Sheets
7. Environment Studio
8. Start/End Frame Generator
9. Storyboard Composer
10. Visualization Pack
11. Prompt Compiler
12. Video Generation
13. Quality Check
14. Final Assembly / Export

Each stage should show:
- status
- agent name
- summary of work
- latest message
- approval state
- errors/warnings if any
- view details action

---

# 14. AGENT MESSAGES IN CHAT

Every major agent must post readable updates in the right chat panel.

Agents include:
- Story Director
- Story Bible Agent
- Character Director
- Vision Analyzer
- Environment Director
- Storyboard Composer
- Visualization Director
- Prompt Compiler
- Continuity Brain
- Video Orchestrator
- Quality Validator
- Export Agent

Examples:
- “Character Director: Main cast draft is ready for review.”
- “Vision Analyzer: Uploaded portrait analyzed. Hair, age vibe, and costume cues extracted.”
- “Storyboard Composer: 8-panel sheet generated for Chunk 02 based on final video prompt.”
- “Continuity Brain: Chunk 03 locked to Chunk 02 ending state.”
- “Video Orchestrator: Payload for Animax Ultra prepared and queued.”
- “Quality Validator: End frame accepted for next chunk continuity.”

---

# 15. USER APPROVAL FLOW

Require explicit approval checkpoints for:
- story finalization
- character finalization
- optional environment finalization
- storyboard approval if approval-required mode is enabled
- final output acceptance

Do not auto-rush the user into the next stage when the stage is meant to be reviewable.

---

# 16. BACKEND / SERVER-SIDE REQUIREMENTS

Everything must be server-side and resilient.

If user:
- closes tab
- goes back
- refreshes
- logs out
- loses network

the process must continue safely server-side.

Implement:
- job queue
- worker system
- job states
- retries
- idempotency keys
- heartbeat
- resumable progress
- live updates
- event logs
- partial failure handling
- approval state persistence

---

# 17. ADMIN PANEL REQUIREMENTS

The admin panel must include all needed operational controls.

Sections:
- dashboard
- users
- projects
- jobs
- queue monitor
- storyboards
- video tasks
- exports
- billing / credits
- logs
- error center
- provider health
- storage monitor
- audit logs
- API key management

## 17.1 Multi-API management
Admin must be able to:
- configure multiple Magnific / Freepik-related API keys
- enable/disable keys
- reorder priority
- set fallback rules
- view quota/health/error status
- automatically fail over to the next key when one key fails or exhausts credits
- test keys
- mark key as unhealthy
- see which key processed which job

---

# 18. REQUIRED DATABASE / DATA OBJECTS

Ensure the system stores and manages:
- projects
- stories
- acts
- scenes
- story bible
- character profiles
- character approvals
- character turnaround sheets
- environment packs
- storyboard sheets
- storyboard panels
- visualization packs
- chunk prompts
- chunk outputs
- continuity memory
- chat messages
- agent events
- jobs
- approvals
- exports
- billing ledger
- api keys
- provider failover logs
- audit logs

---

# 19. STORYBOARD + VIDEO REFERENCE MAPPING RULE

Implement this exact behavior:

For each chunk, the system must prepare the following reference set in priority order:
1. start frame
2. end frame / end target where applicable
3. storyboard sheet
4. character references
5. character turnaround sheets if useful
6. environment references
7. previous chunk video reference if supported for this route
8. additional elements

The final provider payload builder must intelligently include what the current provider route supports.

Important:
If the route supports previous video reference, use it from chunk 2 onward.
If it does not, fall back to end-frame/start-frame continuity and storyboard continuity.

---

# 20. QUALITY INSPECTION / VISION VALIDATION

Use **Gemini 2.5 Flash** for:
- OCR
- image inspection
- visual consistency checks
- character appearance validation
- environment validation
- storyboard readability checks
- output inspection

It must validate:
- character consistency
- outfit consistency
- environment consistency
- panel sequence quality
- unwanted text
- visible defects
- mismatch vs story intent

---

# 21. STORYBOARD PAGE / BUILDER DETAILS

The Storyboard Builder must keep:
- left rail for scenes/chunks
- large center storyboard canvas
- right inspector with tabs:
  - Shot List
  - Prompt
  - References
  - Validation
  - History
- bottom action bar

Storyboards must be downloadable, viewable fullscreen, comparable across retries, and clearly marked as reference-ready.

---

# 22. CHUNK INSPECTOR

Every chunk must have a detailed inspector with tabs:
- Storyboard
- Visualization
- Prompt
- Payload
- Validation
- Output

This must help debugging and regeneration.

---

# 23. FINAL OUTPUT CENTER

Show:
- rendered chunks
- assembled final video
- subtitles / SRT if applicable
- song output if applicable
- soundtrack data
- alternate versions
- downloadable assets
- export formats
- quality notes

---

# 24. UI STATE REQUIREMENTS

Every major section must have:
- loading state
- skeleton state
- empty state
- success state
- error state
- reconnect state
- retry state

Examples:
- “Planning story arcs...”
- “Waiting for story finalization...”
- “Generating character turnaround sheet...”
- “Preparing storyboard reference...”
- “Rendering chunk 04...”
- “Reconnecting to live project updates...”

---

# 25. MOBILE / RESPONSIVE RULES

The platform must be responsive.

On mobile:
- Playground becomes stacked
- chat panel becomes drawer or bottom sheet
- inspector panels collapse into tabs
- timeline becomes swipeable
- story/stage viewers remain readable
- no broken controls
- no unreadable dense panels

---

# 26. IMPLEMENTATION PRIORITY

Build in this order:

1. Preserve existing valuable UI and connected backend
2. Enhance Playground
3. Add persistent right-side chat panel with agent messages
4. Enforce story finalization before character generation
5. Add Character Studio with upload/reference vision path
6. Add turnaround sheet generation
7. Add Environment Studio
8. Add Storyboard Builder with exact placement and payload role
9. Add Visualization Pack
10. Connect chunk prompt + storyboard alignment
11. Connect video reference flow for next chunks
12. Add admin controls and failover
13. Polish all states and motion

---

# 27. FINAL ACCEPTANCE CHECKLIST

The build is complete only if all are true:

- UI looks premium, cinematic, smooth, and non-generic
- uploaded/generated image assets are used intelligently
- icons are clean PNG-style, not ugly AI icons
- Playground shows all major stages as animated production steps
- right chat panel stays open and receives agent process messages
- story is generated first and shown fully
- story includes plot twists, character development, cliffhanger, climax
- story must be finalized before characters build
- user can edit specific act/section from chat or from selected stage
- Story Bible appears and stays synced
- characters can be generated from story or uploaded reference
- Gemini 2.5 Flash analyzes uploaded images
- character cards support regenerate / approve / edit
- turnaround angle sheets are auto-generated for every finalized character
- environments are generated and manageable
- storyboard is generated according to the same chunk logic as the video prompt
- storyboard appears in builder, visualization pack, playground, inspector, timeline
- start frame / end frame / storyboard / refs are prepared before video generation
- chunk 2 onward can use previous chunk continuity and previous video reference when supported
- user-facing model name stays Animax Ultra
- internal model mapping supports kling-v3-omni-pro
- server-side jobs continue even after refresh/logout
- admin panel has multi-key failover and provider controls
- quality inspection uses Gemini 2.5 Flash
- final output center is complete
- animations remain smooth
- mobile layout works
- nothing important from the earlier UI enhancement scope is removed

---

# 28. FINAL BUILD INSTRUCTION

Implement this as a **complete enhancement layer** on top of the current AnimeStudioAI application and prompt pack.

Do not omit backend behavior.  
Do not only make the UI mockup.  
Do not only add visuals.  
Do not only create pages without logic.

Every major UI section must be connected to meaningful data flow, status flow, or backend operation.

The result must feel like a real premium anime production operating system with visible intelligent orchestration, editable workflow, and end-to-end continuity.
