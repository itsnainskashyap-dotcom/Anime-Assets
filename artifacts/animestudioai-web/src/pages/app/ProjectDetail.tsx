import { useLocation } from "wouter";
import { useProject } from "@/hooks/use-projects";
import { Link } from "wouter";
import { 
  BookOpen, Users, Mountain, LayoutTemplate, 
  Layers, Activity, Film, Music, Download,
  ChevronLeft, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";

import StoryBibleTab from "./tabs/StoryBibleTab";
import CharacterStudioTab from "./tabs/CharacterStudioTab";
import StoryboardTab from "./tabs/StoryboardTab";
import ProductionTab from "./tabs/ProductionTab";
import PlaygroundTab from "./tabs/PlaygroundTab";
import VisualizationTab from "./tabs/VisualizationTab";
import EnvironmentsTab from "./tabs/EnvironmentsTab";
import ExportTab from "./tabs/ExportTab";
import SongTab from "./tabs/SongTab";

const TABS = [
  { id: "story", label: "Story Bible", icon: BookOpen },
  { id: "characters", label: "Characters", icon: Users },
  { id: "environments", label: "Environments", icon: Mountain },
  { id: "storyboard", label: "Storyboard", icon: LayoutTemplate },
  { id: "visualization", label: "Visualization", icon: Layers },
  { id: "playground", label: "Playground", icon: Activity },
  { id: "production", label: "Production", icon: Film },
  { id: "song", label: "Song", icon: Music },
  { id: "export", label: "Export", icon: Download },
];

export default function ProjectDetail({ params }: { params: { id: string; tab?: string } }) {
  const { id, tab = "story" } = params;
  const { data: project, isLoading } = useProject(id);
  const [, setLocation] = useLocation();

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
      {/* Header */}
      <header className="h-16 border-b border-border/50 bg-card/50 flex items-center px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/app/projects">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold">{project.title}</h1>
            <div className="text-xs text-muted-foreground capitalize flex items-center gap-2">
              {project.format} • {project.status || "Draft"}
              {project.progress !== undefined && ` • ${project.progress}%`}
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Action buttons could go here */}
        </div>
      </header>

      {/* Tabs Nav */}
      <div className="border-b border-border/50 bg-background/50 overflow-x-auto scrollbar-none">
        <div className="flex px-4 min-w-max">
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <Link key={t.id} href={`/app/projects/${id}/${t.id}`}>
                <button
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive 
                      ? "border-primary text-primary" 
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        {tab === "story" && <StoryBibleTab project={project} />}
        {tab === "characters" && <CharacterStudioTab project={project} />}
        {tab === "storyboard" && <StoryboardTab project={project} />}
        {tab === "production" && <ProductionTab project={project} />}
        {tab === "playground" && <PlaygroundTab project={project} />}
        {tab === "visualization" && <VisualizationTab project={project} />}
        {tab === "environments" && <EnvironmentsTab project={project} />}
        {tab === "export" && <ExportTab project={project} />}
        {tab === "song" && <SongTab project={project} />}
      </div>
    </div>
  );
}
