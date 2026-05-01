import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface MemoryConflictRow {
  projectId: string;
  key: string;
  type?: string;
  resolution?: string;
  timestamp?: string;
}

export default function AdminMemory() {
  const { api } = useAuth();
  const [search, setSearch] = useState("");

  const { data: conflicts = [], isLoading, error } = useQuery<MemoryConflictRow[]>({
    queryKey: ["admin-memory"],
    queryFn: () => api("/api/admin/memory-conflicts").then(res => res.json() as Promise<MemoryConflictRow[]>).catch(() => [] as MemoryConflictRow[]),
  });

  const filteredConflicts = conflicts.filter((c) =>
    c.projectId.toLowerCase().includes(search.toLowerCase()) ||
    c.key.toLowerCase().includes(search.toLowerCase())
  );

  if (error) return <div className="p-8 text-destructive">Failed to load: {(error as Error).message}</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Memory Inspector</h1>
          <p className="text-muted-foreground mt-1">Review memory conflicts and state resolution across active runs.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by project ID or key..." 
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
              <th className="px-4 py-3 font-medium">Project ID</th>
              <th className="px-4 py-3 font-medium">Memory Key</th>
              <th className="px-4 py-3 font-medium">Conflict Type</th>
              <th className="px-4 py-3 font-medium">Resolution</th>
              <th className="px-4 py-3 font-medium">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : filteredConflicts.length > 0 ? (
              filteredConflicts.map((c, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{c.projectId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">{c.key}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
                      {c.type || 'State Divergence'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.resolution || 'Auto-merged (Latest wins)'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(c.timestamp || Date.now()).toLocaleString()}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No memory conflicts detected.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
