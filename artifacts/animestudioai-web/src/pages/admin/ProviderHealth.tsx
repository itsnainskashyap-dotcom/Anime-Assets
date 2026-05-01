import { useQuery } from "@tanstack/react-query";
import { Server, Activity, CheckCircle2, XCircle, Loader2, RefreshCcw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export default function AdminProviderHealth() {
  const { api } = useAuth();
  const { data: health = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["provider-health"],
    queryFn: () => api("/api/admin/provider-health").then(res => res.json()).catch(() => []),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Provider Health</h1>
          <p className="text-muted-foreground mt-1">Real-time status of all external inference APIs.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCcw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-48 rounded-xl bg-card border border-border/50 animate-pulse" />)
        ) : health.length > 0 ? (
          health.map((provider: any) => (
            <div key={provider.name} className="bg-card border border-border/50 rounded-xl p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${provider.status === 'operational' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                    {provider.status === 'operational' ? <Server className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold capitalize">{provider.name}</h3>
                    <div className="text-xs text-muted-foreground">{provider.latency || 0}ms avg latency</div>
                  </div>
                </div>
                {provider.status === 'operational' ? (
                  <span className="flex items-center gap-1 text-green-500 text-xs font-medium"><CheckCircle2 className="w-3 h-3"/> OK</span>
                ) : (
                  <span className="flex items-center gap-1 text-destructive text-xs font-medium"><XCircle className="w-3 h-3"/> DOWN</span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Uptime (24h)</span>
                  <span className="font-medium">{provider.uptime || '100'}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Error Rate</span>
                  <span className="font-medium">{provider.errorRate || '0.00'}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active Connections</span>
                  <span className="font-medium">{provider.activeConnections || 0}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-muted-foreground border border-dashed border-border/50 rounded-xl">
            No provider health data available.
          </div>
        )}
      </div>
    </div>
  );
}
