import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { User, Lock, Loader2, Play, ChevronRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function CharacterStudioTab({ project }: { project: any }) {
  const { api } = useAuth();
  const [selectedCharacter, setSelectedCharacter] = useState<any>(null);

  const approveLock = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/characters/approve-lock`, { method: "POST" }),
  });

  // Mock characters
  const characters = [
    { id: 1, name: "Kaelen", role: "Protagonist", locked: false },
    { id: 2, name: "Elara", role: "Rogue Archivist", locked: true },
  ];

  return (
    <div className="h-full flex gap-1">
      {/* Left Sidebar */}
      <div className="w-[300px] border-r border-border/50 bg-card/30 flex flex-col p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Characters</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {characters.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCharacter(c)}
              className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between ${selectedCharacter?.id === c.id ? 'border-primary bg-primary/5' : 'border-border/50 bg-card/50 hover:border-primary/30'}`}
            >
              <div>
                <div className="font-semibold text-sm">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.role}</div>
              </div>
              {c.locked && <ShieldCheck className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>

        <div className="mt-auto pt-4">
          <Button 
            className="w-full gap-2" 
            onClick={() => approveLock.mutate()}
            disabled={approveLock.isPending}
          >
            {approveLock.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Lock Canon Designs
          </Button>
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 bg-background/30 p-8 overflow-auto scrollbar-none">
        {selectedCharacter ? (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-bold">{selectedCharacter.name}</h2>
                <div className="text-lg text-muted-foreground">{selectedCharacter.role}</div>
              </div>
              {selectedCharacter.locked && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                  <ShieldCheck className="w-4 h-4" /> Canon Locked
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-6">
                <div className="aspect-[16/9] rounded-xl bg-card border border-border/50 overflow-hidden flex items-center justify-center relative">
                   <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 font-bold text-2xl tracking-widest uppercase">
                     MODEL SHEET (3-QUARTER)
                   </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => (
                     <div key={i} className="aspect-square rounded-lg bg-card border border-border/50 flex items-center justify-center">
                       <span className="text-xs text-muted-foreground uppercase font-semibold">Expression {i}</span>
                     </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 rounded-xl border border-border/50 bg-card/50">
                  <h4 className="font-semibold text-sm mb-3 uppercase tracking-wider text-muted-foreground">Traits</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Age</span>
                      <span>24</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Height</span>
                      <span>175 cm</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Affiliation</span>
                      <span>Rogue</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/50 bg-card/50">
                  <h4 className="font-semibold text-sm mb-3 uppercase tracking-wider text-muted-foreground">Backstory</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    A former archivist who discovered a memory that didn't belong to anyone...
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <User className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a character to view their studio sheet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Dummy Plus for the button
function Plus(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14"/><path d="M12 5v14"/>
    </svg>
  );
}
