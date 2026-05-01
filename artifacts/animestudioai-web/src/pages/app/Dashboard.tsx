import { Link } from "wouter";
import { motion } from "framer-motion";
import { Plus, FolderKanban, Play, Clock, Sparkles, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useProjects();

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back, {user?.displayName || "Creator"}.</h1>
        <p className="text-muted-foreground">Ready to continue building your world?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <Link href="/app/projects/new">
          <Button variant="outline" className="w-full h-32 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 flex flex-col gap-2 rounded-xl">
            <Plus className="w-6 h-6 text-primary" />
            <span className="font-medium text-lg">New Project</span>
          </Button>
        </Link>
        <div className="h-32 rounded-xl bg-card border border-border p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <FolderKanban className="w-5 h-5 text-primary" />
            <span className="font-medium">Active Projects</span>
          </div>
          <div className="text-3xl font-bold">{projects.length}</div>
        </div>
        <div className="h-32 rounded-xl bg-card border border-border p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-medium">Available Credits</span>
          </div>
          <div className="text-3xl font-bold">{user?.credits.toLocaleString() ?? 0}</div>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Recent Projects</h2>
        <Link href="/app/projects">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
            View All
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.slice(0, 3).map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link href={`/app/projects/${project.id}/story`}>
                <div className="group block rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors cursor-pointer">
                  <div className="aspect-video bg-muted relative">
                    {project.thumbnailUrl ? (
                      <img src={project.thumbnailUrl} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/50 group-hover:bg-secondary transition-colors">
                        <Film className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-background/80 backdrop-blur text-xs font-medium px-2 py-1 rounded">
                      {project.status || "Draft"}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-1 truncate">{project.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(project.createdAt).toLocaleDateString()}</span>
                      <span className="capitalize">{project.format}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-card border border-border border-dashed rounded-xl">
          <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-medium mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-6">Start your first cinematic production.</p>
          <Link href="/app/projects/new">
            <Button>Create Project</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
