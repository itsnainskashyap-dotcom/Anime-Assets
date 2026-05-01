import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Lock, Loader2, ShieldCheck, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { Project } from "@/types/api";

interface Character {
  id: string;
  name: string;
  role: string;
  locked: boolean;
  age?: number | string;
  height?: string;
  affiliation?: string;
  backstory?: string;
  modelSheetUrl?: string;
  expressions?: Array<{ id: string; name: string; url?: string }>;
}

export default function CharacterStudioTab({ project }: { project: Project }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  const { data: characters, isLoading, error } = useQuery<Character[]>({
    queryKey: ["projects", project.id, "characters"],
    queryFn: async () => {
      try {
        const res = await api(`/api/projects/${project.id}/characters`);
        return (await res.json()) as Character[];
      } catch (err) {
        if ((err as Error).message?.toLowerCase().includes("not found")) return [];
        throw err;
      }
    },
  });

  const generateCharacters = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/characters/generate`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", project.id, "characters"] }),
  });

  const approveLock = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/characters/approve-lock`, { method: "POST" }),
  });

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }
  if (error) {
    return <div className="p-8 text-destructive">Failed to load: {(error as Error).message}</div>;
  }
  if (!characters || characters.length === 0) {
    return (
      <div className="p-8 flex flex-col items-start gap-4 text-muted-foreground">
        <p>No characters yet.</p>
        <Button
          className="gap-2"
          onClick={() => generateCharacters.mutate()}
          disabled={generateCharacters.isPending}
        >
          {generateCharacters.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate Characters
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-1">
      <div className="w-[300px] border-r border-border/50 bg-card/30 flex flex-col p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Characters</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => generateCharacters.mutate()}
            disabled={generateCharacters.isPending}
          >
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
                  {selectedCharacter.modelSheetUrl ? (
                    <img src={selectedCharacter.modelSheetUrl} alt={selectedCharacter.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 font-bold text-2xl tracking-widest uppercase">
                      Model sheet pending
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {(selectedCharacter.expressions ?? []).map(ex => (
                    <div key={ex.id} className="aspect-square rounded-lg bg-card border border-border/50 flex items-center justify-center overflow-hidden">
                      {ex.url ? (
                        <img src={ex.url} alt={ex.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground uppercase font-semibold">{ex.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 rounded-xl border border-border/50 bg-card/50">
                  <h4 className="font-semibold text-sm mb-3 uppercase tracking-wider text-muted-foreground">Traits</h4>
                  <div className="space-y-2">
                    {selectedCharacter.age !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Age</span>
                        <span>{selectedCharacter.age}</span>
                      </div>
                    )}
                    {selectedCharacter.height && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Height</span>
                        <span>{selectedCharacter.height}</span>
                      </div>
                    )}
                    {selectedCharacter.affiliation && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Affiliation</span>
                        <span>{selectedCharacter.affiliation}</span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedCharacter.backstory && (
                  <div className="p-4 rounded-xl border border-border/50 bg-card/50">
                    <h4 className="font-semibold text-sm mb-3 uppercase tracking-wider text-muted-foreground">Backstory</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedCharacter.backstory}</p>
                  </div>
                )}
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
