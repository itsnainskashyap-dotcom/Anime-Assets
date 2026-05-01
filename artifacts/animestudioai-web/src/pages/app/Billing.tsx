import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreditCard, History, Zap, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { CreditPack, PaymentOrder, CreateOrderResponse } from "@/types/api";

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  prefill: { name: string; email: string };
  theme: { color: string };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", cb: (response: { error: { description: string; code?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export default function Billing() {
  const { user, api, token } = useAuth();
  const [loadingScript, setLoadingScript] = useState(false);

  useEffect(() => {
    if (!document.getElementById("razorpay-script")) {
      setLoadingScript(true);
      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => setLoadingScript(false);
      document.body.appendChild(script);
    }
  }, []);

  const { data: packs = [], isLoading: loadingPacks, error: packsError } = useQuery<CreditPack[]>({
    queryKey: ["credit-packs"],
    queryFn: () => api("/api/payments/credit-packs").then(res => res.json()),
  });

  const { data: history = [], isLoading: loadingHistory, error: historyError, refetch: refetchHistory } = useQuery<PaymentOrder[]>({
    queryKey: ["payment-history"],
    queryFn: () => api("/api/payments/history").then(res => res.json()),
  });

  const createOrder = useMutation({
    mutationFn: (packId: string): Promise<CreateOrderResponse> => api("/api/payments/create-order", {
      method: "POST",
      body: JSON.stringify({ packId })
    }).then(res => res.json())
  });

  const handlePurchase = async (packId: string) => {
    if (!window.Razorpay) {
      alert("Razorpay is not loaded yet. Please try again.");
      return;
    }

    try {
      const order = await createOrder.mutateAsync(packId);

      const options = {
        key: order.razorpayKeyId,
        amount: order.amount_paise,
        currency: order.currency,
        name: "AnimeStudioAI",
        description: "Credit Pack Purchase",
        order_id: order.orderId,
        handler: function() {
          setTimeout(() => {
            refetchHistory();
            window.location.reload();
          }, 2000);
        },
        prefill: {
          name: user?.displayName || "",
          email: user?.email || "",
        },
        theme: {
          color: "#9333ea" // primary color approx
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        console.error(response.error);
        alert("Payment failed: " + response.error.description);
      });
      rzp.open();
    } catch (err) {
      alert("Failed to initiate purchase: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Credits</h1>
          <p className="text-muted-foreground mt-1">Manage your studio compute balance.</p>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Available Compute</div>
            <div className="text-2xl font-bold">{user?.credits.toLocaleString() ?? 0} <span className="text-sm font-normal text-muted-foreground">CR</span></div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Add Credits</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loadingPacks ? (
            [1, 2, 3].map(i => <div key={i} className="h-64 rounded-xl bg-card border border-border/50 animate-pulse" />)
          ) : (
            packs.map((pack) => (
              <div key={pack.id} className="rounded-xl border border-border/50 bg-card p-6 flex flex-col relative overflow-hidden">
                {(pack.bonus_credits ?? 0) > 0 && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                    +{pack.bonus_credits} BONUS
                  </div>
                )}
                <h3 className="font-bold text-lg mb-2">{pack.name}</h3>
                <div className="text-3xl font-bold mb-4 flex items-end gap-2">
                  {(pack.price_paise / 100).toLocaleString('en-IN', { style: 'currency', currency: pack.currency })}
                </div>
                
                <div className="space-y-3 mb-6 flex-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary" />
                    <span>{pack.credits.toLocaleString()} Base Credits</span>
                  </div>
                  {(pack.bonus_credits ?? 0) > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary" />
                      <span>{pack.bonus_credits!.toLocaleString()} Bonus Credits</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary" />
                    <span>Never expires</span>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={() => handlePurchase(pack.id)}
                  disabled={loadingScript || createOrder.isPending}
                >
                  {createOrder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Purchase"}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Transaction History</h2>
        <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border/50">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loadingHistory ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : historyError ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-destructive">Failed to load history.</td></tr>
              ) : history.length > 0 ? (
                history.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">Credit Pack</td>
                    <td className="px-4 py-3 font-medium">{(tx.amount_paise / 100).toLocaleString('en-IN', { style: 'currency', currency: tx.currency })}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.status === 'paid' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No transactions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
