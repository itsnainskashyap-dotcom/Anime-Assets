import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  PiHouseDuotone,
  PiFolderOpenDuotone,
  PiCreditCardDuotone,
  PiGearSixDuotone,
  PiBellDuotone,
  PiSignOutDuotone,
  PiPlusDuotone,
  PiUsersThreeDuotone,
  PiPulseDuotone,
  PiShieldWarningDuotone,
  PiMonitorPlayDuotone,
} from "react-icons/pi";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoMark from "@assets/generated_images/logo_mark.png";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [demoMode, setDemoMode] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    fetch(import.meta.env.BASE_URL + "api/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d.demoMode === "boolean") setDemoMode(d.demoMode);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const mainNav = [
    { name: "Dashboard", href: "/app", icon: PiHouseDuotone },
    { name: "Projects", href: "/app/projects", icon: PiFolderOpenDuotone },
    { name: "Billing", href: "/app/billing", icon: PiCreditCardDuotone },
  ];

  const adminNav = [
    { name: "Overview", href: "/admin", icon: PiPulseDuotone },
    { name: "Users", href: "/admin/users", icon: PiUsersThreeDuotone },
    { name: "Jobs", href: "/admin/jobs", icon: PiMonitorPlayDuotone },
    { name: "Failures", href: "/admin/failed-generations", icon: PiShieldWarningDuotone },
  ];

  const bottomNav = [
    { name: "Notifications", href: "/app/notifications", icon: PiBellDuotone },
    { name: "Settings", href: "/app/settings", icon: PiGearSixDuotone },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border relative">
      <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-sidebar-border h-16`}>
        <Link href="/app">
          <div className="flex items-center gap-2.5 overflow-hidden cursor-pointer group">
            <motion.img
              src={logoMark}
              alt="AnimeStudioAI"
              className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
              whileHover={{ rotate: -8, scale: 1.08 }}
              transition={{ type: "spring", stiffness: 300 }}
            />
            {!isCollapsed && (
              <span className="font-bold text-base tracking-tight truncate">
                Anime<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">StudioAI</span>
              </span>
            )}
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-6 scrollbar-none">
        <div className="px-3 space-y-1">
          <Link href="/app/projects/new">
            <Button className={`w-full justify-start ${isCollapsed ? 'px-0 justify-center' : 'gap-2'}`}>
              <PiPlusDuotone className="w-4 h-4" />
              {!isCollapsed && <span>New Project</span>}
            </Button>
          </Link>
        </div>

        <div className="px-3">
          {!isCollapsed && <div className="text-xs font-semibold text-sidebar-foreground/50 mb-2 px-3 uppercase tracking-wider">Menu</div>}
          <div className="space-y-1">
            {mainNav.map((item, i) => {
              const isActive = location === item.href;
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.3 }}
                >
                  <Link href={item.href}>
                    <Button
                      variant="ghost"
                      className={`relative w-full justify-start ${isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"} ${isCollapsed ? 'px-0 justify-center' : 'gap-3'}`}
                      title={isCollapsed ? item.name : undefined}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="active-nav-pill"
                          className="absolute inset-0 bg-sidebar-accent rounded-md"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                      <item.icon className="w-4 h-4 relative z-10" />
                      {!isCollapsed && <span className="relative z-10">{item.name}</span>}
                    </Button>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        {user?.isAdmin && (
          <div className="px-3">
            {!isCollapsed && <div className="text-xs font-semibold text-sidebar-foreground/50 mb-2 px-3 uppercase tracking-wider">Admin</div>}
            <div className="space-y-1">
              {adminNav.map((item, i) => {
                const isActive = (location.startsWith(item.href) && item.href !== '/admin') || (location === '/admin' && item.href === '/admin');
                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * (mainNav.length + i), duration: 0.3 }}
                  >
                    <Link href={item.href}>
                      <Button
                        variant="ghost"
                        className={`relative w-full justify-start ${isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"} ${isCollapsed ? 'px-0 justify-center' : 'gap-3'}`}
                        title={isCollapsed ? item.name : undefined}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="active-nav-pill"
                            className="absolute inset-0 bg-sidebar-accent rounded-md"
                            transition={{ type: "spring", stiffness: 400, damping: 32 }}
                          />
                        )}
                        <item.icon className="w-4 h-4 relative z-10" />
                        {!isCollapsed && <span className="relative z-10">{item.name}</span>}
                      </Button>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        {bottomNav.map((item) => (
          <Link key={item.name} href={item.href}>
            <Button 
              variant="ghost" 
              className={`w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 ${isCollapsed ? 'px-0 justify-center' : 'gap-3'}`}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className="w-4 h-4" />
              {!isCollapsed && <span>{item.name}</span>}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/30">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:block transition-all duration-300 ease-in-out relative z-20 ${isCollapsed ? 'w-[72px]' : 'w-64'}`}>
        <SidebarContent />
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-border rounded-full flex items-center justify-center text-foreground hover:text-primary transition-colors border border-background shadow-sm"
        >
          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile Sidebar overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="fixed inset-y-0 left-0 w-64 z-50 md:hidden"
            >
              <SidebarContent />
              <button 
                onClick={() => setIsMobileOpen(false)}
                className="absolute top-4 -right-12 w-10 h-10 flex items-center justify-center text-foreground hover:text-primary"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border/50 bg-background/95 backdrop-blur flex items-center justify-between px-4 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden text-foreground hover:text-primary"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            {demoMode && (
              <div
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                title="Demo Mode is on — generations return placeholder assets and no provider calls are made."
                data-testid="badge-demo-mode"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-semibold tracking-wide uppercase">Demo Mode</span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-full border border-border">
              <PiCreditCardDuotone className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{user?.credits.toLocaleString() ?? 0}</span>
              <span className="text-xs text-muted-foreground ml-1">Credits</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8 border border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user?.displayName?.charAt(0).toUpperCase() || user?.email.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.displayName || "Creator"}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="sm:hidden p-2">
                  <div className="flex items-center gap-2 bg-secondary px-3 py-2 rounded-md border border-border">
                    <PiCreditCardDuotone className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{user?.credits.toLocaleString() ?? 0} credits</span>
                  </div>
                </div>
                <DropdownMenuSeparator className="sm:hidden" />
                <DropdownMenuItem asChild>
                  <Link href="/app/settings" className="cursor-pointer w-full flex items-center">
                    <PiGearSixDuotone className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => logout()}>
                  <PiSignOutDuotone className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background relative z-0">
          {children}
        </main>
      </div>
    </div>
  );
}
