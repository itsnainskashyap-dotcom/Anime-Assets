import { ComponentType, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, BookOpen, Users, LayoutTemplate, Layers, Film,
  Download, Send, Loader2, ShieldCheck, CheckCircle2, Circle,
  RadioTower, AlertTriangle, MessageSquare, ChevronDown, ChevronUp,
} from "lucide-react";
import { PiMagicWandDuotone, PiBookOpenDuotone, PiUsersDuotone, PiFilmScriptDuotone } from "react-icons/pi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AgentLog, PlaygroundEvent, Project } from "@/types/api";

const LANG_FLAG: Record<string, string> = {
  en: "🇬🇧", hi: "🇮🇳", "hi-en": "🇮🇳", es: "🇪🇸", ja: "🇯🇵",
  ko: "🇰🇷", fr: "🇫🇷", pt: "🇧🇷", zh: "🇨🇳", ar: "🇸🇦",
};
const LANG_NAME: Record<string, string> = {
  en: "English", hi: "हिंदी", "hi-en": "Hinglish", es: "Español", ja: "日本語",
  ko: "한국어", fr: "Français", pt: "Português", zh: "中文", ar: "العربية",
};

/* -------------------------------------------------------------------------- */
/*                              STAGE DEFINITIONS                              */
/* -------------------------------------------------------------------------- */

interface Stage {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  agent: string;
  description: string;
  /** Project.current_stage values that map to this UI stage. */
  backendStages: string[];
  /** Pipeline progress floor — used for the global progress bar. */
  progressFloor: number;
  matchEvent: (e: PlaygroundEvent) => boolean;
}

/**
 * 6 stages — one per real backend pipeline phase. These mirror the
 * `setProjectStage` calls in `artifacts/api-server/src/jobs/handlers.ts`.
 * Anything outside this list (intake, environments, qc, prompt-compiler) was
 * placeholder UI that never received events from the backend.
 */
const STAGES: Stage[] = [
  {
    id: "story",
    label: "Story Director",
    icon: PiMagicWandDuotone,
    agent: "Story Director",
    description:
      "Writes the story bible — acts, scenes, characters, themes — then auto-finalizes it.",
    backendStages: ["story_bible", "story_bible_ready", "story_finalized"],
    progressFloor: 0,
    matchEvent: (e) =>
      /story_bible|story_director|story_finalized|story_unfinalized|awaiting_finalization|story_prompt|project_created/i.test(
        e.event_type,
      ),
  },
  {
    id: "characters",
    label: "Character Studio",
    icon: Users,
    agent: "Character Director",
    description:
      "Generates the full-body portrait + 3-angle turnaround sheets, then locks each character as canon.",
    backendStages: ["characters", "characters_ready", "characters_locked"],
    progressFloor: 25,
    matchEvent: (e) =>
      /character|turnaround|angle_sheet|characters_canonized/i.test(e.event_type),
  },
  {
    id: "storyboard",
    label: "Storyboard Composer",
    icon: LayoutTemplate,
    agent: "Storyboard Composer",
    description: "Splits scenes into 10-second chunks ready for rendering.",
    backendStages: ["storyboard", "storyboard_ready"],
    progressFloor: 50,
    matchEvent: (e) => /storyboard/i.test(e.event_type),
  },
  {
    id: "visualization",
    label: "Visualization Pack",
    icon: Layers,
    agent: "Visualization Director",
    description:
      "Per-scene start/end frames + scene boards + element refs — anchored on the canon character portraits.",
    backendStages: ["visualization", "visualization_ready"],
    progressFloor: 60,
    matchEvent: (e) =>
      /visualization|viz_pack|start_frame|end_frame|scene_board|element_ref/i.test(
        e.event_type,
      ),
  },
  {
    id: "video",
    label: "Animax Ultra · Video",
    icon: Film,
    agent: "Video Orchestrator",
    description:
      "Renders each 10-second chunk with continuity from chunk N−1.",
    backendStages: ["video", "rendering"],
    progressFloor: 70,
    matchEvent: (e) =>
      /chunk_(queued|started|completed|video|failed)|video_(chunk|render)|render_/i.test(
        e.event_type,
      ),
  },
  {
    id: "export",
    label: "Final Assembly",
    icon: Download,
    agent: "Export Agent",
    description:
      "Stitches the master, bakes subtitles, optionally renders song & lipsync, and produces the downloadable file.",
    backendStages: ["exporting", "completed", "export_failed"],
    progressFloor: 90,
    matchEvent: (e) =>
      /export|assembly|master_render|song|lipsync|audio_chunk/i.test(e.event_type),
  },
];

