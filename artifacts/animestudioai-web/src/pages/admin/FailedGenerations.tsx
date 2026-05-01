import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, RefreshCcw, Loader2, Search, Filter } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminFailedGenerations() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: failures = [], isLoading } = useQuery({
    queryKey: ["admin-failed-generations"],
    queryFn: () => api("/api/admin/failed-generations").then(res => res.json()).catch(() => []),
  });

  const retryJob = useMutation({
    mutationFn: (id: string) => api(`/api/admin/jobs/${id}/retry`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-failed-generations"] })
  });

  const filteredFailures = failures.filter((f: any) => 
    f.id.toLowerCase().includes(search.toLowerCase()) || 
    (f.error && f.error.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-destructive flex items-center gap-2">
            <ShieldAlert className="w-8 h-8" /> Failed Generations
          </h1>
          <p className="text-muted-foreground mt-1">Review and retry failed pipeline jobs.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search errors or job IDs..." 
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
              <th className="px-4 py-3 font-medium">Job ID</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Error Message</th>
              <th className="px-4 py-3 font-medium">Failed At</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : filteredFailures.length > 0 ? (
              filteredFailures.map((job: any) => (
                <tr key={job.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{job.id.substring(0, 8)}...</td>
                  <td className="px-4 py-3 capitalize font-medium">{job.type}</td>
                  <td className="px-4 py-3 text-destructive font-mono text-xs max-w-md truncate" title={job.error}>
                    {job.error || "Unknown error"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(job.updatedAt || job.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => retryJob.mutate(job.id)} disabled={retryJob.isPending}>
                      <RefreshCcw className="w-3 h-3 mr-1" /> Retry
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No failed generations found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
