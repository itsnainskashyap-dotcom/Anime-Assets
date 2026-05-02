import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import {
  PiPlusDuotone,
  PiFolderOpenDuotone,
  PiClockDuotone,
  PiCoinsDuotone,
  PiFilmReelDuotone,
  PiMagicWandDuotone,
} from "react-icons/pi";
import { Button } from "@/components/ui/button";
import { AnimatedLoader } from "@/components/ui/animated-loader";
import { useAuth } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import dashboardHero from "@assets/generated_images/dashboard_hero.png";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useProjects();

  return (
    <div className="w-full">
      {/* Hero banner */}
      <div className="relative overflow-hidden border-b border-border/40">
        <motion.img
          src={dashboardHero}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.45 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <motion.div
          className="absolute -top-10 right-1/4 w-72 h-72 rounded-full bg-primary/20 blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative max-w-7xl mx-auto px-8 py-14 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold mb-4 border border-primary/30 backdrop-blur-sm">
              <PiFilmReelDuotone className="w-4 h-4" />
              Studio Dashboard
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="text-3xl md:text-5xl font-bold tracking-tight mb-2"
          >
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">{user?.displayName || "Creator"}</span>.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="text-muted-foreground text-base md:text-lg max-w-xl"
          >
            Ready to continue building your world?
          </motion.p>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto w-full">
        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 -mt-6 md:-mt-12 mb-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <Link href="/app/projects/new">
              <Button variant="outline" className="w-full h-32 border-dashed border-2 hover:border-primary/60 hover:bg-primary/5 flex flex-col gap-2 rounded-2xl bg-card/80 backdrop-blur group">
                <motion.div
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center"
                >
                  <PiPlusDuotone className="w-5 h-5 text-primary" />
                </motion.div>
                <span className="font-semibold text-base">New Project</span>
                <span className="text-xs text-muted-foreground">Start a new anime</span>
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.5 }}
            whileHover={{ y: -4 }}
            className="h-32 rounded-2xl bg-card/95 backdrop-blur border border-border p-6 flex flex-col justify-center hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-3 text-muted-foreground mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <PiFolderOpenDuotone className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-sm font-medium">Active Projects</span>
            </div>
            <div className="text-3xl font-bold tracking-tight">{projects.length}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36, duration: 0.5 }}
            whileHover={{ y: -4 }}
            className="h-32 rounded-2xl bg-card/95 backdrop-blur border border-border p-6 flex flex-col justify-center hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-3 text-muted-foreground mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <PiCoinsDuotone className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium">Available Credits</span>
            </div>
            <div className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              {user?.credits.toLocaleString() ?? 0}
            </div>
          </motion.div>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Recent Projects</h2>
          <Link href="/app/projects">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary group">
              View All <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <AnimatedLoader label="Loading your studio…" size="md" />
          </div>
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.slice(0, 6).map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                whileHover={{ y: -4 }}
              >
                <Link href={`/app/projects/${project.id}/story`}>
                  <div className="group block rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all cursor-pointer">
                    <div className="aspect-video bg-muted relative">
                      {project.thumbnailUrl ? (
                        <img src={project.thumbnailUrl} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary/40 to-primary/10 group-hover:from-secondary/60 group-hover:to-primary/20 transition-colors">
                          <PiFilmReelDuotone className="w-12 h-12 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-background/80 backdrop-blur text-xs font-medium px-2 py-1 rounded">
                        {project.status || "Draft"}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-1 truncate group-hover:text-primary transition-colors">{project.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><PiClockDuotone className="w-3.5 h-3.5" /> {new Date(project.createdAt).toLocaleDateString()}</span>
                        <span className="capitalize">{project.format}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center py-16 bg-card border border-border border-dashed rounded-2xl"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex w-16 h-16 rounded-2xl bg-primary/10 items-center justify-center mb-4"
            >
              <PiMagicWandDuotone className="w-8 h-8 text-primary" />
            </motion.div>
            <h3 className="text-lg font-bold mb-2">Your studio is empty.</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Direct your first cinematic short. The Director is standing by.</p>
            <Link href="/app/projects/new">
              <Button className="rounded-full gap-2">
                <PiPlusDuotone className="w-4 h-4" /> Create Project
              </Button>
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
