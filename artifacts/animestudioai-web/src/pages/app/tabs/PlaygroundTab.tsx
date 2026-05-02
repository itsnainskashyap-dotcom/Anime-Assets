import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, BookOpen, Users, Mountain, LayoutTemplate, Layers, Film, Music,
  Download, Send, Loader2, ShieldCheck, Lock, CheckCircle2, Circle,
  Sparkles, RadioTower, BrainCircuit, Wand2, AlertTriangle, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgentLog, PlaygroundEvent, Project } from "@/types/api";

/* -------------------------------------------------------------------------- */
/*                              STAGE DEFINITIONS                              */
/* -------------------------------------------------------------------------- */

interface Stage {
  id: string;
  label: string;
  icon: typeof BookOpen;
  agent: string;
  description: string;
  matchEvent: (e: PlaygroundEvent) => boolean;
}

const STAGES: Stage[] = [
  { id: "intake", label: "Story Intake", icon: BookOpen, agent: "Story Director",
    description: "Capturing your premise, tone and runtime target.",
    matchEvent: (e) => /intake|story_prompt|project_created/i.test(e.event_type) },
  { id: "story", label: "Story Director", icon: Wand2, agent: "Story Director",
    description: "Drafting the full story with acts, twists and climax.",
    matchEvent: (e) => /story_bible_(generate|generating|ready)|story_director/i.test(e.event_type) },
  { id: "finalize", label: "Story Finalization", icon: ShieldCheck, agent: "You + Story Director",
    description: "Review and lock the story before character build.",
    matchEvent: (e) => /story_finalized|story_unfinalized/i.test(e.event_type) },
  { id: "bible", label: "Story Bible", icon: BookOpen, agent: "Story Bible Agent",
    description: "World rules, lore, motifs and continuity constraints.",
    matchEvent: (e) => /story_bible_approved|story_bible_ready/i.test(e.event_type) },
  { id: "characters", label: "Character Studio", icon: Users, agent: "Character Director",
    description: "Hero/antagonist designs from story or uploaded refs.",
    matchEvent: (e) => /character_(generate|generated|locked)/i.test(e.event_type) },
  { id: "turnaround", label: "Turnaround Sheets", icon: Layers, agent: "Character Director",
    description: "Multi-angle reference sheet per locked character.",
    matchEvent: (e) => /turnaround|angle_sheet/i.test(e.event_type) },
  { id: "environments", label: "Environment Studio", icon: Mountain, agent: "Environment Director",
    description: "Locations, time-of-day, weather, mood boards.",
    matchEvent: (e) => /environment_(generate|generated|locked)/i.test(e.event_type) },
  { id: "frames", label: "Start / End Frames", icon: Layers, agent: "Visualization Director",
    description: "Per-chunk start frame, end frame, anchor stills.",
    matchEvent: (e) => /(start|end)_frame|visualization_(generate|generated)/i.test(e.event_type) },
  { id: "storyboard", label: "Storyboard Composer", icon: LayoutTemplate, agent: "Storyboard Composer",
    description: "Composite 8-panel sheet aligned with the chunk video prompt.",
    matchEvent: (e) => /storyboard_(generate|generated|ready)/i.test(e.event_type) },
  { id: "viz", label: "Visualization Pack", icon: Layers, agent: "Visualization Director",
    description: "Frames + storyboard + refs bundled per chunk.",
    matchEvent: (e) => /viz_pack|visualization_pack/i.test(e.event_type) },
  { id: "compile", label: "Prompt Compiler", icon: BrainCircuit, agent: "Prompt Compiler",
    description: "Builds the precise Animax Ultra payload per chunk.",
    matchEvent: (e) => /prompt_compiled|payload_built/i.test(e.event_type) },
  { id: "video", label: "Animax Ultra · Video", icon: Film, agent: "Video Orchestrator",
    description: "Renders chunk videos with continuity from chunk N−1.",
    matchEvent: (e) => /chunk_(queued|started|completed|video)/i.test(e.event_type) },
  { id: "qc", label: "Quality Validator", icon: ShieldCheck, agent: "Quality Validator",
    description: "Vision QA on every output; gates continuity for next chunk.",
    matchEvent: (e) => /validation|quality_check/i.test(e.event_type) },
  { id: "song", label: "Song & Lipsync", icon: Music, agent: "Audio Director",
    description: "Lyrics, song render and lip-sync flow when enabled.",
    matchEvent: (e) => /song|lipsync|audio_chunk/i.test(e.event_type) },
  { id: "export", label: "Final Assembly", icon: Download, agent: "Export Agent",
    description: "Stitched master, subtitles, downloadable assets.",
    matchEvent: (e) => /export|assembly|master_render/i.test(e.event_type) },
];

interface StageState {
  status: "idle" | "active" | "complete" | "error";
  lastMessage?: string;
  lastAt?: string;
  count: number;
}

