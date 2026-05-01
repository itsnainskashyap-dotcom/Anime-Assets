import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Square, AlertTriangle, CheckCircle2, Film, Clock, Eye, Download, LayoutTemplate, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";

export default function ProductionTab({ project }: { project: any }) {
  const { api, token } = useAuth();
  const [activeChunk, setActiveChunk] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  // Poll for status
  const { data: status } = useQuery({
    queryKey: ["production-status", project.id],
    queryFn: () => api(`/api/projects/${project.id}/production/status`).then(res => res.json()),
    refetchInterval: 3000,
  });

  const startProd = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/production/start`, { method: "POST" }),
  });

  const pauseProd = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/production/pause`, { method: "POST" }),
  });

  useEffect(() => {
    let active = true;
    let abortController = new AbortController();

    const connect = async () => {
      if (!active) return;
      try {
        const url = import.meta.env.BASE_URL + `api/projects/${project.id}/playground/events`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal
        });
        if (!res.ok) return;

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || "";

            for (const chunk of lines) {
              const eventMatch = chunk.match(/^event:\s*(.+)$/m);
              const dataMatch = chunk.match(/^data:\s*(.+)$/m);
              
              if (eventMatch && dataMatch) {
                const eventName = eventMatch[1].trim();
                try {
                  const data = JSON.parse(dataMatch[1].trim());
                  if (eventName === "history" && data.events) {
                    setLogs(data.events);
                  } else if (eventName === "playground") {
                    setLogs(prev => [...prev, data].slice(-50));
                  }
                } catch (e) {}
              }
            }
          }
        }
      } catch (err) {}
    };

    connect();

    return () => {
      active = false;
      if (abortController) abortController.abort();
    };
  }, [project.id, token]);


  // Mock tree data
  const acts = [
    {
      id: "act1", name: "Act 1: The Drop", progress: 100, scenes: [
        { id: "s1", name: "Scene 1", progress: 100, chunks: [{ id: "c1", status: "completed", index: 1 }, { id: "c2", status: "completed", index: 2 }] },
        { id: "s2", name: "Scene 2", progress: 100, chunks: [{ id: "c3", status: "completed", index: 1 }] }
      ]
    },
    {
      id: "act2", name: "Act 2: The Core", progress: status?.progress || 45, scenes: [
        { id: "s3", name: "Scene 3", progress: 90, chunks: [{ id: "c4", status: "completed", index: 1 }, { id: "c5", status: "processing", index: 2 }] },
        { id: "s4", name: "Scene 4", progress: 0, chunks: [{ id: "c6", status: "pending", index: 1 }] }
      ]
    }
  ];

  return (
    <div className="h-full flex gap-1">
      {/* Left: Tree & Controls */}
      <div className="w-[350px] border-r border-border/50 bg-card/30 flex flex-col">
        <div className="p-6 border-b border-border/50 bg-background/50 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">Production Run</h3>
            <div className="flex gap-2">
              <Button size="icon" variant="outline" className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-500/10" onClick={() => startProd.mutate()}>
                <Play className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="outline" className="h-8 w-8 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10" onClick={() => pauseProd.mutate()}>
                <Pause className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="outline" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                <Square className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-bold text-primary">{status?.progress || 45}%</span>
            </div>
            <Progress value={status?.progress || 45} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-card border border-border/50 rounded-lg p-3">
              <div className="text-muted-foreground mb-1 flex items-center gap-1"><LayoutTemplate className="w-3 h-3" /> Scenes</div>
              <div className="font-semibold">{status?.scenesComplete || 2} / 4</div>
            </div>
            <div className="bg-card border border-border/50 rounded-lg p-3">
              <div className="text-muted-foreground mb-1 flex items-center gap-1"><Film className="w-3 h-3" /> Chunks</div>
              <div className="font-semibold">{status?.chunksComplete || 3} / 6</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-6 scrollbar-none">
          {acts.map(act => (
            <div key={act.id} className="space-y-3">
              <div className="flex justify-between text-sm font-bold text-muted-foreground uppercase tracking-wider">
                <span>{act.name}</span>
                <span>{act.progress}%</span>
              </div>
              
              <div className="space-y-3 pl-2 border-l border-border/50">
                {act.scenes.map(scene => (
                  <div key={scene.id} className="space-y-2">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      {scene.name}
                    </div>
                    <div className="pl-4 flex flex-wrap gap-2">
                      {scene.chunks.map(chunk => (
                        <button
                          key={chunk.id}
                          onClick={() => setActiveChunk(chunk)}
                          className={`w-8 h-8 rounded border flex items-center justify-center text-xs font-bold transition-colors ${
                            chunk.status === 'completed' ? 'bg-primary/20 border-primary/50 text-primary' :
                            chunk.status === 'processing' ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 animate-pulse' :
                            'bg-card border-border text-muted-foreground hover:border-primary/50'
                          } ${activeChunk?.id === chunk.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                        >
                          {chunk.index}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Preview & Details */}
      <div className="flex-1 bg-background/30 p-8 overflow-auto scrollbar-none">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="aspect-video rounded-xl border border-border/50 bg-black overflow-hidden relative flex flex-col items-center justify-center group shadow-2xl">
            <Film className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <div className="text-muted-foreground font-medium uppercase tracking-widest">
              {activeChunk ? `Previewing Chunk ${activeChunk.index}` : 'Latest Render Preview'}
            </div>
            
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button size="icon" className="rounded-full w-12 h-12 bg-primary text-primary-foreground hover:bg-primary/90">
                    <Play className="w-5 h-5 ml-1" />
                  </Button>
                  <div>
                    <div className="font-bold">Scene 3 - Chunk 2</div>
                    <div className="text-sm text-primary">Rendering...</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="secondary" className="rounded-full bg-background/50 backdrop-blur"><Eye className="w-4 h-4" /></Button>
                  <Button size="icon" variant="secondary" className="rounded-full bg-background/50 backdrop-blur"><Download className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          </div>

          {activeChunk && (
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 p-6 rounded-xl border border-border/50 bg-card/50 space-y-4">
                <h3 className="font-bold text-lg">Chunk Details</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Visual Prompt</div>
                    <p className="text-sm leading-relaxed">High contrast neon lighting. Elara looking back over her shoulder, rain hitting her face. Cinematic depth of field, 85mm lens.</p>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Motion Prompt</div>
                    <p className="text-sm leading-relaxed">Slow motion turn, hair flowing in the wind. Rain droplets splashing. Camera tracks slightly right.</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 rounded-xl border border-border/50 bg-card/50 flex flex-col">
                <h3 className="font-bold text-lg mb-4 shrink-0">Live Logs</h3>
                <div className="flex-1 overflow-auto space-y-3 text-xs font-mono scrollbar-thin">
                  {logs.slice(-20).reverse().map((l: any, i) => (
                    <div key={i} className="text-muted-foreground flex gap-2">
                      <span className="text-primary opacity-50 shrink-0">[{new Date(l.created_at).toLocaleTimeString()}]</span> 
                      <span>{l.message}</span>
                    </div>
                  ))}
                  {logs.length === 0 && <div className="text-muted-foreground">Waiting for events...</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
