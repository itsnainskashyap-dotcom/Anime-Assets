import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useProject } from "@/hooks/use-projects";
import { Link } from "wouter";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import PlaygroundTab from "./tabs/PlaygroundTab";

export default function ProjectDetail() {
  const params = useParams<{ id: string; tab?: string }>();
  const id = params.id ?? "";
  const tab = params.tab;
  const { data: project, isLoading } = useProject(id);
  const [, setLocation] = useLocation();

  // UNIFIED PLAYGROUND: every legacy tab URL (story, characters, storyboard,
  // visualization, production, song, export, environments) now redirects to
  // the single Playground view, which shows every stage of the pipeline in
  // real time. This removes the "tab hopping" the user complained about and
  // lets the auto-chained pipeline drive itself end-to-end.
  useEffect(() => {
    if (!id) return;
    if (tab && tab !== "playground") {
      setLocation(`/app/projects/${id}`, { replace: true });
    }
  }, [id, tab, setLocation]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold mb-2">Project not found</h2>
        <Button onClick={() => setLocation("/app/projects")}>Back to Projects</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border/50 bg-card/50 flex items-center px-4 shrink-0">
        <Link href="/app/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="ml-3 min-w-0">
          <h1 className="font-bold truncate text-sm sm:text-base">{project.title}</h1>
          <div className="text-[10px] sm:text-xs text-muted-foreground capitalize flex items-center gap-2">
            {project.format} • {project.status || "Draft"}
            {project.progress !== undefined && ` • ${project.progress}%`}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        <PlaygroundTab project={project} />
      </div>
    </div>
  );
}
