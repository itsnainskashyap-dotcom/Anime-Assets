import { useState } from "react";
import { Download, Share2, Settings, FileVideo, FileText, Loader2, Play, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import type { Project } from "@/types/api";

export default function ExportTab({ project }: { project: Project }) {
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState({
    mp4: true,
    srt: true,
    zip: false,
    characterSheets: true,
    storyBible: true
  });

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => setExporting(false), 3000);
  };

  return (
    <div className="h-full bg-background/30 p-8 overflow-auto scrollbar-none flex gap-8">
      <div className="flex-1 space-y-8 max-w-4xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Final Export</h2>
          <p className="text-muted-foreground mt-1">Render and download your cinematic universe.</p>
        </div>

        <div className="aspect-video rounded-xl bg-black border border-border/50 overflow-hidden relative shadow-2xl flex items-center justify-center group">
           <FileVideo className="w-16 h-16 text-muted-foreground/30" />
           <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent flex items-end p-6">
             <div className="w-full flex items-center justify-between">
               <div>
                 <div className="font-bold text-lg">{project.title} - Final Render</div>
                 <div className="text-sm text-primary flex items-center gap-2"><Sparkles className="w-4 h-4"/> 4K UHD • 24 FPS</div>
               </div>
               <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6">
                 <Play className="w-4 h-4" /> Play Master
               </Button>
             </div>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-card border border-border/50 rounded-xl p-6 space-y-6">
            <h3 className="font-bold text-lg flex items-center gap-2"><Settings className="w-5 h-5 text-primary" /> Render Settings</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution</label>
                <Select defaultValue="4k">
                  <SelectTrigger className="w-full bg-background border-border/50">
                    <SelectValue placeholder="Select Resolution" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1080p">1080p HD</SelectItem>
                    <SelectItem value="4k">4K UHD</SelectItem>
                    <SelectItem value="8k">8K Cinema</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Frame Rate</label>
                <Select defaultValue="24">
                  <SelectTrigger className="w-full bg-background border-border/50">
                    <SelectValue placeholder="Select FPS" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 FPS (Cinematic)</SelectItem>
                    <SelectItem value="30">30 FPS</SelectItem>
                    <SelectItem value="60">60 FPS (Smooth)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-xl p-6 space-y-6">
            <h3 className="font-bold text-lg flex items-center gap-2"><Download className="w-5 h-5 text-primary" /> Export Packages</h3>
            
            <div className="space-y-3">
              {Object.entries(format).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-3 bg-background/50 p-3 rounded-lg border border-border/50 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setFormat(prev => ({...prev, [key]: !value}))}>
                  <Checkbox id={key} checked={value} onCheckedChange={(checked) => setFormat(prev => ({...prev, [key]: !!checked}))} />
                  <label htmlFor={key} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 uppercase tracking-wider">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button size="lg" className="flex-1 gap-2 text-lg h-14" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            Generate Export Package
          </Button>
          <Button size="lg" variant="outline" className="flex-1 gap-2 text-lg h-14 border-primary/50 hover:bg-primary/10">
            <Share2 className="w-5 h-5" /> Publish & Share
          </Button>
        </div>
      </div>

      <div className="w-80 border-l border-border/50 pl-8 space-y-6">
        <h3 className="font-bold text-lg">Export History</h3>
        <div className="space-y-3">
          {[1, 2].map(i => (
             <div key={i} className="p-4 rounded-lg bg-card border border-border/50">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-sm font-bold text-primary">v{3-i}.0 Render</span>
                 <span className="text-xs text-muted-foreground">{i}d ago</span>
               </div>
               <div className="text-xs text-muted-foreground mb-3">4K • 24 FPS • MP4, SRT</div>
               <Button size="sm" variant="secondary" className="w-full gap-2 text-xs">
                 <Download className="w-3 h-3" /> Download
               </Button>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}
