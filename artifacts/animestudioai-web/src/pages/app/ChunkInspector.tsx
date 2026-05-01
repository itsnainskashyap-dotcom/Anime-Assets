import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ChevronLeft, Upload, RefreshCcw, Video, Loader2, Play, Eye, Settings2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useProjectChunks } from "@/hooks/use-projects";
import type { Chunk } from "@/types/api";

interface ReferenceVideo {
  url?: string;
}

export default function ChunkInspector() {
  const params = useParams<{ id: string; chunkId: string }>();
  const id = params.id ?? "";
  const chunkId = params.chunkId ?? "";
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [uploading, setUploading] = useState(false);

  const { data: chunks, isLoading, error } = useProjectChunks(id);

  const chunk: Chunk | undefined = chunks?.find((c) => c.id === chunkId);

  const { data: refVideo } = useQuery<ReferenceVideo | null>({
    queryKey: ["chunks", chunkId, "reference"],
    queryFn: () =>
      api(`/api/chunks/${chunkId}/reference-video`).then(
        (res) => res.json() as Promise<ReferenceVideo | null>,
      ),
    enabled: !!chunk,
  });

  const retryChunk = useMutation({
    mutationFn: () => api(`/api/chunks/${chunkId}/retry`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", id, "chunks"] }),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await api(`/api/chunks/${chunkId}/reference-video/upload`, {
        method: "POST",
        body: formData,
      });
      queryClient.invalidateQueries({ queryKey: ["chunks", chunkId, "reference"] });
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }
  if (error) {
    return <div className="p-8 text-destructive">Failed to load: {(error as Error).message}</div>;
  }
  if (!chunk) {
    return (
      <div className="p-8 text-muted-foreground">
        Chunk not found in this project.
        <div className="mt-4">
          <Button variant="outline" onClick={() => setLocation(`/app/projects/${id}/production`)}>Back to Production</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="h-16 border-b border-border/50 bg-card/50 flex items-center px-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/app/projects/${id}/production`)} className="mr-4">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="font-bold flex items-center gap-2">
            Chunk {chunk.index} Inspector
            {((chunk.generationMode || chunk.generation_mode) === "reference_video") && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300"
                title="This chunk continues the previous shot using a reference video (@Video1)."
                data-testid="badge-reference-video"
              >
                <Video className="w-3 h-3" /> Reference Video
              </span>
            )}
          </h1>
          <div className="text-xs text-muted-foreground">Scene {chunk.sceneId} • Status: {chunk.status}</div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => retryChunk.mutate()} disabled={retryChunk.isPending}>
            {retryChunk.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
            Retry Generation
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8 bg-background/30">
        <div className="max-w-5xl mx-auto grid grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-card rounded-xl border border-border/50 p-6 space-y-4">
              <h3 className="font-bold flex items-center gap-2"><Settings2 className="w-4 h-4 text-primary" /> Prompt Data</h3>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Generation Prompt</label>
                <div className="p-3 mt-1 bg-background/50 rounded border border-border/50 text-sm leading-relaxed">
                  {chunk.prompt || "No prompt available."}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Payload JSON</label>
                <pre className="p-3 mt-1 bg-background/50 rounded border border-border/50 text-xs overflow-auto max-h-48 text-muted-foreground">
                  {JSON.stringify(chunk, null, 2)}
                </pre>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border/50 p-6 space-y-4">
              <h3 className="font-bold flex items-center gap-2"><Activity className="w-4 h-4 text-amber-500" /> Retry History</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Retries</span>
                  <span className="font-medium">{chunk.retryCount || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-xl border border-border/50 p-6 space-y-4">
              <h3 className="font-bold flex items-center gap-2"><Video className="w-4 h-4 text-primary" /> Reference Video</h3>

              <div className="aspect-video bg-black rounded-lg border border-border/50 flex flex-col items-center justify-center relative overflow-hidden group">
                {refVideo?.url ? (
                  <>
                    <video src={refVideo.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Button variant="secondary" size="icon" className="rounded-full w-12 h-12"><Play className="w-5 h-5 ml-1" /></Button>
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
                    <Eye className="w-8 h-8 opacity-20" />
                    <span>No reference video attached</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="video/mp4"
                    onChange={handleUpload}
                    className="hidden"
                    id="ref-upload"
                  />
                  <label htmlFor="ref-upload">
                    <Button variant="outline" className="w-full" asChild disabled={uploading}>
                      <span>
                        {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        Upload MP4 (≤ 25MB)
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
