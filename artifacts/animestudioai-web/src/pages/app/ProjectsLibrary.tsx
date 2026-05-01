import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Search, Filter, Plus, Film, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/hooks/use-projects";

export default function ProjectsLibrary() {
  const { data: projects = [], isLoading } = useProjects();
  const [search, setSearch] = useState("");

  const filteredProjects = projects.filter((p) => 
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto w-full h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects Library</h1>
          <p className="text-muted-foreground mt-1">Manage your cinematic universes.</p>
        </div>
        <Link href="/app/projects/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" /> New Project
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search projects..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-72 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProjects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/app/projects/${project.id}/story`}>
                  <div className="group block h-full rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_-10px_rgba(var(--primary),0.3)] cursor-pointer flex flex-col">
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {project.thumbnailUrl ? (
                        <img src={project.thumbnailUrl} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-secondary/50 group-hover:bg-secondary transition-colors">
                          <Film className="w-10 h-10 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button variant="secondary" size="icon" className="rounded-full w-12 h-12 bg-primary text-primary-foreground hover:bg-primary/90">
                          <Play className="w-5 h-5 ml-1" />
                        </Button>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="bg-background/80 backdrop-blur border-border font-medium">
                          {project.status || "Draft"}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-bold text-lg mb-2 line-clamp-1">{project.title}</h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <Badge variant="outline" className="text-xs bg-secondary/50 border-border/50">
                          {project.format}
                        </Badge>
                        {project.genres?.slice(0, 2).map((g: string) => (
                          <Badge key={g} variant="outline" className="text-xs bg-secondary/50 border-border/50">
                            {g}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> 
                          {new Date(project.updatedAt || project.createdAt).toLocaleDateString()}
                        </span>
                        <span className="font-medium text-foreground">{project.progress || 0}%</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-card rounded-xl border border-border border-dashed">
            <Film className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {search ? "No projects match your search criteria." : "You haven't created any projects yet."}
            </p>
            {search ? (
              <Button variant="outline" onClick={() => setSearch("")}>Clear Search</Button>
            ) : (
              <Link href="/app/projects/new">
                <Button className="gap-2"><Plus className="w-4 h-4" /> Create Project</Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
