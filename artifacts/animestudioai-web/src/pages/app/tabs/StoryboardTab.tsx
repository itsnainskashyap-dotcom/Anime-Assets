import { useState } from "react";
import { motion } from "framer-motion";
import { Play, CheckCircle2, RefreshCcw, Loader2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";

export default function StoryboardTab({ project }: { project: any }) {
  const { api } = useAuth();
  
  const generateStoryboard = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/storyboard/generate`, { method: "POST" }),
  });

  // Mock data
  const scenes = [
    { id: 1, text: "Kaelen stands at the edge of the neon-lit Canopy, looking down at the fog-covered Stems.", status: "approved" },
    { id: 2, text: "Camera pans to show Elara sneaking through an alleyway, holding a glowing memory drive.", status: "review" },
    { id: 3, text: "A drone spotlight sweeps across the alley. Elara presses herself against the wet brick wall.", status: "pending" },
  ];

  return (
    <div className="h-full flex gap-1">
      {/* Left: Timeline / Outline */}
      <div className="w-[300px] border-r border-border/50 bg-card/30 p-4 overflow-auto scrollbar-none flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold">Episode Timeline</h3>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">Act 1</span>
        </div>

        <div className="relative border-l-2 border-border/50 ml-3 pl-4 space-y-6">
          {scenes.map((s, i) => (
            <div key={s.id} className="relative">
              <div className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full border-2 bg-background ${s.status === 'approved' ? 'border-primary' : 'border-border'}`} />
              <div className="text-sm font-semibold text-muted-foreground mb-1">Scene {i + 1}</div>
              <p className="text-sm leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-4">
          <Button 
            className="w-full gap-2" 
            onClick={() => generateStoryboard.mutate()}
            disabled={generateStoryboard.isPending}
          >
            {generateStoryboard.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Regenerate Missing
          </Button>
        </div>
      </div>

      {/* Right: Boards */}
      <div className="flex-1 bg-background/30 p-8 overflow-auto scrollbar-none">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Storyboard Review</h2>
              <p className="text-muted-foreground">Approve camera angles and pacing before final production.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <Play className="w-4 h-4" /> Play Animatics
              </Button>
              <Button className="gap-2">
                <CheckCircle2 className="w-4 h-4" /> Approve All
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenes.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group rounded-xl border border-border/50 bg-card overflow-hidden"
              >
                <div className="aspect-video bg-muted relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-muted-foreground/30 font-bold tracking-wider">BOARD {i+1}</span>
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button size="icon" variant="secondary" className="w-8 h-8 rounded-full bg-background/50 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {s.status === 'approved' && (
                    <div className="absolute bottom-2 right-2">
                      <div className="bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded text-xs font-medium backdrop-blur flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Approved
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-border/50">
                  <div className="text-xs font-bold text-muted-foreground mb-2 flex items-center justify-between">
                    <span>SCENE {i+1}</span>
                    <span>3.5s</span>
                  </div>
                  <p className="text-sm line-clamp-3 leading-relaxed text-foreground/80">{s.text}</p>
                  
                  {s.status !== 'approved' && (
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">Regenerate</Button>
                      <Button size="sm" className="flex-1">Approve</Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
