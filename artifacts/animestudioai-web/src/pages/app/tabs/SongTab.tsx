import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Music, Play, Loader2, Mic, FileVideo, Download, FileText } from "lucide-react";
import { PiMagicWandDuotone } from "react-icons/pi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import type { Project } from "@/types/api";

interface SongRecord {
  id: string;
  title: string;
  lyricsConcept?: string;
  lyrics?: string;
  durationSeconds: number;
  status: string;
}

interface CreateSongResponse {
  songId: string;
}

export default function SongTab({ project }: { project: Project }) {
  const { api } = useAuth();
  const [songId, setSongId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: "", lyricsConcept: "", durationSeconds: 180 });

  const { data: song, isLoading, error } = useQuery<SongRecord | null>({
    queryKey: ["song", songId],
    queryFn: () => api(`/api/song/${songId}`).then(res => res.json() as Promise<SongRecord>),
    enabled: !!songId,
  });

  const createSong = useMutation<CreateSongResponse, Error, void>({
    mutationFn: () =>
      api(`/api/projects/${project.id}/song/create`, {
        method: "POST",
        body: JSON.stringify(formData),
      }).then(res => res.json() as Promise<CreateSongResponse>),
    onSuccess: (data) => setSongId(data.songId),
  });

  const runStage = useMutation<unknown, Error, string>({
    mutationFn: (stage: string) => api(`/api/song/${songId}/${stage}`, { method: "POST" }),
  });

  const stages = [
    { id: "generate-lyrics", label: "Lyrics", icon: FileText },
    { id: "generate-music", label: "Music & Vocals", icon: Mic },
    { id: "generate-video", label: "Visuals", icon: FileVideo },
    { id: "lipsync", label: "Lip Sync", icon: PiMagicWandDuotone },
    { id: "export", label: "Final Export", icon: Download }
  ];

  if (!songId) {
    return (
      <div className="h-full bg-background/30 p-8 overflow-auto scrollbar-none">
        <div className="max-w-2xl mx-auto space-y-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Song Studio</h2>
            <p className="text-muted-foreground mt-1">Create an original soundtrack or OP/ED for your project.</p>
          </div>

          <div className="bg-card border border-border/50 rounded-xl p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Song Title</Label>
                <Input
                  value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Neon Resonance Theme"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Lyrics Concept / Theme</Label>
                <Textarea
                  value={formData.lyricsConcept}
                  onChange={e => setFormData(p => ({ ...p, lyricsConcept: e.target.value }))}
                  placeholder="A song about losing memories but finding hope in the neon city..."
                  className="min-h-[100px] bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (seconds)</Label>
                <Input
                  type="number"
                  value={formData.durationSeconds}
                  onChange={e => setFormData(p => ({ ...p, durationSeconds: parseInt(e.target.value) || 0 }))}
                  className="bg-background"
                />
              </div>
            </div>

            {createSong.error && (
              <div className="text-sm text-destructive">Failed: {createSong.error.message}</div>
            )}

            <Button
              className="w-full gap-2"
              onClick={() => createSong.mutate()}
              disabled={createSong.isPending || !formData.title}
            >
              {createSong.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
              Initialize Song Project
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-destructive">Failed to load: {(error as Error).message}</div>;
  if (!song) return <div className="p-8 text-muted-foreground">Nothing here yet.</div>;

  return (
    <div className="h-full flex gap-1 bg-background/30">
      <div className="w-[300px] border-r border-border/50 bg-card/30 p-6 flex flex-col gap-6">
        <div>
          <h3 className="font-bold text-lg mb-4">Pipeline</h3>
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {stages.map(s => (
              <div key={s.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-primary bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-lg border border-border/50 bg-card/50">
                  <div className="font-bold text-sm mb-2">{s.label}</div>
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => runStage.mutate(s.id)}>Run</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto scrollbar-none">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{song.title}</h2>
              <p className="text-muted-foreground">Pipeline Execution — Status: {song.status}</p>
            </div>
          </div>

          <div className="aspect-video rounded-xl bg-black border border-border/50 overflow-hidden relative flex flex-col items-center justify-center group shadow-2xl">
            <Music className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <div className="text-muted-foreground font-medium uppercase tracking-widest">
              Audio/Video Preview
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
              <h3 className="font-bold">Lyrics</h3>
              <div className="text-sm text-muted-foreground font-serif leading-relaxed italic whitespace-pre-wrap">
                {song.lyrics || "(Generated lyrics will appear here…)"}
              </div>
            </div>
            <div className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
              <h3 className="font-bold">Stem Tracks</h3>
              <div className="space-y-2">
                {['Vocals', 'Instrumental', 'Bass', 'Drums'].map(t => (
                  <div key={t} className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/50">
                    <span className="text-sm font-medium">{t}</span>
                    <Button size="icon" variant="ghost" className="w-6 h-6"><Play className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
