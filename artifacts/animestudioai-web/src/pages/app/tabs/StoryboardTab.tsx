import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, LayoutTemplate, Film, RefreshCw, Download, ShieldCheck,
  AlertTriangle, ImageIcon, ListOrdered, FileText, Layers, History, Maximize2,
} from "lucide-react";
import { PiMagicWandDuotone } from "react-icons/pi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import type { Project } from "@/types/api";

interface Scene {
  id: string;
  scene_number: number;
  act_number?: number;
  title?: string;
  description?: string;
  shot_type?: string;
  duration_seconds?: number;
  emotion?: string;
}

interface Chunk {
  id: string;
  project_id: string;
  scene_id: string | null;
  chunk_number: number;
  duration_seconds: number | null;
  prompt_text: string | null;
  status: string;
  storyboard_image_url: string | null;
  storyboard_status: string | null;
  storyboard_shot_count: number | null;
  storyboard_prompt: string | null;
  storyboard_error_message: string | null;
  storyboard_generation_model: string | null;
  start_frame_image_url: string | null;
  end_frame_image_url: string | null;
}

type InspectorTab = "shots" | "prompt" | "refs" | "history";

function statusColor(s: string | null): string {
  switch (s) {
    case "ready": return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "queued":
    case "generating": return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "failed": return "bg-destructive/15 text-destructive border-destructive/30";
    default: return "bg-muted/20 text-muted-foreground border-border/40";
  }
}

