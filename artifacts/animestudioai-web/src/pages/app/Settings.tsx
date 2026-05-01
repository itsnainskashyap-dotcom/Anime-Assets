import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, CheckCircle2 } from "lucide-react";

export default function Settings() {
  const { user, api, logout } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [success, setSuccess] = useState(false);

  const updateProfile = useMutation({
    mutationFn: (data: { displayName?: string }) =>
      api("/api/auth/me", { method: "PATCH", body: JSON.stringify(data) }).then(res => res.json()),
    onSuccess: (data) => {
      queryClient.setQueryData(["user"], data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  });

  const handleSave = () => {
    updateProfile.mutate({ displayName });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your creator profile and preferences.</p>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-6 space-y-6">
        <h3 className="font-bold text-lg">Profile Information</h3>
        
        <div className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email || ""} disabled className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">Email cannot be changed directly. Contact support.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input 
              id="displayName" 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)} 
              className="bg-background"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-4 border-t border-border/50">
          <Button onClick={handleSave} disabled={updateProfile.isPending || displayName === user?.displayName}>
            {updateProfile.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Changes
          </Button>
          {success && <span className="text-sm text-green-500 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Saved successfully</span>}
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-6 space-y-6">
        <h3 className="font-bold text-lg">Plan & Billing</h3>
        <div className="p-4 border border-border/50 bg-background/50 rounded-lg flex items-center justify-between">
          <div>
            <div className="font-semibold mb-1">Current Balance</div>
            <div className="text-2xl font-bold text-primary">{user?.credits?.toLocaleString() ?? 0} <span className="text-sm font-normal text-muted-foreground">Credits</span></div>
          </div>
          <Button variant="outline" onClick={() => window.location.href = '/app/billing'}>Add Credits</Button>
        </div>
      </div>

      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-6 space-y-4">
        <h3 className="font-bold text-lg text-destructive">Danger Zone</h3>
        <p className="text-sm text-muted-foreground">Log out of your account or permanently delete it.</p>
        <div className="flex gap-4">
          <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => logout()}>
            <LogOut className="w-4 h-4 mr-2" /> Log Out
          </Button>
        </div>
      </div>
    </div>
  );
}
