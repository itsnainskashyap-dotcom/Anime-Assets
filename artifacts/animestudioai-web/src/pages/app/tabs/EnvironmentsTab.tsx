import { useState } from "react";
import { motion } from "framer-motion";
import { Mountain, Loader2, Plus, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { Project } from "@/types/api";

interface Environment {
  id: number;
  name: string;
  type: string;
  lighting: string;
  weather: string;
  timeOfDay: string;
}

export default function EnvironmentsTab({ project }: { project: Project }) {
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null);

  const environments: Environment[] = [
    { id: 1, name: "The Canopy", type: "Cityscape", lighting: "Neon, High Contrast", weather: "Constant Rain", timeOfDay: "Night" },
    { id: 2, name: "The Stems", type: "Industrial", lighting: "Dim, Flickering", weather: "Foggy", timeOfDay: "Any" }
  ];

  return (
    <div className="h-full flex gap-1">
      {/* Left Sidebar */}
      <div className="w-[300px] border-r border-border/50 bg-card/30 flex flex-col p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Locations</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {environments.map(e => (
            <button
              key={e.id}
              onClick={() => setSelectedEnv(e)}
              className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between ${selectedEnv?.id === e.id ? 'border-primary bg-primary/5' : 'border-border/50 bg-card/50 hover:border-primary/30'}`}
            >
              <div>
                <div className="font-semibold text-sm">{e.name}</div>
                <div className="text-xs text-muted-foreground">{e.type}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 bg-background/30 p-8 overflow-auto scrollbar-none">
        {selectedEnv ? (
          <div className="max-w-4xl mx-auto space-y-8">
            <div>
              <h2 className="text-3xl font-bold">{selectedEnv.name}</h2>
              <div className="text-lg text-muted-foreground">{selectedEnv.type}</div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-6">
                <div className="aspect-video rounded-xl bg-card border border-border/50 overflow-hidden flex items-center justify-center relative">
                   <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 font-bold text-2xl tracking-widest uppercase">
                     ENVIRONMENT PLATE
                   </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 rounded-xl border border-border/50 bg-card/50">
                  <h4 className="font-semibold text-sm mb-3 uppercase tracking-wider text-muted-foreground">Rules</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Lighting</span>
                      <span>{selectedEnv.lighting}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Weather</span>
                      <span>{selectedEnv.weather}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Time</span>
                      <span>{selectedEnv.timeOfDay}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Mountain className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a location to view its environmental rules</p>
          </div>
        )}
      </div>
    </div>
  );
}