/** Map every known `project.current_stage` value to a UI stage id. */
const CURRENT_STAGE_TO_UI: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const s of STAGES) for (const k of s.backendStages) map[k] = s.id;
  return map;
})();

interface StageState {
  status: "idle" | "active" | "complete" | "error";
  lastMessage?: string;
  lastAt?: string;
  count: number;
}

function deriveStageStates(
  events: PlaygroundEvent[],
  project: Project,
): Record<string, StageState> {
  const out: Record<string, StageState> = {};
  for (const s of STAGES) out[s.id] = { status: "idle", count: 0 };
  // Walk chronologically (events arrive newest-first from the API).
  const ordered = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const e of ordered) {
    for (const s of STAGES) {
      if (!s.matchEvent(e)) continue;
      const cur = out[s.id];
      cur.count += 1;
      cur.lastMessage = e.message ?? cur.lastMessage;
      cur.lastAt = e.created_at;
      if (/error|failed/i.test(e.event_type)) cur.status = "error";
      else if (
        /(completed|approved|ready|finalized|locked|generated|canonized)/i.test(
          e.event_type,
        )
      )
        cur.status = "complete";
      else cur.status = "active";
    }
  }
  // Promote stages that the backend has clearly already passed: any stage
  // with a higher progress floor than the next one being active means the
  // earlier stage is complete even if no terminal event was recorded.
  const currentUiStage = project.current_stage
    ? CURRENT_STAGE_TO_UI[project.current_stage]
    : undefined;
  if (currentUiStage) {
    const currentIdx = STAGES.findIndex((s) => s.id === currentUiStage);
    for (let i = 0; i < currentIdx; i++) {
      if (out[STAGES[i].id].status === "idle") {
        out[STAGES[i].id].status = "complete";
      }
    }
    if (out[currentUiStage].status === "idle") {
      out[currentUiStage].status = "active";
    }
  }
  // Story finalization is a hard signal.
  if (project.story_finalized_at && out.story.status !== "error") {
    out.story.status = "complete";
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*                                  CHAT BUBBLE                                */
/* -------------------------------------------------------------------------- */

function isUserEvent(e: PlaygroundEvent): boolean {
  return e.event_type === "user_message" || (e.agent ?? "").toLowerCase() === "you";
}
function isAgentMessage(e: PlaygroundEvent): boolean {
  return e.event_type === "agent_message" || isUserEvent(e) || !!e.agent;
}

function ChatBubble({ event }: { event: PlaygroundEvent }) {
  const mine = isUserEvent(event);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
    >
      <div className="text-[10px] font-medium text-muted-foreground/60 px-1 mb-1 uppercase tracking-wider">
        {event.agent || "System"} · {new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div
        className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-sm leading-snug border backdrop-blur-sm ${
          mine
            ? "bg-primary/15 border-primary/30 text-foreground rounded-br-sm"
            : "bg-card/70 border-border/60 text-foreground/90 rounded-bl-sm"
        }`}
      >
        {event.message}
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

export default function PlaygroundTab({ project }: { project: Project }) {
  const { token, api } = useAuth();
  const [events, setEvents] = useState<PlaygroundEvent[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "reconnecting" | "error">("connecting");
  // Default the active stage to whatever phase the backend says we're in.
  // Falls back to "story" for brand-new projects.
  const initialStage =
    (project.current_stage && CURRENT_STAGE_TO_UI[project.current_stage]) || "story";
  const [selectedStage, setSelectedStage] = useState<string>(initialStage);
  // If the user hasn't manually clicked a stage, keep selectedStage in sync
  // with the backend as the pipeline progresses.
  const [stageManuallySelected, setStageManuallySelected] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [storyDataOpen, setStoryDataOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stageManuallySelected) return;
    const target = project.current_stage
      ? CURRENT_STAGE_TO_UI[project.current_stage]
      : undefined;
    if (target && target !== selectedStage) setSelectedStage(target);
  }, [project.current_stage, stageManuallySelected, selectedStage]);

  const selectStage = (id: string): void => {
    setStageManuallySelected(true);
    setSelectedStage(id);
  };

  const lang = project.language || "en";
  const langFlag = LANG_FLAG[lang] || "🌐";
  const langName = LANG_NAME[lang] || lang.toUpperCase();

  /* ----- Story data queries (for rich data panel) ---------------------- */
  const { data: bible } = useQuery<Record<string, unknown> | null>({
    queryKey: ["projects", project.id, "story-bible"],
    queryFn: async () => {
      const res = await api(`/api/projects/${project.id}/story-bible`);
      return res.json();
    },
    staleTime: 30_000,
  });
  const { data: characters } = useQuery<{ name?: string; role?: string; backstory?: string; voiceDescription?: string; sampleDialogue?: string[] }[]>({
    queryKey: ["projects", project.id, "characters"],
    queryFn: async () => {
      const res = await api(`/api/projects/${project.id}/characters`);
      return res.json();
    },
    staleTime: 30_000,
  });

  const bibleGenerating = bible && bible.status === "generating";
  const bibleReady = bible && (bible.status === "ready" || bible.status === "approved");
  const parsedBible = bibleReady && bible.arcs_json ? (() => {
    try { return JSON.parse(bible.arcs_json as string) as Record<string, unknown>; } catch { return null; }
  })() : null;
  const synopsis = parsedBible ? (parsedBible.synopsis as string) || (bible?.summary as string) : (bible?.summary as string);
  const themes = parsedBible && Array.isArray(parsedBible.themes) ? parsedBible.themes as string[] : [];
  const acts = parsedBible && Array.isArray(parsedBible.acts) ? parsedBible.acts as { title?: string; summary?: string; estimatedDurationSeconds?: number }[] : [];
  const scenes = parsedBible && Array.isArray(parsedBible.scenes) ? parsedBible.scenes as { sceneNumber?: number; title?: string; location?: string; emotion?: string; keyDialogue?: string[] }[] : [];

  /* ------------------------------ SSE pipeline ----------------------------- */
  useEffect(() => {
    let active = true;
    let retryCount = 0;
    let abortController = new AbortController();

    const connect = async (): Promise<void> => {
      if (!active) return;
      setStatus(retryCount === 0 ? "connecting" : "reconnecting");
      abortController = new AbortController();
      try {
        const url = import.meta.env.BASE_URL + `api/projects/${project.id}/playground/events`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
        });
        if (!res.ok) throw new Error("Failed to connect");
        setStatus("connected");
        retryCount = 0;
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split("\n\n");
            buffer = blocks.pop() || "";
            for (const block of blocks) {
              const eventMatch = block.match(/^event:\s*(.+)$/m);
              const dataMatch = block.match(/^data:\s*(.+)$/m);
              if (!eventMatch || !dataMatch) continue;
              const eventName = eventMatch[1].trim();
              try {
                const data = JSON.parse(dataMatch[1].trim()) as
                  | { events?: PlaygroundEvent[]; agentLogs?: AgentLog[] }
                  | (PlaygroundEvent & { eventType?: string; payload?: unknown; ts?: string })
                  | (AgentLog & { agent?: string });
                if (eventName === "history") {
                  const h = data as { events?: PlaygroundEvent[]; agentLogs?: AgentLog[] };
                  if (h.events) setEvents(h.events.slice().reverse());
                  if (h.agentLogs) setLogs(h.agentLogs.slice().reverse());
                } else if (eventName === "playground_event" || eventName === "playground") {
                  const raw = data as PlaygroundEvent & { eventType?: string; ts?: string; payload?: unknown };
                  const normalized: PlaygroundEvent = {
                    id: raw.id,
                    event_type: raw.event_type ?? raw.eventType ?? "",
                    agent: raw.agent ?? null,
                    message: raw.message ?? "",
                    payload_json: raw.payload_json ?? (raw.payload ? JSON.stringify(raw.payload) : null),
                    created_at: raw.created_at ?? raw.ts ?? new Date().toISOString(),
                  };
                  setEvents((prev) => [...prev, normalized].slice(-200));
                } else if (eventName === "agent_log") {
                  const raw = data as AgentLog & { agent?: string };
                  const normalized: AgentLog = {
                    id: raw.id,
                    agent_name: raw.agent_name ?? raw.agent ?? "agent",
                    level: raw.level ?? "info",
                    message: raw.message,
                    metadata_json: raw.metadata_json ?? null,
                    created_at: raw.created_at ?? new Date().toISOString(),
                  };
                  setLogs((prev) => [...prev, normalized].slice(-200));
                }
              } catch (err) {
                console.error("SSE parse error", err);
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setStatus("error");
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        retryCount += 1;
        setTimeout(connect, delay);
      }
    };

    connect();
    return () => { active = false; abortController.abort(); };
  }, [project.id, token]);

  /* ------------------------------ Auto-scroll chat ------------------------- */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  /* ------------------------------ Derived data ----------------------------- */
  const stageStates = useMemo(() => deriveStageStates(events, project), [events, project]);
  const chatEvents = useMemo(
    () => events.filter((e) => isAgentMessage(e) && (e.message ?? "").length > 0),
    [events],
  );
  const activeStage = STAGES.find((s) => s.id === selectedStage) ?? STAGES[0];
  const activeStageState = stageStates[activeStage.id];
  const stageActivityEvents = useMemo(
    () => events.filter((e) => activeStage.matchEvent(e)).slice(-8).reverse(),
    [events, activeStage],
  );
  // Pipeline progress — prefer the backend's authoritative number, otherwise
  // derive a floor from how many UI stages have completed.
  const completedCount = Object.values(stageStates).filter((s) => s.status === "complete").length;
  const derivedProgress = (completedCount / STAGES.length) * 100;
  const overallProgress = Math.max(project.progress ?? 0, derivedProgress);

  /* ------------------------------ Mutations -------------------------------- */
  const sendChat = useMutation({
    mutationFn: (message: string) =>
      api(`/api/projects/${project.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message, stage: selectedStage }),
      }),
  });

  const handleSend = (): void => {
    const msg = chatInput.trim();
    if (!msg) return;
    setChatInput("");
    sendChat.mutate(msg);
  };

  /* ------------------------------ Render ----------------------------------- */
  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background via-background to-primary/[0.02] overflow-hidden">

      {/* TOP BAR */}
      <div className="shrink-0 border-b border-border/50 bg-card/30 backdrop-blur">
        <div className="h-12 flex items-center px-4 gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${status === "connected" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span className="text-muted-foreground uppercase tracking-wider font-medium">
              {status === "connected" ? "Live" : status === "connecting" ? "Connecting" : status === "reconnecting" ? "Reconnecting" : "Offline"}
            </span>
          </div>
          <div className="h-4 w-px bg-border/60" />
          <div className="text-xs text-muted-foreground">
            Current stage: <span className="text-foreground font-medium">{activeStage.label}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-300/80">
              <ShieldCheck className="w-3 h-3" /> Auto-pilot
            </span>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {events.length} events · {logs.length} logs
            </div>
          </div>
        </div>
        {/* Pipeline progress bar */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            <span>Pipeline progress</span>
            <span className="text-foreground font-medium">{Math.round(overallProgress)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-card/60 overflow-hidden">
            <motion.div
              initial={false}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-primary/70 via-primary to-emerald-400"
            />
          </div>
        </div>
      </div>

      {/* MOBILE — horizontal stage rail (hidden on md+) */}
      <div className="md:hidden border-b border-border/50 bg-card/20 overflow-x-auto scrollbar-none flex gap-1.5 px-3 py-2 shrink-0">
        {STAGES.map((s) => {
          const st = stageStates[s.id];
          const isActive = selectedStage === s.id;
          const Icon = s.icon;
          const dotColor =
            st.status === "complete" ? "bg-emerald-400"
            : st.status === "active" ? "bg-primary animate-pulse"
            : st.status === "error" ? "bg-destructive"
            : "bg-muted-foreground/30";
          return (
            <button
              key={s.id}
              onClick={() => selectStage(s.id)}
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs whitespace-nowrap transition-all ${
                isActive
                  ? "bg-primary/10 border-primary/40 text-foreground"
                  : "bg-card/40 border-border/40 text-muted-foreground"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
              <Icon className="w-3 h-3" />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex min-h-0">

        {/* LEFT — STAGE TIMELINE (desktop only) */}
        <aside className="hidden md:flex w-[280px] shrink-0 border-r border-border/50 bg-card/20 flex-col">
          <div className="p-4 border-b border-border/40">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
              <RadioTower className="w-3 h-3" /> Production Stages
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-none p-2 space-y-1">
            {STAGES.map((s, idx) => {
              const st = stageStates[s.id];
              const isActive = selectedStage === s.id;
              const Icon = s.icon;
              const dotColor =
                st.status === "complete" ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]"
                : st.status === "active" ? "bg-primary animate-pulse shadow-[0_0_10px_hsl(var(--primary)/0.6)]"
                : st.status === "error" ? "bg-destructive"
                : "bg-muted-foreground/30";
              return (
                <button
                  key={s.id}
                  onClick={() => selectStage(s.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-all flex items-start gap-3 group relative ${
                    isActive
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-card/60 border border-transparent"
                  }`}
                >
                  <div className="relative pt-0.5">
                    <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                    {idx < STAGES.length - 1 && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-px h-[34px] bg-border/40" />
                    )}
                  </div>
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium truncate ${isActive ? "text-foreground" : "text-foreground/80"}`}>
                      {s.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {st.status === "idle" ? "waiting" : st.status}
                      {st.count > 0 && ` · ${st.count}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* CENTER — STAGE DETAIL */}
        <main className="flex-1 min-w-0 overflow-y-auto scrollbar-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStage.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="p-8 space-y-6 max-w-3xl mx-auto"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center shrink-0">
                  <activeStage.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary/80">
                    {activeStage.agent}
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight mt-0.5">{activeStage.label}</h2>
                  <p className="text-muted-foreground text-sm mt-1">{activeStage.description}</p>
                </div>
                <StageStatusBadge status={activeStageState.status} />
              </div>

              {/* Latest message card */}
              <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur p-5 space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  <PiMagicWandDuotone className="w-3 h-3 text-primary" /> Latest from {activeStage.agent}
                </div>
                <p className="text-foreground/90 text-sm leading-relaxed min-h-[2.5rem]">
                  {activeStageState.lastMessage || (
                    <span className="text-muted-foreground italic">No activity yet — this stage will light up when the upstream agent kicks it off.</span>
                  )}
                </p>
                {activeStageState.lastAt && (
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {new Date(activeStageState.lastAt).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Recent events for this stage — only render when there's data */}
              {stageActivityEvents.length > 0 && (
                <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur p-5">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4">
                    <Activity className="w-3 h-3" /> Stage Activity
                    <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-muted-foreground/60">
                      Last {stageActivityEvents.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {stageActivityEvents.map((e) => (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-3 text-xs p-2.5 rounded-lg bg-background/40 border border-border/30"
                      >
                        <Circle className="w-2 h-2 fill-primary text-primary shrink-0 mt-1.5" />
                        <div className="min-w-0 flex-1">
                          <div className="text-foreground/90">{e.message || e.event_type}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
                            {e.event_type} · {new Date(e.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Bible Generating Banner — only on the story stage ────── */}
              {activeStage.id === "story" && bibleGenerating && !bibleReady && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3"
                >
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Story Director is writing your bible…</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      All descriptions in English · Voiceover lines in {langFlag} {langName}.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Story Data Panel ─────────────────────────────────── */}
              {bibleReady && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-2xl border border-border/50 bg-card/20 backdrop-blur overflow-hidden"
                >
                  {/* Collapsible header */}
                  <button
                    onClick={() => setStoryDataOpen((v) => !v)}
                    className="w-full flex items-center gap-3 p-5 hover:bg-primary/5 transition-colors"
                  >
                    <PiBookOpenDuotone className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground flex-1 text-left">
                      Story Bible
                    </span>
                    {/* Language badge — voiceover only */}
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-primary/10 border border-primary/20 text-primary rounded-full px-2 py-0.5 mr-2">
                      {langFlag} VO: {langName}
                    </span>
                    {storyDataOpen ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                  </button>

                  <AnimatePresence>
                    {storyDataOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 space-y-4 border-t border-border/30">
                          {/* Synopsis */}
                          {synopsis && (
                            <motion.div
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="pt-4 space-y-1.5"
                            >
                              <div className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Synopsis</div>
                              <p className="text-sm text-muted-foreground leading-relaxed">{synopsis}</p>
                            </motion.div>
                          )}

                          {/* Themes */}
                          {themes.length > 0 && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="space-y-1.5">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Themes</div>
                              <div className="flex flex-wrap gap-1.5">
                                {themes.map((t, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] border-primary/30 text-primary/80">{t}</Badge>
                                ))}
                              </div>
                            </motion.div>
                          )}

                          {/* Acts */}
                          {acts.length > 0 && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }} className="space-y-1.5">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-primary/70 flex items-center gap-1.5">
                                <PiFilmScriptDuotone className="w-3 h-3" /> Acts ({acts.length})
                              </div>
                              <div className="space-y-2">
                                {acts.map((a, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.04 * i }}
                                    className="flex gap-2.5 p-2.5 rounded-lg bg-background/30 border border-border/30"
                                  >
                                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">{i + 1}</div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold truncate">{a.title}</p>
                                      {a.summary && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{a.summary}</p>}
                                      {a.estimatedDurationSeconds && (
                                        <p className="text-[10px] text-primary/60 mt-0.5">{Math.round(a.estimatedDurationSeconds / 60)}m {a.estimatedDurationSeconds % 60}s</p>
                                      )}
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          )}

                          {/* Characters */}
                          {characters && characters.length > 0 && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-1.5">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-primary/70 flex items-center gap-1.5">
                                <PiUsersDuotone className="w-3 h-3" /> Characters ({characters.length})
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {characters.map((c, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.96 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.05 * i }}
                                    className="p-2.5 rounded-lg bg-background/30 border border-border/30 space-y-1"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-primary text-[9px] font-bold shrink-0">
                                        {c.name?.charAt(0) || "?"}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold truncate">{c.name}</p>
                                        {c.role && <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{c.role}</p>}
                                      </div>
                                    </div>
                                    {c.sampleDialogue && c.sampleDialogue[0] && (
                                      <div className="flex items-start gap-1">
                                        <span className="text-[9px] text-primary/50 shrink-0">{langFlag}</span>
                                        <p className="text-[10px] text-amber-300/70 italic line-clamp-2">"{c.sampleDialogue[0]}"</p>
                                      </div>
                                    )}
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          )}

                          {/* Scenes count + sample */}
                          {scenes.length > 0 && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }} className="space-y-1.5">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
                                Scenes ({scenes.length} total)
                              </div>
                              <div className="space-y-2">
                                {scenes.slice(0, 5).map((s, i) => (
                                  <div key={i} className="p-2 rounded-lg bg-background/30 border border-border/30 space-y-1">
                                    <div className="flex gap-2 text-[10px]">
                                      <span className="text-primary/60 shrink-0 font-mono w-4">{s.sceneNumber ?? i + 1}.</span>
                                      <span className="text-foreground/80 font-medium truncate">{s.title}</span>
                                      {s.emotion && <Badge variant="outline" className="text-[9px] border-amber-500/20 text-amber-400/70 shrink-0">{s.emotion}</Badge>}
                                      {s.location && <span className="text-muted-foreground/60 shrink-0 truncate hidden sm:block">{s.location}</span>}
                                    </div>
                                    {s.keyDialogue && s.keyDialogue[0] && (
                                      <div className="flex items-start gap-1.5 pl-6">
                                        <span className="text-[9px] uppercase tracking-wider text-primary/50 shrink-0 mt-0.5">{langFlag} VO</span>
                                        <p className="text-[10px] text-amber-300/70 italic line-clamp-1">"{s.keyDialogue[0]}"</p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {scenes.length > 5 && (
                                  <p className="text-[10px] text-muted-foreground/60 italic">+{scenes.length - 5} more scenes…</p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* RIGHT — PERSISTENT CHAT PANEL (desktop) / BOTTOM SHEET (mobile) */}
        <aside
          className={`
            border-l border-border/50 bg-gradient-to-b from-card/40 to-card/20 backdrop-blur flex flex-col
            md:w-[380px] md:shrink-0 md:static md:translate-y-0 md:flex
            fixed inset-x-0 bottom-0 z-40 max-h-[80vh] h-[70vh] rounded-t-2xl border-t md:border-t-0 md:rounded-none
            transition-transform duration-300 ease-out
            ${chatOpen ? "translate-y-0" : "translate-y-full md:translate-y-0"}
          `}
        >
          <div className="p-4 border-b border-border/40 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" /> Studio Chat
              </h3>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {chatEvents.length} msgs
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Direct your agents · edit any stage · regenerate
            </p>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-3">
            {chatEvents.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-8 space-y-2">
                <PiMagicWandDuotone className="w-6 h-6 text-primary/40 mx-auto" />
                <p>Try a directive:</p>
                <div className="space-y-1.5 pt-2">
                  {[
                    "Regenerate the story",
                    "Regenerate the characters",
                    "Regenerate the storyboard",
                    "Make Act 2 darker",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setChatInput(s)}
                      className="block w-full text-left text-xs px-3 py-1.5 rounded-md bg-card/40 hover:bg-primary/10 border border-border/40 hover:border-primary/30 transition-colors text-foreground/70"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatEvents.map((e) => <ChatBubble key={e.id} event={e} />)}
            {sendChat.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground italic px-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Routing to agents…
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-border/40 bg-background/50 shrink-0">
            <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-card/60 focus-within:border-primary/50 transition-colors p-2">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Message agents about ${activeStage.label}…`}
                rows={2}
                className="flex-1 bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground/50 max-h-32"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!chatInput.trim() || sendChat.isPending}
                className="h-8 w-8 shrink-0 rounded-lg"
              >
                {sendChat.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
              Targeting <span className="text-primary/80">{activeStage.label}</span> · ⏎ to send
            </p>
          </div>
        </aside>
      </div>

      {/* MOBILE — backdrop & floating chat toggle */}
      {chatOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setChatOpen(false)}
        />
      )}
      <button
        onClick={() => setChatOpen((v) => !v)}
        className="md:hidden fixed bottom-14 right-4 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center"
        aria-label="Toggle Studio Chat"
      >
        <MessageSquare className="w-5 h-5" />
        {chatEvents.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center px-1">
            {chatEvents.length > 99 ? "99+" : chatEvents.length}
          </span>
        )}
      </button>

      {/* BOTTOM RAIL */}
      <div className="h-9 shrink-0 border-t border-border/50 bg-card/40 backdrop-blur flex items-center px-4 gap-4 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          {Object.values(stageStates).filter((s) => s.status === "complete").length} complete
        </span>
        <span className="flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 text-primary" />
          {Object.values(stageStates).filter((s) => s.status === "active").length} active
        </span>
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-destructive/80" />
          {Object.values(stageStates).filter((s) => s.status === "error").length} errors
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          Engine <span className="text-foreground font-medium normal-case tracking-normal">Animax Ultra</span>
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                SUB-COMPONENTS                               */
/* -------------------------------------------------------------------------- */

function StageStatusBadge({ status }: { status: StageState["status"] }) {
  const map = {
    complete: { label: "Complete", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
    active: { label: "Active", className: "bg-primary/15 text-primary border-primary/30", Icon: Loader2 },
    idle: { label: "Idle", className: "bg-muted/20 text-muted-foreground border-border", Icon: Circle },
    error: { label: "Error", className: "bg-destructive/15 text-destructive border-destructive/30", Icon: AlertTriangle },
  } as const;
  const cfg = map[status];
  return (
    <div className={`shrink-0 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border ${cfg.className}`}>
      <cfg.Icon className={`w-3 h-3 ${status === "active" ? "animate-spin" : ""}`} />
      {cfg.label}
    </div>
  );
}

