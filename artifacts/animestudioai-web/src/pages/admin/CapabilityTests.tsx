import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

interface CapabilityTestRow {
  provider: string;
  capability: string;
  status: string;
  lastRun?: string;
}

export default function AdminCapabilityTests() {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const { data: tests = [], isLoading, error } = useQuery<CapabilityTestRow[]>({
    queryKey: ["capability-tests"],
    queryFn: () => api("/api/admin/provider-capability-tests").then(res => res.json() as Promise<CapabilityTestRow[]>).catch(() => [] as CapabilityTestRow[]),
  });

  const runTests = useMutation({
    mutationFn: () => api("/api/admin/provider-capability-tests/run", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["capability-tests"] })
  });

  if (error) return <div className="p-8 text-destructive">Failed to load: {(error as Error).message}</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Capability Tests</h1>
          <p className="text-muted-foreground mt-1">Run inference checks across providers to ensure quality.</p>
        </div>
        <Button onClick={() => runTests.mutate()} disabled={runTests.isPending} className="gap-2">
          {runTests.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run All Tests
        </Button>
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground border-b border-border/50">
            <tr>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Capability</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Run</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : tests.length > 0 ? (
              tests.map((test, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium capitalize">{test.provider}</td>
                  <td className="px-4 py-3 capitalize">{test.capability}</td>
                  <td className="px-4 py-3">
                    {test.status === 'passed' ? (
                      <span className="flex items-center gap-1 text-green-500 text-xs font-medium"><CheckCircle2 className="w-3 h-3"/> Passed</span>
                    ) : test.status === 'failed' ? (
                      <span className="flex items-center gap-1 text-destructive text-xs font-medium"><XCircle className="w-3 h-3"/> Failed</span>
                    ) : (
                      <span className="text-muted-foreground text-xs font-medium">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{test.lastRun ? new Date(test.lastRun).toLocaleString() : 'Never'}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No capability tests configured or found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
