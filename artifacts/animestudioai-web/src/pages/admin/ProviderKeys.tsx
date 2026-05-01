import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, Plus, Trash2, Eye, EyeOff, CheckCircle2, XCircle, AlertTriangle, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export default function AdminProviderKeys() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newKeyData, setNewKeyData] = useState({ providerName: "", key: "", label: "" });
  const [isAdding, setIsAdding] = useState(false);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["provider-keys"],
    queryFn: () => api("/api/admin/provider-keys").then(res => res.json()),
  });

  const addKey = useMutation({
    mutationFn: (data: any) => api("/api/admin/provider-keys", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-keys"] });
      setNewKeyData({ providerName: "", key: "", label: "" });
      setIsAdding(false);
    }
  });

  const testKey = useMutation({
    mutationFn: (id: string) => api(`/api/admin/provider-keys/${id}/test`, { method: "POST" }).then(res => res.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-keys"] })
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, action }: { id: string, action: string }) => api(`/api/admin/provider-keys/${id}/${action}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-keys"] })
  });

  const handleAdd = () => {
    if (newKeyData.providerName && newKeyData.key) {
      addKey.mutate(newKeyData);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Provider Keys</h1>
          <p className="text-muted-foreground mt-1">Manage API keys for inference engines.</p>
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
                onChange={e => setNewKeyData(prev => ({...prev, providerName: e.target.value}))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Label (Optional)</label>
              <Input 
                placeholder="e.g. Primary Luma Key" 
                value={newKeyData.label}
                onChange={e => setNewKeyData(prev => ({...prev, label: e.target.value}))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">API Key</label>
              <Input 
                type="password"
                placeholder="sk-..." 
                value={newKeyData.key}
                onChange={e => setNewKeyData(prev => ({...prev, key: e.target.value}))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addKey.isPending || !newKeyData.providerName || !newKeyData.key}>
              {addKey.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Key
            </Button>
          </div>
        </div>
      )}

      <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground border-b border-border/50">
            <tr>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
            ) : keys.length > 0 ? (
              keys.map((key: any) => (
                <tr key={key.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium capitalize">{key.providerName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{key.label || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs flex items-center gap-2">
                    {showKeys[key.id] ? key.key : '••••••••••••••••'}
                    <button onClick={() => setShowKeys(p => ({...p, [key.id]: !p[key.id]}))} className="text-muted-foreground hover:text-foreground">
                      {showKeys[key.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {key.isActive ? (
                        <span className="flex items-center gap-1 text-green-500 text-xs font-medium"><CheckCircle2 className="w-3 h-3"/> Active</span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground text-xs font-medium"><XCircle className="w-3 h-3"/> Disabled</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => testKey.mutate(key.id)} disabled={testKey.isPending}>
                      <Play className="w-3 h-3 mr-1" /> Test
                    </Button>
                    <Button 
                      size="sm" 
                      variant={key.isActive ? "secondary" : "default"} 
                      className="h-7 text-xs"
                      onClick={() => toggleStatus.mutate({ id: key.id, action: key.isActive ? 'disable' : 'enable' })}
                    >
                      {key.isActive ? 'Disable' : 'Enable'}
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No provider keys configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
