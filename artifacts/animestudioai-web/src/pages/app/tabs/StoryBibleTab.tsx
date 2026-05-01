import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, BookOpen, Wand2, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import type { Project } from "@/types/api";

interface StoryBible {
  id?: string;
  status?: string;
  summary?: string;
  themes?: string;
  tone?: string;
  arcs_json?: string;
  parsed?: unknown;
}

interface ParsedThemes {
  themes?: string[];
}

function parseThemes(raw: string | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return [raw]; }
}

function parseArcs(bible: StoryBible): { title?: string; description?: string }[] {
  if (!bible.parsed) {
    if (!bible.arcs_json) return [];
    try { return JSON.parse(bible.arcs_json as string); } catch { return []; }
  }
  const p = bible.parsed as Record<string, unknown>;
  if (Array.isArray(p)) return p as { title?: string; description?: string }[];
  if (p.acts && Array.isArray(p.acts)) return p.acts as { title?: string; description?: string }[];
  return [];
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  generating: { label: "Generating…", color: "text-amber-400" },
  ready: { label: "Ready", color: "text-emerald-400" },
  approved: { label: "Approved", color: "text-primary" },
  draft: { label: "Draft", color: "text-muted-foreground" },
};

export default function StoryBibleTab({ project }: { project: Project }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const { data: bible, isLoading } = useQuery<StoryBible | null>({
    queryKey: ["projects", project.id, "story-bible"],
    queryFn: async () => {
      const res = await api(`/api/projects/${project.id}/story-bible`);
      return res.json() as Promise<StoryBible | null>;
    },
    refetchInterval: (query) => {
      const status = (query.state.data as StoryBible | null | undefined)?.status;
      return status === "generating" || !status ? 4000 : false;
    },
  });

  const generateBible = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/story-bible/generate`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", project.id, "story-bible"] }),
  });

  const generateChars = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/characters/generate`, { method: "POST" }),
  });

  const isGenerating = bible?.status === "generating" || generateBible.isPending;
  const isReady = bible?.status === "ready" || bible?.status === "approved";
  const themes = parseThemes(bible?.themes);
  const arcs = isReady ? parseArcs(bible!) : [];
  const statusInfo = STATUS_LABEL[bible?.status ?? "draft"] ?? STATUS_LABEL.draft;

  return (
    <div className="h-full overflow-auto scrollbar-none">
      <div className="max-w-4xl mx-auto p-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              Story Bible
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{project.title}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
                <Wand2 className="w-4 h-4 text-primary" />
                Generate Bible
              </Button>
            )}
            {isReady && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateChars.mutate()}
                disabled={generateChars.isPending}
                className="gap-2"
              >
                {generateChars.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
                Re-run Characters
              </Button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-3 p-8 rounded-xl border border-border/50 bg-card/30 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            Loading story bible…
          </div>
        )}

        {/* Generating state */}
        {!isLoading && isGenerating && (
          <div className="p-8 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <Wand2 className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              <div>
                <p className="font-semibold text-amber-300">AI Director is writing your Story Bible</p>
                <p className="text-sm text-muted-foreground">Generating characters, world rules, plot arcs — this takes ~60–90 seconds</p>
              </div>
            </div>
            <div className="space-y-2">
              {["Crafting world lore and rules…", "Building character roster…", "Structuring act arcs…", "Finalizing scenes and tone…"].map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 text-amber-400/60 shrink-0" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No bible yet */}
        {!isLoading && !isGenerating && !bible && (
          <div className="p-8 rounded-xl border border-border/50 bg-card/30 text-center space-y-4">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">Story bible not generated yet.</p>
            <Button onClick={() => generateBible.mutate()} disabled={generateBible.isPending} className="gap-2">
              <Wand2 className="w-4 h-4" /> Generate Bible
            </Button>
          </div>
        )}

        {/* Bible content */}
        {isReady && bible && (
          <div className="space-y-6">

            {/* Synopsis */}
            {bible.summary && (
              <div className="p-6 rounded-xl border border-border/50 bg-card/50 space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Synopsis</h3>
                <p className="text-muted-foreground leading-relaxed">{bible.summary}</p>
              </div>
            )}

            {/* Tone + Themes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bible.tone && (
                <div className="p-5 rounded-xl border border-border/50 bg-card/50 space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Tone & Voice</h3>
                  <p className="text-muted-foreground capitalize">{bible.tone.replace(/_/g, " ")}</p>
                  {project.genres && project.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {project.genres.map((g: string) => (
                        <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {themes.length > 0 && (
                <div className="p-5 rounded-xl border border-border/50 bg-card/50 space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Themes</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {themes.map((t: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs border-primary/30 text-primary/80">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Story Arc */}
            {arcs.length > 0 && (
              <div className="p-6 rounded-xl border border-border/50 bg-card/50 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Story Arcs</h3>
                <div className="space-y-4">
                  {arcs.map((arc, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div>
                        {arc.title && <p className="font-semibold">{arc.title}</p>}
                        {arc.description && <p className="text-sm text-muted-foreground leading-relaxed mt-1">{arc.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Story prompt reference */}
            {project.storyPrompt && (
              <div className="p-5 rounded-xl border border-border/30 bg-muted/20 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Original Prompt</h3>
                <p className="text-sm text-muted-foreground italic">"{project.storyPrompt}"</p>
              </div>
            )}

            {/* Next step hint */}
            <div className="flex items-center gap-2 text-sm text-emerald-400/80 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <RefreshCw className="w-4 h-4 shrink-0" />
              Characters are being generated automatically — check the Characters tab for progress.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
