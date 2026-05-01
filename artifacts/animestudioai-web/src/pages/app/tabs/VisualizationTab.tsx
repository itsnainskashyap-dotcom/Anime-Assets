import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useProjectChunks } from "@/hooks/use-projects";
import type { Chunk, Project } from "@/types/api";

interface VisualizationPack {
  startFrame?: string;
  endFrame?: string;
  elements?: Array<{ id: string | number; name: string; url: string }>;
}

export default function VisualizationTab({ project }: { project: Project }) {
  const { api } = useAuth();
  const { data: chunks, isLoading: chunksLoading, error: chunksError } = useProjectChunks(project.id);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);

  const {
    data: visPack,
    isLoading: packLoading,
    error: packError,
  } = useQuery<VisualizationPack>({
    queryKey: ["visualization", selectedChunkId],
    queryFn: () =>
      api(`/api/chunks/${selectedChunkId}/visualization-pack`).then(
        (res) => res.json() as Promise<VisualizationPack>,
      ),
    enabled: !!selectedChunkId,
  });

  if (chunksLoading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }
  if (chunksError) {
    return (
      <div className="p-8 text-destructive">
        Failed to load: {(chunksError as Error).message}
      </div>
    );
  }
  if (!chunks || chunks.length === 0) {
    return (
      <div className="p-8 text-muted-foreground">
        No chunks generated yet. Start production to create visualization packs.
      </div>
    );
  }

  return (
    <div className="h-full bg-background/30 p-8 overflow-auto scrollbar-none">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Visualization Pack</h2>
            <p className="text-muted-foreground">Pre-rendered plates and depth maps.</p>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20 font-medium text-sm">
            <Layers className="w-4 h-4" /> {chunks.length} chunks
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm">
            Select a chunk
          </h3>
          <div className="flex flex-wrap gap-2">
            {chunks.map((chunk: Chunk) => (
              <button
                key={chunk.id}
                onClick={() => setSelectedChunkId(chunk.id)}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  selectedChunkId === chunk.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 bg-card hover:border-primary/30"
                }`}
              >
                Chunk {chunk.index}
              </button>
            ))}
          </div>
        </div>

        {!selectedChunkId ? (
          <div className="p-8 text-muted-foreground">Pick a chunk to see its visualization pack.</div>
        ) : packLoading ? (
          <div className="p-8 text-muted-foreground">Loading…</div>
        ) : packError ? (
          <div className="p-8 text-destructive">
            Failed to load: {(packError as Error).message}
          </div>
        ) : !visPack ? (
          <div className="p-8 text-muted-foreground">Nothing here yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm">Keyframes</h3>
              <div className="grid grid-cols-2 gap-4">
                {visPack.startFrame && (
                  <div
                    className="aspect-video rounded-xl border border-border/50 bg-card overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setSelectedFrame(visPack.startFrame ?? null)}
                  >
                    <img src={visPack.startFrame} alt="Start" className="w-full h-full object-cover" />
                    <div className="p-2 text-xs font-bold text-center bg-background/80 backdrop-blur border-t border-border/50">START FRAME</div>
                  </div>
                )}
                {visPack.endFrame && (
                  <div
                    className="aspect-video rounded-xl border border-border/50 bg-card overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setSelectedFrame(visPack.endFrame ?? null)}
                  >
                    <img src={visPack.endFrame} alt="End" className="w-full h-full object-cover" />
                    <div className="p-2 text-xs font-bold text-center bg-background/80 backdrop-blur border-t border-border/50">END FRAME</div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm">Elements</h3>
              <div className="grid grid-cols-2 gap-4">
                {(visPack.elements ?? []).map((el) => (
                  <div
                    key={el.id}
                    className="aspect-video rounded-xl border border-border/50 bg-card overflow-hidden cursor-pointer hover:border-primary/50 transition-colors relative"
                    onClick={() => setSelectedFrame(el.url)}
                  >
                    <img src={el.url} alt={el.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent flex items-end p-3">
                      <span className="text-xs font-bold">{el.name}</span>
                    </div>
                  </div>
                ))}
                {(!visPack.elements || visPack.elements.length === 0) && (
                  <div className="text-sm text-muted-foreground">No elements available.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedFrame && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-border/50 bg-card p-2 overflow-hidden shadow-2xl relative"
          >
            <img src={selectedFrame} alt="Selected" className="w-full h-auto rounded-xl" />
            <button
              className="absolute top-4 right-4 bg-background/80 backdrop-blur rounded-full w-8 h-8 flex items-center justify-center hover:bg-background transition-colors"
              onClick={() => setSelectedFrame(null)}
            >
              ✕
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
