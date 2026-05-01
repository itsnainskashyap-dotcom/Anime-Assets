import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Music, Play, CheckCircle2, Loader2, Sparkles, Mic, FileVideo, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";

export default function SongTab({ project }: { project: any }) {
  const { api } = useAuth();
  
  // Mock song ID for now, in reality we'd get this from project or create it
  const songId = project?.id + "-song";
  const [formData, setFormData] = useState({ title: "", lyricsConcept: "", durationSeconds: 180 });

  const { data: song, isLoading } = useQuery({
    queryKey: ["song", songId],
    queryFn: () => api(`/api/song/${songId}`).then(res => res.json()).catch(() => null),
  });

  const createSong = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/song/create`, { method: "POST", body: JSON.stringify(formData) }),
  });

  const runStage = useMutation({
    mutationFn: (stage: string) => api(`/api/song/${songId}/${stage}`, { method: "POST" }),
  });

  const stages = [
    { id: "generate-lyrics", label: "Lyrics", icon: FileText },
    { id: "generate-music", label: "Music & Vocals", icon: Mic },
    { id: "generate-video", label: "Visuals", icon: FileVideo },
    { id: "lipsync", label: "Lip Sync", icon: Sparkles },
    { id: "export", label: "Final Export", icon: Download }
  ];

  if (!song && !createSong.isSuccess) {
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
                  onChange={e => setFormData(p => ({...p, title: e.target.value}))} 
                  placeholder="e.g. Neon Resonance Theme"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Lyrics Concept / Theme</Label>
                <Textarea 
                  value={formData.lyricsConcept} 
                  onChange={e => setFormData(p => ({...p, lyricsConcept: e.target.value}))}
                  placeholder="A song about losing memories but finding hope in the neon city..."
                  className="min-h-[100px] bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (seconds)</Label>
                <Input 
                  type="number"
                  value={formData.durationSeconds} 
                  onChange={e => setFormData(p => ({...p, durationSeconds: parseInt(e.target.value)}))} 
                  className="bg-background"
                />
              </div>
            </div>
            
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

  return (
    <div className="h-full flex gap-1 bg-background/30">
      <div className="w-[300px] border-r border-border/50 bg-card/30 p-6 flex flex-col gap-6">
        <div>
          <h3 className="font-bold text-lg mb-4">Pipeline</h3>
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {stages.map((s, i) => (
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
               <h2 className="text-2xl font-bold">{formData.title || "Song Project"}</h2>
               <p className="text-muted-foreground">Pipeline Execution</p>
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
               <div className="text-sm text-muted-foreground font-serif leading-relaxed italic">
                 (Generated lyrics will appear here...)
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

function FileText(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>;
}
