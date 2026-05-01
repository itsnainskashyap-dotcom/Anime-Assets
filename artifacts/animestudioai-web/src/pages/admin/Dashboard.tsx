import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Users, Activity, CreditCard, ShieldAlert,
  Server, Key, HardDrive, Database, BrainCircuit, Bug
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface DashboardSummary {
  users?: number;
  activeJobs?: number;
  creditsSpent?: number;
  failedJobs?: number;
}

export default function AdminDashboard() {
  const { api } = useAuth();

  const { data: dashboard, isLoading, error } = useQuery<DashboardSummary>({
    queryKey: ["admin-dashboard"],
    queryFn: () => api("/api/admin/dashboard").then(res => res.json() as Promise<DashboardSummary>),
  });

  const adminLinks = [
    { title: "Users", href: "/admin/users", icon: Users },
    { title: "Jobs Queue", href: "/admin/jobs", icon: Activity },
    { title: "Provider Keys", href: "/admin/provider-keys", icon: Key },
    { title: "Provider Health", href: "/admin/provider-health", icon: Server },
    { title: "Failed Gens", href: "/admin/failed-generations", icon: ShieldAlert },
    { title: "Billing", href: "/admin/billing", icon: CreditCard },
    { title: "Storage", href: "/admin/storage", icon: HardDrive },
    { title: "Agents", href: "/admin/agents", icon: BrainCircuit },
    { title: "Memory", href: "/admin/memory", icon: Database },
    { title: "Errors", href: "/admin/errors", icon: Bug },
  ];

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-destructive">Failed to load: {(error as Error).message}</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Studio Operations</h1>
        <p className="text-muted-foreground mt-1">System overview and control center.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="text-sm font-medium text-muted-foreground mb-1">Total Users</div>
          <div className="text-3xl font-bold">{dashboard?.users ?? 0}</div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <div className="text-sm font-medium text-muted-foreground mb-1">Active Jobs</div>
          <div className="text-3xl font-bold">{dashboard?.activeJobs ?? 0}</div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <div className="text-sm font-medium text-muted-foreground mb-1">Credits Spent (24h)</div>
          <div className="text-3xl font-bold">{dashboard?.creditsSpent ?? 0}</div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-destructive" />
            </div>
          </div>
          <div className="text-sm font-medium text-muted-foreground mb-1">Failed Jobs (24h)</div>
          <div className="text-3xl font-bold">{dashboard?.failedJobs ?? 0}</div>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-6">
        <h3 className="font-bold mb-4">Quick Links</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {adminLinks.map(link => (
            <Link key={link.title} href={link.href}>
              <Button variant="outline" className="w-full justify-start h-auto py-3 px-3 flex flex-col items-start gap-2 border-border/50 bg-background/50 hover:bg-primary/5 hover:border-primary/50">
                <link.icon className="w-5 h-5 text-primary" />
                <span className="text-xs">{link.title}</span>
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
