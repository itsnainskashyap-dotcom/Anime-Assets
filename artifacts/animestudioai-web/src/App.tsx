import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/public/Landing";
import Login from "@/pages/public/Login";
import Signup from "@/pages/public/Signup";

import AppShell from "@/components/layout/AppShell";
import Dashboard from "@/pages/app/Dashboard";
import ProjectsLibrary from "@/pages/app/ProjectsLibrary";
import CreateProject from "@/pages/app/CreateProject";
import ProjectDetail from "@/pages/app/ProjectDetail";
import ChunkInspector from "@/pages/app/ChunkInspector";
import Billing from "@/pages/app/Billing";
import Settings from "@/pages/app/Settings";
import Notifications from "@/pages/app/Notifications";

import AdminDashboard from "@/pages/admin/Dashboard";
import AdminProviderKeys from "@/pages/admin/ProviderKeys";
import AdminJobs from "@/pages/admin/Jobs";
import AdminUsers from "@/pages/admin/Users";
import AdminProviderHealth from "@/pages/admin/ProviderHealth";
import AdminCapabilityTests from "@/pages/admin/CapabilityTests";
import AdminFailedGenerations from "@/pages/admin/FailedGenerations";
import AdminBilling from "@/pages/admin/Billing";
import AdminPricingConfig from "@/pages/admin/PricingConfig";
import AdminStorage from "@/pages/admin/Storage";
import AdminAgents from "@/pages/admin/Agents";
import AdminMemory from "@/pages/admin/Memory";
import AdminAuditLogs from "@/pages/admin/AuditLogs";
import AdminErrorLibrary from "@/pages/admin/ErrorLibrary";

const queryClient = new QueryClient();

type RouteProps = { component: React.ComponentType; adminOnly?: boolean };

function ProtectedRoute({ component: Component, adminOnly = false }: RouteProps) {
  const { user, isLoading, isFetching } = useAuth();

  if (isLoading || (adminOnly && isFetching)) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && !user.isAdmin) {
    return <Redirect to="/app" />;
  }

  return <Component />;
}

function AppRoute({ component: Component, adminOnly = false }: RouteProps) {
  return (
    <AppShell>
      <ProtectedRoute component={Component} adminOnly={adminOnly} />
    </AppShell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />

      <Route path="/app" component={() => <AppRoute component={Dashboard} />} />
      <Route path="/app/projects" component={() => <AppRoute component={ProjectsLibrary} />} />
      <Route path="/app/projects/new" component={() => <AppRoute component={CreateProject} />} />
      <Route path="/app/projects/:id/chunks/:chunkId" component={() => <AppRoute component={ChunkInspector} />} />
      <Route path="/app/projects/:id" component={() => <AppRoute component={ProjectDetail} />} />
      <Route path="/app/projects/:id/:tab" component={() => <AppRoute component={ProjectDetail} />} />
      <Route path="/app/billing" component={() => <AppRoute component={Billing} />} />
      <Route path="/app/settings" component={() => <AppRoute component={Settings} />} />
      <Route path="/app/notifications" component={() => <AppRoute component={Notifications} />} />

      <Route path="/admin" component={() => <AppRoute component={AdminDashboard} adminOnly />} />
      <Route path="/admin/provider-keys" component={() => <AppRoute component={AdminProviderKeys} adminOnly />} />
      <Route path="/admin/provider-health" component={() => <AppRoute component={AdminProviderHealth} adminOnly />} />
      <Route path="/admin/capability-tests" component={() => <AppRoute component={AdminCapabilityTests} adminOnly />} />
      <Route path="/admin/jobs" component={() => <AppRoute component={AdminJobs} adminOnly />} />
      <Route path="/admin/users" component={() => <AppRoute component={AdminUsers} adminOnly />} />
      <Route path="/admin/failed-generations" component={() => <AppRoute component={AdminFailedGenerations} adminOnly />} />
      <Route path="/admin/billing" component={() => <AppRoute component={AdminBilling} adminOnly />} />
      <Route path="/admin/pricing" component={() => <AppRoute component={AdminPricingConfig} adminOnly />} />
      <Route path="/admin/storage" component={() => <AppRoute component={AdminStorage} adminOnly />} />
      <Route path="/admin/agents" component={() => <AppRoute component={AdminAgents} adminOnly />} />
      <Route path="/admin/memory" component={() => <AppRoute component={AdminMemory} adminOnly />} />
      <Route path="/admin/audit" component={() => <AppRoute component={AdminAuditLogs} adminOnly />} />
      <Route path="/admin/errors" component={() => <AppRoute component={AdminErrorLibrary} adminOnly />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
