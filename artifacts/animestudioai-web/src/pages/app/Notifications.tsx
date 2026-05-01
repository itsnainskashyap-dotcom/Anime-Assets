import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function Notifications() {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api("/api/notifications").then(res => res.json()).catch(() => []),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/api/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] })
  });

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">Updates from your studio sessions.</p>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold leading-none">{notifications.filter((n: any) => !n.read).length}</div>
            <div className="text-xs font-medium text-muted-foreground">Unread</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : notifications.length > 0 ? (
          notifications.map((n: any) => (
            <div key={n.id} className={`p-4 rounded-xl border transition-colors flex gap-4 ${n.read ? 'border-border/50 bg-card/50' : 'border-primary/50 bg-primary/5'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${n.read ? 'bg-secondary text-muted-foreground' : 'bg-primary text-primary-foreground'}`}>
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`font-bold ${n.read ? 'text-muted-foreground' : 'text-foreground'}`}>{n.title || "Studio Update"}</h4>
                  <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{n.message}</p>
                {!n.read && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markRead.mutate(n.id)} disabled={markRead.isPending}>
                    <Check className="w-3 h-3 mr-1" /> Mark Read
                  </Button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center p-12 bg-card border border-border border-dashed rounded-xl">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-medium mb-2">All caught up</h3>
            <p className="text-muted-foreground">You don't have any notifications right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}
