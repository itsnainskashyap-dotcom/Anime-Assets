import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, Search, Loader2, Activity } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function AdminAgents() {
  const { api } = useAuth();
  const [search, setSearch] = useState("");

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["admin-agents"],
    queryFn: () => api("/api/admin/agent-runs").then(res => res.json()).catch(() => []),
  });

  const filteredRuns = runs.filter((r: any) => 
    r.agentName.toLowerCase().includes(search.toLowerCase()) || 
    r.projectId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Monitor</h1>
          <p className="text-muted-foreground mt-1">Track LLM agent executions and system decisions.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by agent name or project ID..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
      </div>

      <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground border-b border-border/50">
            <tr>
              <th className="px-4 py-3 font-medium">Run ID</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Project ID</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Started At</th>
              <th className="px-4 py-3 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : filteredRuns.length > 0 ? (
              filteredRuns.map((run: any) => (
                <tr key={run.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{run.id.substring(0, 8)}...</td>
                  <td className="px-4 py-3 font-medium flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-primary" /> {run.agentName}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{run.projectId}</td>
                  <td className="px-4 py-3">
                    <Badge variant={run.status === 'completed' ? 'secondary' : run.status === 'failed' ? 'destructive' : 'default'}>
                      {run.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(run.startedAt || run.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{run.durationSec ? `${run.durationSec}s` : '-'}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No agent runs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
