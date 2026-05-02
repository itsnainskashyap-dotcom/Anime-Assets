import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Eye, EyeOff, CheckCircle2, XCircle, Loader2, Play, ArrowUp, ArrowDown, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

interface ProviderKey {
  id: string;
  providerName: string;
  label: string | null;
  key?: string;
  maskedKey?: string;
  isActive?: boolean;
  enabled?: boolean;
  priority: number;
  status?: string | null;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  errorCount?: number;
}

export default function AdminProviderKeys() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newKeyData, setNewKeyData] = useState({ providerName: "", key: "", label: "" });
  const [isAdding, setIsAdding] = useState(false);

  const { data: keys = [], isLoading } = useQuery<ProviderKey[]>({
    queryKey: ["provider-keys"],
    queryFn: () => api("/api/admin/provider-keys").then((res) => res.json()),
  });

  // Group by provider so the user can see fallback order at a glance.
  const grouped = useMemo(() => {
    const map = new Map<string, ProviderKey[]>();
    for (const k of keys) {
      const arr = map.get(k.providerName) || [];
      arr.push(k);
      map.set(k.providerName, arr);
    }
    // Higher priority first within a provider.
    for (const arr of map.values()) {
      arr.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [keys]);

  const addKey = useMutation({
    mutationFn: (data: typeof newKeyData) =>
      api("/api/admin/provider-keys", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-keys"] });
      setNewKeyData({ providerName: "", key: "", label: "" });
      setIsAdding(false);
    },
  });

  const testKey = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/provider-keys/${id}/test`, { method: "POST" }).then((res) => res.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-keys"] }),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api(`/api/admin/provider-keys/${id}/${action}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-keys"] }),
  });

  // V17 §17.1 — multi-key fallback order. Higher priority is tried first.
  // To avoid a race where the second call lands first (resulting in two keys
  // sharing the same priority and breaking fallback order), we run the two
  // updates *sequentially* inside one mutation. If either fails the cache is
  // invalidated and the next render shows actual server state.
  const swapPriorities = useMutation<
    void,
    Error,
    { aId: string; aPriority: number; bId: string; bPriority: number }
  >({
    mutationFn: async ({ aId, aPriority, bId, bPriority }) => {
      // First: bump the lower-priority key into a temporary slot so we never
      // have two rows sharing the same priority while waiting on the second
      // request. Use Math.max(...)+1 so we never collide with another key.
      const tempPriority = Math.max(...keys.map((k) => k.priority ?? 0)) + 1;
      await api(`/api/admin/provider-keys/${aId}/set-priority`, {
        method: "POST",
        body: JSON.stringify({ priority: tempPriority }),
      });
      await api(`/api/admin/provider-keys/${bId}/set-priority`, {
        method: "POST",
        body: JSON.stringify({ priority: aPriority }),
      });
      await api(`/api/admin/provider-keys/${aId}/set-priority`, {
        method: "POST",
        body: JSON.stringify({ priority: bPriority }),
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["provider-keys"] }),
  });

  const isEnabled = (k: ProviderKey): boolean => k.isActive ?? k.enabled ?? false;

  // Reorder helper: swap priority numbers with the neighbor in the same
  // provider group so the visual order matches the fallback order.
  const moveKey = (provider: string, idx: number, dir: -1 | 1): void => {
    const grp = grouped.find(([p]) => p === provider)?.[1];
    if (!grp) return;
    const target = idx + dir;
    if (target < 0 || target >= grp.length) return;
    const a = grp[idx];
    const b = grp[target];
    swapPriorities.mutate({
      aId: a.id,
      aPriority: a.priority ?? 0,
      bId: b.id,
      bPriority: b.priority ?? 0,
    });
  };

  const handleAdd = (): void => {
    if (newKeyData.providerName && newKeyData.key) {
      addKey.mutate(newKeyData);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Provider Keys</h1>
          <p className="text-muted-foreground mt-1">
            Manage API keys for inference engines. Higher-priority keys are tried first;
            on hard failure the orchestrator falls back down the list automatically.
          </p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Key
        </Button>
      </div>

      {isAdding && (
        <div className="p-6 rounded-xl border border-border/50 bg-card/50 space-y-4">
          <h3 className="font-bold text-lg">Add New Key</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Provider Name</label>
              <Input
                placeholder="e.g. openai, anthropic, fal"
                value={newKeyData.providerName}
                onChange={(e) => setNewKeyData((prev) => ({ ...prev, providerName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Label (Optional)</label>
              <Input
                placeholder="e.g. Primary Luma Key"
                value={newKeyData.label}
                onChange={(e) => setNewKeyData((prev) => ({ ...prev, label: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">API Key</label>
              <Input
                type="password"
                placeholder="sk-..."
                value={newKeyData.key}
                onChange={(e) => setNewKeyData((prev) => ({ ...prev, key: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button
              onClick={handleAdd}
              disabled={addKey.isPending || !newKeyData.providerName || !newKeyData.key}
            >
              {addKey.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Key
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border border-dashed border-border/40 rounded-xl">
          No provider keys configured.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([provider, items]) => (
            <div
              key={provider}
              className="border border-border/50 rounded-xl overflow-hidden bg-card"
            >
              <div className="px-4 py-3 bg-muted/30 border-b border-border/50 flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary/70" />
                <h3 className="font-bold capitalize">{provider}</h3>
                <span className="text-xs text-muted-foreground ml-2">
                  {items.length} key{items.length === 1 ? "" : "s"} · fallback order top→bottom
                </span>
              </div>
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/20 text-muted-foreground border-b border-border/40">
                  <tr>
                    <th className="px-4 py-2 font-medium w-20">Priority</th>
                    <th className="px-4 py-2 font-medium">Label</th>
                    <th className="px-4 py-2 font-medium">Key</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {items.map((key, idx) => (
                    <tr key={key.id} className="hover:bg-muted/10">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-sm w-6 text-center">
                            {idx + 1}
                          </span>
                          <div className="flex flex-col gap-0.5">
                            <button
                              className="h-5 w-5 rounded hover:bg-card disabled:opacity-30 flex items-center justify-center text-muted-foreground hover:text-foreground"
                              disabled={idx === 0 || swapPriorities.isPending}
                              onClick={() => moveKey(provider, idx, -1)}
                              title="Promote (try this key earlier)"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              className="h-5 w-5 rounded hover:bg-card disabled:opacity-30 flex items-center justify-center text-muted-foreground hover:text-foreground"
                              disabled={idx === items.length - 1 || swapPriorities.isPending}
                              onClick={() => moveKey(provider, idx, 1)}
                              title="Demote (try this key later)"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-[10px] text-muted-foreground ml-1">
                            p{key.priority ?? 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{key.label || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span>{showKeys[key.id] ? (key.key ?? key.maskedKey ?? "—") : (key.maskedKey ?? "••••••••••••")}</span>
                          {key.key && (
                            <button
                              onClick={() => setShowKeys((p) => ({ ...p, [key.id]: !p[key.id] }))}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {showKeys[key.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isEnabled(key) ? (
                          <span className="flex items-center gap-1 text-green-500 text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground text-xs font-medium">
                            <XCircle className="w-3 h-3" /> Disabled
                          </span>
                        )}
                        {key.errorCount && key.errorCount > 0 ? (
                          <div className="text-[10px] text-amber-400 mt-0.5">
                            {key.errorCount} error{key.errorCount === 1 ? "" : "s"}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => testKey.mutate(key.id)}
                          disabled={testKey.isPending}
                        >
                          <Play className="w-3 h-3 mr-1" /> Test
                        </Button>
                        <Button
                          size="sm"
                          variant={isEnabled(key) ? "secondary" : "default"}
                          className="h-7 text-xs"
                          onClick={() =>
                            toggleStatus.mutate({ id: key.id, action: isEnabled(key) ? "disable" : "enable" })
                          }
                        >
                          {isEnabled(key) ? "Disable" : "Enable"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
