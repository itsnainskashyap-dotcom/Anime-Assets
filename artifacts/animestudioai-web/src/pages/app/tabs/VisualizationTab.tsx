import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Layers, Image as ImageIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function VisualizationTab({ project }: { project: any }) {
  const { api } = useAuth();
  
  // Using a mock chunk ID for demonstration if chunks are not fully populated
  const chunkId = "chunk-1"; 

  const { data: visPack, isLoading } = useQuery({
    queryKey: ["visualization", chunkId],
    queryFn: () => api(`/api/chunks/${chunkId}/visualization-pack`).then(res => res.json()).catch(() => null),
  });

  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Mock data if api fails
  const mockPack = visPack || {
    startFrame: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&q=80",
    endFrame: "https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?w=800&q=80",
    elements: [
      { id: 1, name: "Background", url: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=800&q=80" },
      { id: 2, name: "Character Plate", url: "https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=800&q=80" }
    ]
  };

  return (
    <div className="h-full bg-background/30 p-8 overflow-auto scrollbar-none">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Visualization Pack</h2>
            <p className="text-muted-foreground">Pre-rendered plates and depth maps for Scene 1 - Chunk 1</p>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20 font-medium text-sm">
            <Layers className="w-4 h-4" /> Ready for Rendering
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm">Keyframes</h3>
            <div className="grid grid-cols-2 gap-4">
              <div 
                className="aspect-video rounded-xl border border-border/50 bg-card overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedFrame(mockPack.startFrame)}
              >
                <img src={mockPack.startFrame} alt="Start" className="w-full h-full object-cover" />
                <div className="p-2 text-xs font-bold text-center bg-background/80 backdrop-blur border-t border-border/50">START FRAME</div>
              </div>
              <div 
                className="aspect-video rounded-xl border border-border/50 bg-card overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedFrame(mockPack.endFrame)}
              >
                <img src={mockPack.endFrame} alt="End" className="w-full h-full object-cover" />
                <div className="p-2 text-xs font-bold text-center bg-background/80 backdrop-blur border-t border-border/50">END FRAME</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm">Elements</h3>
            <div className="grid grid-cols-2 gap-4">
              {mockPack.elements.map((el: any) => (
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
            </div>
          </div>
        </div>

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
