import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, BookOpen, CheckCircle2, Lock, Unlock, ShieldCheck } from "lucide-react";
import {
  PiMagicWandDuotone,
  PiPencilLineDuotone,
  PiUsersDuotone,
  PiFilmScriptDuotone,
  PiListBulletsDuotone,
} from "react-icons/pi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import type { Project } from "@/types/api";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                     */
/* -------------------------------------------------------------------------- */

interface StoryBible {
  id?: string;
  status?: string;
  summary?: string;
  themes?: string;
  tone?: string;
  arcs_json?: string;
  partial_output?: string | null;
  parsed?: unknown;
}

function parseThemes(raw: string | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return [raw]; }
}

function parseArcs(bible: StoryBible): { title?: string; description?: string; summary?: string; emotionalArc?: string; keyEvents?: string[] }[] {
  if (!bible.parsed) {
    if (!bible.arcs_json) return [];
    try { return JSON.parse(bible.arcs_json as string); } catch { return []; }
  }
  const p = bible.parsed as Record<string, unknown>;
  if (Array.isArray(p)) return p as { title?: string }[];
  if (p.acts && Array.isArray(p.acts)) return p.acts as { title?: string }[];
  return [];
}

function parseCharacters(bible: StoryBible): { name?: string; role?: string; backstory?: string; voiceDescription?: string; sampleDialogue?: string[] }[] {
  if (!bible.parsed) return [];
  const p = bible.parsed as Record<string, unknown>;
  if (Array.isArray(p.characters)) return p.characters as { name?: string }[];
  return [];
}

function parseScenes(bible: StoryBible): { sceneNumber?: number; title?: string; summary?: string; emotion?: string; keyDialogue?: string[]; atmosphere?: string }[] {
  if (!bible.parsed) return [];
  const p = bible.parsed as Record<string, unknown>;
  if (Array.isArray(p.scenes)) return p.scenes as { sceneNumber?: number; title?: string }[];
  return [];
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  generating: { label: "Generating…", color: "text-amber-400" },
  ready:      { label: "Ready",        color: "text-emerald-400" },
  approved:   { label: "Approved",     color: "text-primary" },
  draft:      { label: "Draft",        color: "text-muted-foreground" },
};

const LANG_FLAG: Record<string, string> = {
  en: "🇬🇧", hi: "🇮🇳", "hi-en": "🇮🇳", es: "🇪🇸", ja: "🇯🇵",
  ko: "🇰🇷", fr: "🇫🇷", pt: "🇧🇷", zh: "🇨🇳", ar: "🇸🇦",
};

const LANG_NAME: Record<string, string> = {
  en: "English", hi: "हिंदी", "hi-en": "Hinglish", es: "Español", ja: "日本語",
  ko: "한국어", fr: "Français", pt: "Português", zh: "中文", ar: "العربية",
};

/* -------------------------------------------------------------------------- */
/*                        GENERATING PHASE ANIMATION                           */
/* -------------------------------------------------------------------------- */

const PHASES = [
  { icon: PiPencilLineDuotone,   label: "Crafting world lore and universe rules" },
  { icon: PiUsersDuotone,        label: "Building character roster with backstories" },
  { icon: PiFilmScriptDuotone,   label: "Structuring act arcs and scene flow" },
  { icon: PiListBulletsDuotone,  label: "Composing scene-by-scene screenplay" },
  { icon: PiMagicWandDuotone,    label: "Finalising tone, themes, and dialogue" },
];

