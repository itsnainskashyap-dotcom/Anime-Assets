import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useProject } from "@/hooks/use-projects";
import { Link } from "wouter";
import {
  BookOpen, Users, Mountain, LayoutTemplate,
  Layers, Activity, Film, Music, Download,
  ChevronLeft, Loader2, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

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
  { id: "story",         label: "Story Bible",   icon: BookOpen },
  { id: "characters",    label: "Characters",     icon: Users },
  { id: "environments",  label: "Environments",   icon: Mountain },
  { id: "storyboard",    label: "Storyboard",     icon: LayoutTemplate },
  { id: "visualization", label: "Visualization",  icon: Layers },
  { id: "playground",    label: "Playground",     icon: Activity },
  { id: "production",    label: "Production",     icon: Film },
  { id: "song",          label: "Song",           icon: Music },
  { id: "export",        label: "Export",         icon: Download },
];

const TAB_ORDER = ["story", "characters", "storyboard", "visualization", "production", "export"];

function stageToTab(stage: string | null | undefined): string | null {
  if (!stage) return null;
  if (/^characters/.test(stage)) return "characters";
  if (/^storyboard/.test(stage))  return "storyboard";
  if (/^visualization/.test(stage)) return "visualization";
  if (/^(production|chunk)/.test(stage)) return "production";
  if (/^export/.test(stage)) return "export";
  return null;
}

export default function ProjectDetail() {
  const params = useParams<{ id: string; tab?: string }>();
  const id = params.id ?? "";
  const tab = params.tab ?? "story";
  const { data: project, isLoading } = useProject(id);
  const [, setLocation] = useLocation();

  // Toast message for auto-navigation.
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track previous values to detect changes.
  const prevFinalizedRef = useRef<boolean>(false);
  const prevStageRef = useRef<string | null>(null);

  // Tracks whether the user has manually clicked a tab — if so, don't fight them.
  const userNavigatedRef = useRef<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 4000);
  }, []);

  const autoNavigate = useCallback(
    (toTab: string, reason: string) => {
      if (tab === toTab) return;
      // Only advance forward in the pipeline unless forced.
      const fromIdx = TAB_ORDER.indexOf(tab);
      const toIdx   = TAB_ORDER.indexOf(toTab);
      if (userNavigatedRef.current && toIdx <= fromIdx) return; // user is already ahead
      const label = TABS.find((t) => t.id === toTab)?.label ?? toTab;
      showToast(`Advancing to ${label} — ${reason}`);
      setLocation(`/app/projects/${id}/${toTab}`);
    },
    [tab, id, setLocation, showToast],
  );

  // ── Milestone-based auto-navigation ─────────────────────────────────────
  useEffect(() => {
    if (!project) return;

    const isFinalized = !!project.story_finalized_at;
    const currentStage = project.current_stage ?? null;

    const prevFinalized = prevFinalizedRef.current;
    const prevStage    = prevStageRef.current;
    prevFinalizedRef.current = isFinalized;
    prevStageRef.current     = currentStage;

    // Milestone 1 — Story just finalized → Characters tab.
    if (isFinalized && !prevFinalized) {
      userNavigatedRef.current = false;
      autoNavigate("characters", "story finalized ✓");
      return;
    }

    // Milestone 2 — Project stage advanced to a new pipeline stage.
    if (currentStage && currentStage !== prevStage) {
      const targetTab = stageToTab(currentStage);
      if (targetTab && !userNavigatedRef.current) {
        autoNavigate(targetTab, `${currentStage} active`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.story_finalized_at, project?.current_stage]);

  const handleTabClick = () => {
    userNavigatedRef.current = true;
  };

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
        <div className="ml-auto" />
      </header>

      {/* Tabs Nav */}
      <div className="border-b border-border/50 bg-background/50 overflow-x-auto scrollbar-none">
        <div className="flex px-4 min-w-max">
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <Link key={t.id} href={`/app/projects/${id}/${t.id}`} onClick={handleTabClick}>
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
        {tab === "story"         && <StoryBibleTab project={project} />}
        {tab === "characters"    && <CharacterStudioTab project={project} />}
        {tab === "storyboard"    && <StoryboardTab project={project} />}
        {tab === "production"    && <ProductionTab project={project} />}
        {tab === "playground"    && <PlaygroundTab project={project} />}
        {tab === "visualization" && <VisualizationTab project={project} />}
        {tab === "environments"  && <EnvironmentsTab project={project} />}
        {tab === "export"        && <ExportTab project={project} />}
        {tab === "song"          && <SongTab project={project} />}

        {/* Auto-navigation toast */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              key="autonav-toast"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-primary text-primary-foreground text-xs font-semibold px-5 py-2.5 rounded-full shadow-2xl shadow-primary/40 pointer-events-none"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              {toastMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