function deriveStageStates(
  events: PlaygroundEvent[],
  isFinalized: boolean,
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
      else if (/(completed|approved|ready|finalized|locked|generated)/i.test(e.event_type)) cur.status = "complete";
      else cur.status = "active";
    }
  }
  // Story-finalize is a hard signal even if no event got recorded yet.
  if (isFinalized) {
    out.finalize.status = "complete";
    out.finalize.lastMessage = out.finalize.lastMessage || "You finalized the story.";
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
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<PlaygroundEvent[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "reconnecting" | "error">("connecting");
  const [selectedStage, setSelectedStage] = useState<string>("story");
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false); // mobile bottom-sheet toggle
  const chatEndRef = useRef<HTMLDivElement>(null);

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
  const isFinalized = !!project.story_finalized_at;
  const stageStates = useMemo(() => deriveStageStates(events, isFinalized), [events, isFinalized]);
  const chatEvents = useMemo(
    () => events.filter((e) => isAgentMessage(e) && (e.message ?? "").length > 0),
    [events],
  );
  const activeStage = STAGES.find((s) => s.id === selectedStage) ?? STAGES[0];
  const activeStageState = stageStates[activeStage.id];

  /* ------------------------------ Mutations -------------------------------- */
  const sendChat = useMutation({
    mutationFn: (message: string) =>
      api(`/api/projects/${project.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message, stage: selectedStage }),
      }),
  });

  const finalizeStory = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/story/finalize`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", project.id] }),
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
      <div className="h-12 shrink-0 border-b border-border/50 bg-card/30 backdrop-blur flex items-center px-4 gap-3">
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
          {!isFinalized && stageStates.bible.status === "complete" && (
            <Button
              size="sm"
              onClick={() => finalizeStory.mutate()}
              disabled={finalizeStory.isPending}
              className="h-7 gap-1.5 text-xs bg-primary hover:bg-primary/90"
            >
              {finalizeStory.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
              Finalize Story
            </Button>
          )}
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {events.length} events · {logs.length} logs
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
              onClick={() => setSelectedStage(s.id)}
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
                  onClick={() => setSelectedStage(s.id)}
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

              {/* Story-finalize spotlight when on finalize stage */}
              {activeStage.id === "finalize" && (
                <FinalizeCard
                  isFinalized={isFinalized}
                  bibleReady={stageStates.bible.status === "complete"}
                  onFinalize={() => finalizeStory.mutate()}
                  pending={finalizeStory.isPending}
                />
              )}

              {/* Latest message card */}
              <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur p-5 space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  <Sparkles className="w-3 h-3 text-primary" /> Latest from {activeStage.agent}
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

              {/* Recent events for this stage */}
              <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur p-5">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4">
                  <Activity className="w-3 h-3" /> Stage Activity
                </div>
                <div className="space-y-2">
                  {events.filter((e) => activeStage.matchEvent(e)).slice(-8).reverse().map((e) => (
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
                  {events.filter((e) => activeStage.matchEvent(e)).length === 0 && (
                    <div className="text-xs text-muted-foreground italic py-4 text-center">
                      No events recorded for this stage yet.
                    </div>
                  )}
                </div>
              </div>
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
                <Sparkles className="w-6 h-6 text-primary/40 mx-auto" />
                <p>Try a directive:</p>
                <div className="space-y-1.5 pt-2">
                  {[
                    "Rewrite the story",
                    "Make Act 2 darker",
                    "Regenerate hero character",
                    "Change environment to rainy Tokyo",
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

function FinalizeCard({
  isFinalized, bibleReady, onFinalize, pending,
}: { isFinalized: boolean; bibleReady: boolean; onFinalize: () => void; pending: boolean }) {
  if (isFinalized) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex items-start gap-4">
        <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-emerald-200">Story Finalized</p>
          <p className="text-sm text-emerald-200/70 mt-1">
            Character Studio is unlocked. The Continuity Brain has snapshotted the canonical story
            for the rest of the pipeline.
          </p>
        </div>
      </div>
    );
  }
  if (!bibleReady) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/30 p-5 flex items-start gap-4">
        <Lock className="w-6 h-6 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Waiting for Story Director</p>
          <p className="text-sm text-muted-foreground mt-1">
            The full story must be generated first. Open the Story Bible tab and click
            <span className="text-foreground font-medium"> Generate Bible</span>.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5 p-5 flex items-start gap-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.15),transparent_60%)] pointer-events-none" />
      <Wand2 className="w-6 h-6 text-primary shrink-0 mt-0.5 relative" />
      <div className="relative flex-1">
        <p className="font-semibold">Ready for Finalization</p>
        <p className="text-sm text-muted-foreground mt-1">
          Review the story end-to-end. Use the chat to tighten any act, then lock it in.
          Characters won't generate until you click below.
        </p>
        <Button onClick={onFinalize} disabled={pending} className="mt-4 gap-2">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Finalize Story & Unlock Characters
        </Button>
      </div>
    </div>
  );
}
