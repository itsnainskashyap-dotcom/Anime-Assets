import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Users, Activity, CreditCard, ShieldAlert, 
  Server, Key, HardDrive, Database, BrainCircuit, Bug
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";

export default function AdminDashboard() {
  const { api } = useAuth();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api("/api/admin/dashboard").then(res => res.json()),
  });

  // Mock data for charts
  const chartData = [
    { name: 'Mon', jobs: 400, cost: 240 },
    { name: 'Tue', jobs: 300, cost: 139 },
    { name: 'Wed', jobs: 200, cost: 980 },
    { name: 'Thu', jobs: 278, cost: 390 },
    { name: 'Fri', jobs: 189, cost: 480 },
    { name: 'Sat', jobs: 239, cost: 380 },
    { name: 'Sun', jobs: 349, cost: 430 },
  ];

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
            <span className="text-sm font-medium text-green-500">+12%</span>
          </div>
          <div className="text-sm font-medium text-muted-foreground mb-1">Total Users</div>
          <div className="text-3xl font-bold">{dashboard?.users || "2,543"}</div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-sm font-medium text-green-500">+5%</span>
          </div>
          <div className="text-sm font-medium text-muted-foreground mb-1">Active Jobs</div>
          <div className="text-3xl font-bold">{dashboard?.activeJobs || "142"}</div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-sm font-medium text-green-500">+18%</span>
          </div>
          <div className="text-sm font-medium text-muted-foreground mb-1">Credits Spent (24h)</div>
          <div className="text-3xl font-bold">{dashboard?.creditsSpent || "45,200"}</div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-destructive" />
            </div>
            <span className="text-sm font-medium text-destructive">-2%</span>
          </div>
          <div className="text-sm font-medium text-muted-foreground mb-1">Failed Jobs (24h)</div>
          <div className="text-3xl font-bold">{dashboard?.failedJobs || "12"}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-2 bg-card border border-border/50 rounded-xl p-6">
          <h3 className="font-bold mb-6">Job Volume & Cost</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line type="monotone" dataKey="jobs" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cost" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6">
          <h3 className="font-bold mb-4">Quick Links</h3>
          <div className="grid grid-cols-2 gap-3">
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
    </div>
  );
}
