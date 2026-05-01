import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, LayoutTemplate, Clock, Film, CheckCircle2 } from "lucide-react";
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
  status?: string;
  start_frame_url?: string | null;
  end_frame_url?: string | null;
}

const EMOTION_COLORS: Record<string, string> = {
  intense: "text-red-400 bg-red-500/10 border-red-500/20",
  calm: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  hopeful: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  dramatic: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  melancholic: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  cinematic: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

export default function StoryboardTab({ project }: { project: Project }) {
  const { api } = useAuth();

  const { data: scenes = [], isLoading, error } = useQuery<Scene[]>({
    queryKey: ["projects", project.id, "scenes"],
    queryFn: async () => {
      const res = await api(`/api/projects/${project.id}/scenes`);
      return res.json() as Promise<Scene[]>;
    },
    refetchInterval: (query) => {
      const sc = query.state.data as Scene[] | undefined;
      if (!sc || sc.length === 0) return 6000;
      const anyNoBoard = sc.some(s => !s.start_frame_url);
      return anyNoBoard ? 8000 : false;
    },
  });

  const generateStoryboard = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/storyboard/generate`, { method: "POST" }),
  });

  const generateViz = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/visualization/generate`, { method: "POST" }),
  });

  const boardCount = scenes.filter(s => s.start_frame_url).length;
  const totalScenes = scenes.length;
  const actGroups = scenes.reduce<Record<number, Scene[]>>((acc, s) => {
    const act = s.act_number ?? 1;
    if (!acc[act]) acc[act] = [];
    acc[act].push(s);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading scenes…
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-destructive">Failed to load: {(error as Error).message}</div>;
  }

  if (totalScenes === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-full bg-card border border-border/50 flex items-center justify-center">
          <LayoutTemplate className="w-8 h-8 text-muted-foreground/30" />
        </div>
        <div>
          <p className="font-semibold mb-1">Scenes not yet generated</p>
          <p className="text-sm text-muted-foreground">Scenes are created automatically from the Story Bible.<br/>Generate your bible first.</p>
        </div>
        <Button className="gap-2" onClick={() => generateStoryboard.mutate()} disabled={generateStoryboard.isPending}>
          {generateStoryboard.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate Storyboard
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto scrollbar-none">
      <div className="max-w-5xl mx-auto p-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <LayoutTemplate className="w-6 h-6 text-primary" />
              Storyboard
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {totalScenes} scenes
              {boardCount > 0 && ` • ${boardCount}/${totalScenes} visualization boards ready`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {boardCount < totalScenes && boardCount === 0 && (
              <Button size="sm" onClick={() => generateViz.mutate()} disabled={generateViz.isPending} variant="outline" className="gap-2">
                {generateViz.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4 text-primary" />}
                Generate Boards
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar for visualization */}
        {boardCount > 0 && boardCount < totalScenes && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-amber-300">Generating scene boards…</span>
                <span className="text-muted-foreground">{boardCount}/{totalScenes}</span>
              </div>
              <div className="h-1.5 rounded-full bg-amber-500/20 overflow-hidden">
                <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${(boardCount / totalScenes) * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Act groups */}
        {Object.entries(actGroups).map(([act, actScenes]) => (
          <div key={act} className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <div className="h-px flex-1 bg-border/50" />
              Act {act}
              <div className="h-px flex-1 bg-border/50" />
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {actScenes.map((scene) => {
                const emotionClass = EMOTION_COLORS[scene.emotion?.toLowerCase() ?? ""] ?? EMOTION_COLORS.cinematic;
                return (
                  <div key={scene.id} className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                    {/* Board image */}
                    <div className="aspect-video bg-muted/30 relative flex items-center justify-center">
                      {scene.start_frame_url ? (
                        <img src={scene.start_frame_url} alt={scene.title ?? `Scene ${scene.scene_number}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-muted-foreground/30">
                          <Film className="w-8 h-8" />
                          <span className="text-xs uppercase tracking-wider">Board pending</span>
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className="text-xs font-bold bg-background/60 backdrop-blur px-2 py-0.5 rounded text-muted-foreground">
                          S{scene.scene_number}
                        </span>
                      </div>
                      {scene.status === "storyboarded" && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 drop-shadow" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 space-y-2">
                      {scene.title && <p className="font-semibold text-sm">{scene.title}</p>}
                      {scene.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{scene.description}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {scene.duration_seconds && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Clock className="w-3 h-3" /> {scene.duration_seconds}s
                          </Badge>
                        )}
                        {scene.shot_type && (
                          <Badge variant="outline" className="text-xs border-border/50 capitalize">{scene.shot_type}</Badge>
                        )}
                        {scene.emotion && (
                          <Badge variant="outline" className={`text-xs border ${emotionClass} capitalize`}>{scene.emotion}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
