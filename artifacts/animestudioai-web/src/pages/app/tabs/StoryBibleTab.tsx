import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Bot, User as UserIcon, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import type { Project } from "@/types/api";

interface StoryBible {
  logline?: string;
  worldRules?: string[];
  toneAndVoice?: string;
  themes?: string[];
}

interface ProjectWithBible extends Project {
  storyBible?: StoryBible | null;
}

export default function StoryBibleTab({ project }: { project: ProjectWithBible }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    {
      role: 'ai',
      content: `Welcome to the Story Bible for "${project.title}". I'm the AI Director. Based on your core prompt:\n\n"${project.storyPrompt}"\n\nI'm ready to expand this into a full cinematic universe. What would you like to focus on first?`,
    },
  ]);
  const [input, setInput] = useState("");

  const { data: bible, isLoading, error } = useQuery<StoryBible | null>({
    queryKey: ["projects", project.id, "story-bible"],
    queryFn: async () => {
      try {
        const res = await api(`/api/projects/${project.id}/story-bible`);
        return (await res.json()) as StoryBible;
      } catch (err) {
        if ((err as Error).message?.toLowerCase().includes("not found")) return null;
        throw err;
      }
    },
    initialData: project.storyBible ?? undefined,
  });

  const generateBible = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/story-bible/generate`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", project.id, "story-bible"] });
      setMessages(prev => [...prev, {
        role: 'ai',
        content: "I've started generating the full Story Bible. Once complete, you'll be able to review the lore, plot arc, and world-building rules before we move to character design.",
      }]);
    },
  });

  const generateCharacters = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/characters/generate`, { method: "POST" }),
    onSuccess: () => {
      setMessages(prev => [...prev, {
        role: 'ai',
        content: "Character generation pipeline initiated. Check the Characters tab soon to review the initial concepts and model sheets.",
      }]);
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput("");
  };

  return (
    <div className="h-full flex gap-1">
      <div className="w-[400px] border-r border-border/50 bg-card/30 flex flex-col">
        <div className="p-4 border-b border-border/50 bg-background/50 flex items-center gap-2 shrink-0">
          <Bot className="w-5 h-5 text-primary" />
          <h3 className="font-bold">AI Director</h3>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                  {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-3 rounded-lg text-sm max-w-[85%] whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border/50 bg-background/50 shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Guide the Director..."
              className="bg-card"
            />
            <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-background/30 overflow-hidden relative">
        <div className="absolute inset-0 p-8 overflow-auto scrollbar-none">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Studio Master Document</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => generateBible.mutate()}
                  disabled={generateBible.isPending}
                  className="gap-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5"
                >
                  {generateBible.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-primary" />}
                  Generate Bible
                </Button>
                <Button
                  onClick={() => generateCharacters.mutate()}
                  disabled={generateCharacters.isPending}
                  className="gap-2"
                >
                  {generateCharacters.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Characters
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="p-8 text-muted-foreground">Loading…</div>
            ) : error ? (
              <div className="p-8 text-destructive">Failed to load: {(error as Error).message}</div>
            ) : !bible ? (
              <div className="p-8 text-muted-foreground">
                Story Bible not generated yet. Click <strong>Generate Bible</strong> above to create one.
              </div>
            ) : (
              <div className="space-y-6">
                {bible.logline && (
                  <div className="p-6 rounded-xl border border-border/50 bg-card/50">
                    <h3 className="text-lg font-bold mb-4 text-primary">Core Logline</h3>
                    <p className="text-muted-foreground leading-relaxed">{bible.logline}</p>
                  </div>
                )}

                {bible.worldRules && bible.worldRules.length > 0 && (
                  <div className="p-6 rounded-xl border border-border/50 bg-card/50">
                    <h3 className="text-lg font-bold mb-4 text-primary">World Rules</h3>
                    <ul className="list-disc pl-5 text-muted-foreground space-y-2 leading-relaxed">
                      {bible.worldRules.map((r, i) => (<li key={i}>{r}</li>))}
                    </ul>
                  </div>
                )}

                {(bible.toneAndVoice || project.voice) && (
                  <div className="p-6 rounded-xl border border-border/50 bg-card/50">
                    <h3 className="text-lg font-bold mb-4 text-primary">Tone & Voice</h3>
                    <p className="text-muted-foreground leading-relaxed capitalize">
                      {bible.toneAndVoice || project.voice?.replace('_', ' ')}
                    </p>
                    {project.genres?.length > 0 && (
                      <div className="mt-4 flex gap-2 flex-wrap">
                        {project.genres.map((g) => (
                          <span key={g} className="px-3 py-1 rounded bg-secondary text-xs">{g}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
