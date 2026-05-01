import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCcw, Pause, Play, XSquare, Loader2, Search, Filter } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function AdminJobs() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: () => api("/api/admin/jobs?limit=50").then(res => res.json()).catch(() => []),
  });

  const jobAction = useMutation({
    mutationFn: ({ id, action }: { id: string, action: string }) => api(`/api/admin/jobs/${id}/${action}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-jobs"] })
  });

  const filteredJobs = jobs.filter((j: any) => 
    j.id.toLowerCase().includes(search.toLowerCase()) || 
    (j.type && j.type.toLowerCase().includes(search.toLowerCase())) ||
    (j.status && j.status.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Queue</h1>
          <p className="text-muted-foreground mt-1">Monitor and control production jobs.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-jobs"] })}>
          <RefreshCcw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search jobs by ID or type..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground border-b border-border/50">
            <tr>
              <th className="px-4 py-3 font-medium">Job ID</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Progress</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : filteredJobs.length > 0 ? (
              filteredJobs.map((job: any) => (
                <tr key={job.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{job.id.substring(0, 8)}...</td>
                  <td className="px-4 py-3 capitalize font-medium">{job.type}</td>
                  <td className="px-4 py-3">
                    <Badge variant={job.status === 'completed' ? 'secondary' : job.status === 'failed' ? 'destructive' : job.status === 'processing' ? 'default' : 'outline'} className="capitalize">
                      {job.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${job.progress || 0}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(job.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right space-x-2 flex justify-end">
                    {job.status === 'failed' && (
                      <Button size="icon" variant="outline" className="h-7 w-7 text-primary hover:text-primary" onClick={() => jobAction.mutate({ id: job.id, action: 'retry' })}>
                        <RefreshCcw className="w-3 h-3" />
                      </Button>
                    )}
                    {job.status === 'processing' && (
                      <Button size="icon" variant="outline" className="h-7 w-7 text-amber-500 hover:text-amber-500" onClick={() => jobAction.mutate({ id: job.id, action: 'pause' })}>
                        <Pause className="w-3 h-3" />
                      </Button>
                    )}
                    {job.status === 'paused' && (
                      <Button size="icon" variant="outline" className="h-7 w-7 text-green-500 hover:text-green-500" onClick={() => jobAction.mutate({ id: job.id, action: 'resume' })}>
                        <Play className="w-3 h-3" />
                      </Button>
                    )}
                    {(job.status === 'processing' || job.status === 'pending' || job.status === 'paused') && (
                      <Button size="icon" variant="outline" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => jobAction.mutate({ id: job.id, action: 'cancel' })}>
                        <XSquare className="w-3 h-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No jobs found in queue.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