export default function StoryboardTab({ project }: { project: Project }) {
  const { api } = useAuth();
  const qc = useQueryClient();
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("shots");
  const [zoomed, setZoomed] = useState(false);

  const { data: chunks = [], isLoading: loadingChunks } = useQuery<Chunk[]>({
    queryKey: ["projects", project.id, "chunks"],
    queryFn: async () => {
      const res = await api(`/api/projects/${project.id}/chunks`);
      return res.json() as Promise<Chunk[]>;
    },
    refetchInterval: (q) => {
      const cs = q.state.data as Chunk[] | undefined;
      if (!cs || cs.length === 0) return 6000;
      return cs.some((c) => c.storyboard_status === "queued" || c.storyboard_status === "generating") ? 5000 : false;
    },
  });

  const { data: scenes = [] } = useQuery<Scene[]>({
    queryKey: ["projects", project.id, "scenes"],
    queryFn: async () => {
      const res = await api(`/api/projects/${project.id}/scenes`);
      return res.json() as Promise<Scene[]>;
    },
  });

  const sceneById = useMemo(() => new Map(scenes.map((s) => [s.id, s])), [scenes]);

  const generateAll = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/storyboard/generate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects", project.id, "chunks"] }),
  });

  const regenerateOne = useMutation({
    mutationFn: (chunkId: string) =>
      api(`/api/chunks/${chunkId}/storyboard/regenerate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects", project.id, "chunks"] }),
  });

  const selected = chunks.find((c) => c.id === selectedChunkId) ?? chunks[0] ?? null;
  const selectedScene = selected?.scene_id ? sceneById.get(selected.scene_id) : null;
  const ready = chunks.filter((c) => c.storyboard_status === "ready").length;

  /* ---------------------------- LOADING / EMPTY ---------------------------- */

  if (loadingChunks) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading chunks…
      </div>
    );
  }

  if (chunks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-full bg-card border border-border/50 flex items-center justify-center">
          <LayoutTemplate className="w-8 h-8 text-muted-foreground/30" />
        </div>
        <div>
          <p className="font-semibold mb-1">No video chunks yet</p>
          <p className="text-sm text-muted-foreground">
            Storyboard sheets are built per chunk after the Story Bible<br />
            and characters are ready. Trigger storyboard planning to begin.
          </p>
        </div>
        <Button className="gap-2" onClick={() => generateAll.mutate()} disabled={generateAll.isPending}>
          {generateAll.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PiMagicWandDuotone className="w-4 h-4" />}
          Plan Storyboard
        </Button>
      </div>
    );
  }

  /* --------------------------------- LAYOUT -------------------------------- */

  return (
    <div className="h-full flex flex-col md:flex-row min-h-0">
      {/* LEFT RAIL — chunk list grouped by scene */}
      <aside className="md:w-[280px] shrink-0 border-r border-border/50 bg-card/30 flex flex-col max-h-[40%] md:max-h-none">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Chunks</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{ready}/{chunks.length} sheets ready</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => generateAll.mutate()}
            disabled={generateAll.isPending}
            title="Plan storyboard for all chunks"
          >
            {generateAll.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PiMagicWandDuotone className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <div className="flex-1 overflow-auto scrollbar-none p-2 space-y-1">
          {chunks.map((c) => {
            const s = c.scene_id ? sceneById.get(c.scene_id) : null;
            const isActive = selected?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedChunkId(c.id)}
                className={`w-full text-left rounded-lg p-2.5 transition-all border flex gap-3 items-center ${
                  isActive ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-card/60"
                }`}
              >
                <div className="w-12 h-12 rounded-md border border-border/50 bg-background overflow-hidden shrink-0 flex items-center justify-center">
                  {c.storyboard_image_url ? (
                    <img src={c.storyboard_image_url} alt={`Chunk ${c.chunk_number}`} className="w-full h-full object-cover" />
                  ) : c.storyboard_status === "queued" || c.storyboard_status === "generating" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/50" />
                  ) : c.storyboard_status === "failed" ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive/70" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-muted-foreground/30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    Chunk {c.chunk_number}
                    {s && <span className="text-muted-foreground"> · S{s.scene_number}</span>}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                    {c.storyboard_status ?? "pending"}
                    {c.duration_seconds ? ` · ${c.duration_seconds}s` : ""}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* CENTER — board canvas */}
      <main className="flex-1 min-w-0 bg-background/30 flex flex-col">
        {selected ? (
          <>
            <div className="px-6 py-3 border-b border-border/40 flex items-center gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-tight truncate">
                  Chunk {selected.chunk_number}
                  {selectedScene?.title ? <span className="text-muted-foreground font-normal"> · {selectedScene.title}</span> : null}
                </h2>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span className={`px-2 py-0.5 rounded-full border ${statusColor(selected.storyboard_status)}`}>
                    {selected.storyboard_status ?? "pending"}
                  </span>
                  {selected.storyboard_shot_count != null && (
                    <span>{selected.storyboard_shot_count} panels</span>
                  )}
                  {selected.storyboard_generation_model && (
                    <span className="hidden sm:inline">via {selected.storyboard_generation_model}</span>
                  )}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {selected.storyboard_image_url && (
                  <>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setZoomed(true)}>
                      <Maximize2 className="w-3.5 h-3.5" /> Fullscreen
                    </Button>
                    <a href={selected.storyboard_image_url} download target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-8 gap-1.5">
                        <Download className="w-3.5 h-3.5" /> Download
                      </Button>
                    </a>
                  </>
                )}
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => regenerateOne.mutate(selected.id)}
                  disabled={regenerateOne.isPending}
                >
                  {regenerateOne.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Regenerate
                </Button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-auto scrollbar-none flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selected.id + (selected.storyboard_image_url ?? "")}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.22 }}
                  className="w-full max-w-4xl aspect-video rounded-2xl border border-border/60 bg-card/40 overflow-hidden shadow-2xl shadow-primary/5 relative flex items-center justify-center"
                >
                  {selected.storyboard_image_url ? (
                    <img src={selected.storyboard_image_url} alt="Storyboard sheet" className="w-full h-full object-contain bg-black/40" />
                  ) : selected.storyboard_status === "failed" ? (
                    <div className="text-center p-8">
                      <AlertTriangle className="w-10 h-10 text-destructive/70 mx-auto mb-3" />
                      <p className="font-semibold">Storyboard generation failed</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        {selected.storyboard_error_message ?? "Try regenerating, or open the chunk inspector for the full payload."}
                      </p>
                    </div>
                  ) : selected.storyboard_status === "queued" || selected.storyboard_status === "generating" ? (
                    <div className="text-center p-8 text-muted-foreground">
                      <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
                      <p>Composing 8-panel sheet aligned with chunk video prompt…</p>
                    </div>
                  ) : (
                    <div className="text-center p-8 text-muted-foreground/60">
                      <LayoutTemplate className="w-12 h-12 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">No sheet generated yet</p>
                      <p className="text-xs mt-1">Click Regenerate to compose this chunk's storyboard.</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* BOTTOM ACTION BAR */}
            <div className="border-t border-border/50 bg-card/40 px-6 py-2.5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Reference Set: {[selected.start_frame_image_url, selected.end_frame_image_url, selected.storyboard_image_url].filter(Boolean).length}/3
              </span>
              <span className="ml-auto">Aligned with chunk video prompt · §9.4</span>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Film className="w-12 h-12 mb-3 opacity-20" />
            <p>Select a chunk</p>
          </div>
        )}
      </main>

      {/* RIGHT INSPECTOR */}
      {selected && (
        <aside className="md:w-[320px] shrink-0 border-l border-border/50 bg-card/20 flex flex-col max-h-[35%] md:max-h-none">
          <div className="border-b border-border/40 flex">
            {([
              { id: "shots", label: "Shots", icon: ListOrdered },
              { id: "prompt", label: "Prompt", icon: FileText },
              { id: "refs", label: "Refs", icon: Layers },
              { id: "history", label: "History", icon: History },
            ] as const).map((t) => {
              const active = inspectorTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setInspectorTab(t.id)}
                  className={`flex-1 px-2 py-2.5 text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 border-b-2 transition-colors ${
                    active
                      ? "border-primary text-foreground bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon className="w-3 h-3" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-auto scrollbar-none p-4 text-sm space-y-3">
            {inspectorTab === "shots" && (
              <ShotList chunk={selected} scene={selectedScene ?? null} />
            )}
            {inspectorTab === "prompt" && (
              <pre className="text-xs whitespace-pre-wrap leading-relaxed text-muted-foreground bg-background/40 rounded-lg p-3 border border-border/40 max-h-full overflow-auto">
                {selected.storyboard_prompt || selected.prompt_text || "No prompt yet."}
              </pre>
            )}
            {inspectorTab === "refs" && (
              <RefList chunk={selected} />
            )}
            {inspectorTab === "history" && (
              <p className="text-xs text-muted-foreground italic">
                Prior renders for this chunk will appear here once a regeneration completes.
              </p>
            )}
          </div>
        </aside>
      )}

      {/* FULLSCREEN VIEWER */}
      {zoomed && selected?.storyboard_image_url && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <img src={selected.storyboard_image_url} alt="Storyboard fullscreen" className="max-w-full max-h-full object-contain" />
          <Badge className="absolute top-4 right-4 bg-background/80 text-foreground">Esc / click to close</Badge>
        </div>
      )}
    </div>
  );
}

