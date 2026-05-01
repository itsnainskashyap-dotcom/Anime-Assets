import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins, Loader2, Save } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PricingRow {
  operation: string;
  description: string;
  credits: number;
}

interface PricingUpdateInput {
  operation: string;
  credits: number;
}

export default function AdminPricingConfig() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Record<string, number>>({});

  const { data: pricing = [], isLoading, error } = useQuery<PricingRow[]>({
    queryKey: ["admin-pricing"],
    queryFn: () => api("/api/admin/pricing-config").then(res => res.json() as Promise<PricingRow[]>).catch(() => [] as PricingRow[]),
  });

  const updatePricing = useMutation<unknown, Error, PricingUpdateInput>({
    mutationFn: (data) => api("/api/admin/pricing-config", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pricing"] });
      setEditing({});
    }
  });

  if (error) return <div className="p-8 text-destructive">Failed to load: {(error as Error).message}</div>;

  const handleSave = (operation: string) => {
    if (editing[operation] !== undefined) {
      updatePricing.mutate({ operation, credits: editing[operation] });
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pricing Config</h1>
          <p className="text-muted-foreground mt-1">Set credit costs for platform operations.</p>
        </div>
      </div>

      <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground border-b border-border/50">
            <tr>
              <th className="px-4 py-3 font-medium">Operation</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Credits Cost</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : pricing.length > 0 ? (
              pricing.map((p) => (
                <tr key={p.operation} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{p.operation}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.description}</td>
                  <td className="px-4 py-3">
                    <Input 
                      type="number" 
                      value={editing[p.operation] !== undefined ? editing[p.operation] : p.credits}
                      onChange={(e) => setEditing(prev => ({...prev, [p.operation]: parseInt(e.target.value)}))}
                      className="w-24 h-8 text-xs bg-background"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-8 text-xs gap-1"
                      onClick={() => handleSave(p.operation)}
                      disabled={updatePricing.isPending || editing[p.operation] === undefined}
                    >
                      <Save className="w-3 h-3" /> Save
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No pricing configuration found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
