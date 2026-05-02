import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Users, Activity, CreditCard, ShieldAlert,
  Server, Key, HardDrive, Database, BrainCircuit, Bug, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedLoader } from "@/components/ui/animated-loader";
import { PageHeader } from "@/components/ui/page-header";
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

  const stats = [
    { key: "users", title: "Total Users", value: dashboard?.users ?? 0, icon: Users, color: "text-primary", bg: "bg-primary/10", pulse: false },
    { key: "active", title: "Active Jobs", value: dashboard?.activeJobs ?? 0, icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10", pulse: (dashboard?.activeJobs ?? 0) > 0 },
    { key: "credits", title: "Credits Spent (24h)", value: dashboard?.creditsSpent ?? 0, icon: CreditCard, color: "text-amber-400", bg: "bg-amber-500/10", pulse: false },
    { key: "failed", title: "Failed Jobs (24h)", value: dashboard?.failedJobs ?? 0, icon: ShieldAlert, color: "text-destructive", bg: "bg-destructive/10", pulse: (dashboard?.failedJobs ?? 0) > 0 },
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

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <AnimatedLoader label="Loading studio operations…" size="lg" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Studio Operations"
        description="System overview and control center for the entire studio."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
            whileHover={{ y: -4 }}
            className="bg-card border border-border/60 rounded-2xl p-6 hover:border-primary/40 transition-colors group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`relative w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
                {s.pulse && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className={`absolute inline-flex h-full w-full rounded-full ${s.color} opacity-75 animate-ping`} />
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${s.color.replace("text-", "bg-")}`} />
                  </span>
                )}
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <div className="text-sm font-medium text-muted-foreground mb-1">{s.title}</div>
            <div className="text-3xl font-bold tracking-tight">{s.value.toLocaleString()}</div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="bg-card border border-border/60 rounded-2xl p-6"
      >
        <h3 className="font-bold text-lg mb-4 tracking-tight">Quick Links</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {adminLinks.map((link, i) => (
            <motion.div
              key={link.title}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.32 + i * 0.04, duration: 0.3 }}
              whileHover={{ y: -3 }}
            >
              <Link href={link.href}>
                <Button variant="outline" className="w-full justify-start h-auto py-4 px-4 flex flex-col items-start gap-2 border-border/60 bg-background/50 hover:bg-primary/5 hover:border-primary/50 group">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <link.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{link.title}</span>
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