function GeneratingView({ partial }: { partial?: string | null }) {
  const [phase, setPhase] = useState(0);
  const [displayedChars, setDisplayedChars] = useState(0);
  const prevPartialRef = useRef<string>("");
  const scrollRef = useRef<HTMLPreElement>(null);

  // Cycle through phases every ~8 s
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 8000);
    return () => clearInterval(t);
  }, []);

  // Animate newly arriving characters
  useEffect(() => {
    if (!partial) return;
    if (partial.length <= prevPartialRef.current.length) {
      prevPartialRef.current = partial;
      setDisplayedChars(partial.length);
      return;
    }
    prevPartialRef.current = partial;
    const target = partial.length;
    const start = displayedChars;
    const diff = target - start;
    if (diff <= 0) return;
    // Spread new chars over ~700 ms to create typewriter effect
    const step = Math.max(1, Math.ceil(diff / 60));
    let cur = start;
    const iv = setInterval(() => {
      cur = Math.min(target, cur + step);
      setDisplayedChars(cur);
      if (cur >= target) clearInterval(iv);
    }, 12);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partial]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedChars]);

  const visibleText = partial ? partial.slice(0, displayedChars) : "";
  const CurrentPhaseIcon = PHASES[phase].icon;

  return (
    <div className="space-y-6">
      {/* Phase header */}
      <motion.div
        className="p-6 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 to-amber-500/3 relative overflow-hidden"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(38_92%_50%/0.12),transparent_60%)] pointer-events-none" />

        <div className="flex items-center gap-4 relative">
          <motion.div
            className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <CurrentPhaseIcon className="w-6 h-6 text-amber-400" />
          </motion.div>
          <div>
            <p className="font-bold text-amber-200 text-base">AI Director is writing your Story Bible</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={phase}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="text-sm text-amber-300/70 mt-0.5"
              >
                {PHASES[phase].label}…
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-xs text-amber-400/80 uppercase tracking-wider font-medium">Live</span>
          </div>
        </div>

        {/* Phase dots */}
        <div className="flex items-center gap-2 mt-5">
          {PHASES.map((p, i) => (
            <motion.div
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${i === phase ? "bg-amber-400 w-6" : i < phase ? "bg-amber-500/60 w-3" : "bg-amber-500/20 w-3"}`}
            />
          ))}
        </div>
      </motion.div>

      {/* Live writing terminal */}
      <motion.div
        className="rounded-2xl border border-border/50 bg-[#0d0d0d] overflow-hidden"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Terminal header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-card/20">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-[10px] text-muted-foreground/60 ml-2 font-mono uppercase tracking-widest">story_bible.json — generating</span>
          <div className="ml-auto">
            <motion.span
              className="text-[10px] text-emerald-400/70 font-mono"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              ● REC
            </motion.span>
          </div>
        </div>

        {/* Terminal content */}
        <pre
          ref={scrollRef}
          className="p-4 text-[11px] leading-relaxed font-mono text-emerald-300/80 overflow-y-auto max-h-72 scrollbar-none whitespace-pre-wrap break-all"
        >
          {visibleText || (
            <span className="text-muted-foreground/40 italic">Waiting for Story Director to begin writing…</span>
          )}
          <motion.span
            className="inline-block w-[2px] h-[13px] bg-emerald-400 ml-0.5 align-middle"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
          />
        </pre>
      </motion.div>

      {/* Discovered content callouts — parse out readable bits when available */}
      {visibleText.includes('"title"') && (
        <DiscoveredCallouts text={visibleText} />
      )}
    </div>
  );
}

/* Extract readable snippets from partial JSON for "discovered" callout cards */
function DiscoveredCallouts({ text }: { text: string }) {
  const extract = (key: string): string | null => {
    const m = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"]{4,200})"`));
    return m ? m[1] : null;
  };
  const title    = extract("title");
  const synopsis = extract("synopsis");
  const tone     = extract("tone");

  const items = [
    title    && { label: "Title",    value: title,    color: "text-primary",     border: "border-primary/30",    bg: "bg-primary/5" },
    tone     && { label: "Tone",     value: tone,     color: "text-purple-300",  border: "border-purple-500/30", bg: "bg-purple-500/5" },
    synopsis && { label: "Synopsis", value: synopsis, color: "text-amber-200",   border: "border-amber-500/30",  bg: "bg-amber-500/5" },
  ].filter(Boolean) as { label: string; value: string; color: string; border: string; bg: string }[];

  if (items.length === 0) return null;

  return (
    <motion.div
      className="space-y-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">Discovered so far</p>
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className={`px-4 py-3 rounded-xl border ${item.border} ${item.bg}`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">{item.label}</div>
          <div className={`text-sm font-medium leading-snug ${item.color}`}>{item.value}</div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                  */
/* -------------------------------------------------------------------------- */

export default function StoryBibleTab({ project }: { project: Project }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const lang = project.language || "en";
  const langFlag = LANG_FLAG[lang] || "🌐";
  const langName = LANG_NAME[lang] || lang.toUpperCase();

  const { data: bible, isLoading } = useQuery<StoryBible | null>({
    queryKey: ["projects", project.id, "story-bible"],
    queryFn: async () => {
      const res = await api(`/api/projects/${project.id}/story-bible`);
      return res.json() as Promise<StoryBible | null>;
    },
    refetchInterval: (query) => {
      const status = (query.state.data as StoryBible | null | undefined)?.status;
      // Poll faster during generation for smooth typewriter updates.
      return status === "generating" || !status ? 2000 : false;
    },
  });

  const generateBible = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/story-bible/generate`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", project.id, "story-bible"] }),
  });

  const generateChars = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/characters/generate`, { method: "POST" }),
  });

  const finalizeStory = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/story/finalize`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", project.id] }),
  });
  const unfinalizeStory = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/story/unfinalize`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", project.id] }),
  });

  const isFinalized  = !!project.story_finalized_at;
  const isGenerating = bible?.status === "generating" || generateBible.isPending;
  const isReady      = bible?.status === "ready" || bible?.status === "approved";
  const themes       = parseThemes(bible?.themes);
  const arcs         = isReady ? parseArcs(bible!) : [];
  const characters   = isReady ? parseCharacters(bible!) : [];
  const scenes       = isReady ? parseScenes(bible!) : [];
  const statusInfo   = STATUS_LABEL[bible?.status ?? "draft"] ?? STATUS_LABEL.draft;

  return (
    <div className="h-full overflow-auto scrollbar-none">
      <div className="max-w-4xl mx-auto p-8 space-y-8">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              Story Bible
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">{project.title}</p>
              <span className="text-muted-foreground/40">·</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 border border-primary/20 text-primary rounded-full px-2 py-0.5">
                {langFlag} {langName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {bible?.status && (
              <span className={`text-sm font-medium flex items-center gap-1.5 ${statusInfo.color}`}>
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {statusInfo.label}
              </span>
            )}
            {!isReady && !isGenerating && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateBible.mutate()}
                disabled={generateBible.isPending}
                className="gap-2 border-primary/30 hover:border-primary"
              >
                <PiMagicWandDuotone className="w-4 h-4 text-primary" />
                Generate Bible
              </Button>
            )}
            {isReady && !isFinalized && (
              <Button
                size="sm"
                onClick={() => finalizeStory.mutate()}
                disabled={finalizeStory.isPending}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                {finalizeStory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Finalize Story
              </Button>
            )}
            {isReady && isFinalized && (
              <>
                <Button size="sm" variant="outline" onClick={() => unfinalizeStory.mutate()} disabled={unfinalizeStory.isPending} className="gap-2">
                  {unfinalizeStory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                  Unlock Story
                </Button>
                <Button size="sm" variant="outline" onClick={() => generateChars.mutate()} disabled={generateChars.isPending} className="gap-2">
                  {generateChars.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PiMagicWandDuotone className="w-4 h-4 text-primary" />}
                  Generate Characters
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Loading ─────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center gap-3 p-8 rounded-xl border border-border/50 bg-card/30 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            Loading story bible…
          </div>
        )}

        {/* ── Live generation animation ────────────────────────────── */}
        <AnimatePresence>
          {!isLoading && isGenerating && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GeneratingView partial={bible?.partial_output} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── No bible yet ─────────────────────────────────────────── */}
        {!isLoading && !isGenerating && !bible && (
          <div className="p-8 rounded-xl border border-border/50 bg-card/30 text-center space-y-4">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">Story bible not generated yet.</p>
            <Button onClick={() => generateBible.mutate()} disabled={generateBible.isPending} className="gap-2">
              <PiMagicWandDuotone className="w-4 h-4" /> Generate Bible
            </Button>
          </div>
        )}

        {/* ── Ready state: full story data ────────────────────────── */}
        {isReady && bible && (
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >

            {/* Synopsis */}
            {bible.summary && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-xl border border-border/50 bg-card/50 space-y-3"
              >
                <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Synopsis</h3>
                <p className="text-muted-foreground leading-relaxed">{bible.summary}</p>
              </motion.div>
            )}

            {/* Tone + Themes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bible.tone && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="p-5 rounded-xl border border-border/50 bg-card/50 space-y-2"
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Tone & Voice</h3>
                  <p className="text-muted-foreground capitalize">{bible.tone.replace(/_/g, " ")}</p>
                  {project.genres && project.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {project.genres.map((g: string) => (
                        <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
              {themes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 }}
                  className="p-5 rounded-xl border border-border/50 bg-card/50 space-y-2"
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Themes</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {themes.map((t: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs border-primary/30 text-primary/80">{t}</Badge>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Act Arcs */}
            {arcs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-6 rounded-xl border border-border/50 bg-card/50 space-y-4"
              >
                <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Story Arcs</h3>
                <div className="space-y-5">
                  {arcs.map((arc, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * i }}
                      className="flex gap-4"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        {arc.title && <p className="font-semibold">{arc.title}</p>}
                        {(arc.description || arc.summary) && (
                          <p className="text-sm text-muted-foreground leading-relaxed mt-1">{arc.description ?? arc.summary}</p>
                        )}
                        {arc.emotionalArc && (
                          <p className="text-xs text-purple-300/70 mt-1.5 italic">Emotional arc: {arc.emotionalArc}</p>
                        )}
                        {arc.keyEvents && arc.keyEvents.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {arc.keyEvents.map((ev, j) => (
                              <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="text-primary/60 mt-0.5">›</span> {ev}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Characters */}
            {characters.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="p-6 rounded-xl border border-border/50 bg-card/50 space-y-4"
              >
                <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Characters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {characters.map((c, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.06 * i }}
                      className="p-4 rounded-lg border border-border/40 bg-background/40 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs">{c.name?.charAt(0) || "?"}</div>
                        <div>
                          <p className="font-semibold text-sm">{c.name}</p>
                          {c.role && <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.role}</p>}
                        </div>
                      </div>
                      {c.backstory && <p className="text-xs text-muted-foreground leading-relaxed">{c.backstory}</p>}
                      {c.voiceDescription && (
                        <p className="text-[10px] text-primary/70 italic">Voice: {c.voiceDescription}</p>
                      )}
                      {c.sampleDialogue && c.sampleDialogue.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-border/30">
                          {c.sampleDialogue.map((line, j) => (
                            <p key={j} className="text-xs text-muted-foreground/80 italic">&#34;{line}&#34;</p>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Scenes */}
            {scenes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-6 rounded-xl border border-border/50 bg-card/50 space-y-4"
              >
                <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
                  Scenes <span className="text-muted-foreground font-normal normal-case text-xs ml-1">({scenes.length} total)</span>
                </h3>
                <div className="space-y-3">
                  {scenes.slice(0, 8).map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 * i }}
                      className="flex gap-3 p-3 rounded-lg border border-border/30 bg-background/30"
                    >
                      <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">{s.sceneNumber ?? i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{s.title}</p>
                        {s.summary && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.summary}</p>}
                        {s.atmosphere && <p className="text-[10px] text-purple-300/60 mt-1 italic">{s.atmosphere}</p>}
                        {s.keyDialogue && s.keyDialogue.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {s.keyDialogue.map((d, j) => (
                              <p key={j} className="text-[10px] text-amber-300/70 italic">{d}</p>
                            ))}
                          </div>
                        )}
                        {s.emotion && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400/80 mt-1.5">{s.emotion}</Badge>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {scenes.length > 8 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      +{scenes.length - 8} more scenes in the full production plan
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Original prompt */}
            {project.storyPrompt && (
              <div className="p-5 rounded-xl border border-border/30 bg-muted/20 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Original Prompt</h3>
                <p className="text-sm text-muted-foreground italic">"{project.storyPrompt}"</p>
              </div>
            )}

            {/* Finalization gate */}
            {!isFinalized ? (
              <div className="flex items-start gap-3 text-sm p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-amber-200/90">
                  <p className="font-semibold">Character Studio is locked.</p>
                  <p className="text-amber-200/70 mt-0.5">Review every act above, edit through the Playground chat if needed, then click <span className="font-semibold">Finalize Story</span> to unlock character generation.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 text-sm p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-emerald-200/90">
                  <p className="font-semibold">Story finalized — Character Studio unlocked.</p>
                  <p className="text-emerald-200/70 mt-0.5">You can now generate characters from the story or upload reference portraits in the Characters tab.</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
