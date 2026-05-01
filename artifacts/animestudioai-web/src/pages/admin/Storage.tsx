import { useQuery } from "@tanstack/react-query";
import { HardDrive, Loader2, Database, FileVideo, Image as ImageIcon, FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";

export default function AdminStorage() {
  const { api } = useAuth();

  const { data: storage = {
    totalSpaceGB: 1000,
    usedSpaceGB: 450,
    byType: {
      video: 300,
      images: 100,
      audio: 40,
      text: 10
    }
  }, isLoading } = useQuery({
    queryKey: ["admin-storage"],
    queryFn: () => api("/api/admin/storage").then(res => res.json()).catch(() => null),
  });

  const percentage = (storage.usedSpaceGB / storage.totalSpaceGB) * 100;

  return (
    <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Storage Monitor</h1>
          <p className="text-muted-foreground mt-1">Manage asset storage across the platform.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border/50 rounded-xl p-6 lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Total Usage</h3>
              <div className="text-sm text-muted-foreground">{storage.usedSpaceGB} GB / {storage.totalSpaceGB} GB</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Capacity</span>
              <span>{percentage.toFixed(1)}% Full</span>
            </div>
            <Progress value={percentage} className="h-3" />
          </div>

          <div className="pt-6 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground text-xs"><FileVideo className="w-3 h-3" /> Video</div>
              <div className="font-semibold">{storage.byType?.video || 0} GB</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground text-xs"><ImageIcon className="w-3 h-3" /> Images</div>
              <div className="font-semibold">{storage.byType?.images || 0} GB</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground text-xs"><Database className="w-3 h-3" /> Audio</div>
              <div className="font-semibold">{storage.byType?.audio || 0} GB</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground text-xs"><FileText className="w-3 h-3" /> Text/JSON</div>
              <div className="font-semibold">{storage.byType?.text || 0} GB</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
          <h3 className="font-bold">Storage Policies</h3>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center pb-4 border-b border-border/50">
              <div>
                <div className="font-medium">Raw Chunks</div>
                <div className="text-xs text-muted-foreground">Retention</div>
              </div>
              <span className="bg-secondary px-2 py-1 rounded">30 Days</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-border/50">
              <div>
                <div className="font-medium">Final Exports</div>
                <div className="text-xs text-muted-foreground">Retention</div>
              </div>
              <span className="bg-secondary px-2 py-1 rounded">Permanent</span>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Temp Audio</div>
                <div className="text-xs text-muted-foreground">Retention</div>
              </div>
              <span className="bg-secondary px-2 py-1 rounded">7 Days</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