function ShotList({ chunk, scene }: { chunk: Chunk; scene: Scene | null }) {
  const count = chunk.storyboard_shot_count ?? 0;
  return (
    <div className="space-y-3">
      {scene && (
        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Scene {scene.scene_number}</div>
          <div className="font-semibold text-sm">{scene.title}</div>
          {scene.description && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-4">{scene.description}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {scene.shot_type && <Badge variant="outline" className="text-[10px] capitalize">{scene.shot_type}</Badge>}
            {scene.emotion && <Badge variant="outline" className="text-[10px] capitalize">{scene.emotion}</Badge>}
            {chunk.duration_seconds && <Badge variant="outline" className="text-[10px]">{chunk.duration_seconds}s</Badge>}
          </div>
        </div>
      )}
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Panels</div>
      {count > 0 ? (
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-md border border-border/40 bg-background/40 flex items-center justify-center text-xs font-bold text-muted-foreground"
            >
              {i + 1}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Panel count will appear once the sheet is composed.</p>
      )}
    </div>
  );
}

function RefList({ chunk }: { chunk: Chunk }) {
  const refs: { label: string; url: string | null; ready: boolean }[] = [
    { label: "Start Frame", url: chunk.start_frame_image_url, ready: !!chunk.start_frame_image_url },
    { label: "End Frame", url: chunk.end_frame_image_url, ready: !!chunk.end_frame_image_url },
    { label: "Storyboard Sheet", url: chunk.storyboard_image_url, ready: !!chunk.storyboard_image_url },
  ];
  return (
    <div className="space-y-2">
      {refs.map((r) => (
        <div key={r.label} className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/40 p-2.5">
          <div className="w-10 h-10 rounded-md border border-border/40 bg-card overflow-hidden shrink-0 flex items-center justify-center">
            {r.url ? (
              <img src={r.url} alt={r.label} className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{r.label}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {r.ready ? "Ready" : "Pending"}
            </div>
          </div>
          {r.ready && r.url && (
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
              <Maximize2 className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
