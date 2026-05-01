import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, ArrowRightLeft, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminOrder {
  id: string;
  userId: string;
  amount_paise: number;
  currency: string;
  createdAt: string;
}

interface AdminBillingResponse {
  revenue: number;
  orders: AdminOrder[];
}

interface RefundInput {
  userId: string;
  credits: string;
  reason: string;
}

export default function AdminBilling() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [refundData, setRefundData] = useState<RefundInput>({ userId: "", credits: "", reason: "" });

  const { data: billing = { revenue: 0, orders: [] }, isLoading, error } = useQuery<AdminBillingResponse>({
    queryKey: ["admin-billing"],
    queryFn: () => api("/api/admin/billing").then(res => res.json() as Promise<AdminBillingResponse>).catch(() => ({ revenue: 0, orders: [] })),
  });

  const issueRefund = useMutation<unknown, Error, RefundInput>({
    mutationFn: (data) => api("/api/admin/refund", {
      method: "POST",
      body: JSON.stringify({ ...data, credits: parseInt(data.credits) }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
      setRefundData({ userId: "", credits: "", reason: "" });
    }
  });

  if (error) return <div className="p-8 text-destructive">Failed to load: {(error as Error).message}</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Refunds</h1>
        <p className="text-muted-foreground mt-1">Manage platform revenue and user credit adjustments.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border/50 rounded-xl p-6 md:col-span-1">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" /> Issue Refund
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">User ID</label>
              <Input 
                value={refundData.userId}
                onChange={e => setRefundData(p => ({...p, userId: e.target.value}))}
                placeholder="usr_..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Credits to Add/Remove</label>
              <Input 
                type="number"
                value={refundData.credits}
                onChange={e => setRefundData(p => ({...p, credits: e.target.value}))}
                placeholder="e.g. 500 or -500"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Reason</label>
              <Input 
                value={refundData.reason}
                onChange={e => setRefundData(p => ({...p, reason: e.target.value}))}
                placeholder="Job failure reimbursement"
              />
            </div>
            <Button 
              className="w-full mt-2" 
              onClick={() => issueRefund.mutate(refundData)}
              disabled={issueRefund.isPending || !refundData.userId || !refundData.credits}
            >
              {issueRefund.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Process Adjustment
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl overflow-hidden md:col-span-2 flex flex-col">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-background/50">
            <h3 className="font-bold">Recent Orders</h3>
            <div className="text-sm font-medium">Total Revenue: <span className="text-primary font-bold">{(billing.revenue || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : billing.orders?.length > 0 ? (
                  billing.orders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs">{o.id}</td>
                      <td className="px-4 py-3">{o.userId}</td>
                      <td className="px-4 py-3 font-medium">{(o.amount_paise / 100).toLocaleString('en-IN', { style: 'currency', currency: o.currency })}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No recent orders.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
