import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { User, Lock, Loader2, ShieldCheck, Image as ImageIcon, Upload, AlertTriangle, Sparkles } from "lucide-react";
import { PiMagicWandDuotone } from "react-icons/pi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import type { Project } from "@/types/api";

interface Character {
  id: string;
  name: string;
  role?: string;
  description?: string;
  appearance_json?: string;
  visual_tokens?: string;
  portrait_url?: string | null;
  model_sheet_front_url?: string | null;
  model_sheet_three_quarter_url?: string | null;
  model_sheet_back_url?: string | null;
}

interface Appearance {
  age?: string | number;
  hairColor?: string;
  hairStyle?: string;
  eyeColor?: string;
  outfit?: string;
  distinguishingFeatures?: string;
  bodyType?: string;
}

function parseAppearance(raw: string | undefined): Appearance {
  if (!raw) return {};
  try { return JSON.parse(raw) as Appearance; } catch { return {}; }
}

function ShimmerCard() {
  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-b from-muted/20 to-muted/5">
      {/* Animated shimmer sweep */}
      <motion.div
        className="absolute inset-0 -translate-x-full"
        style={{
          background: "linear-gradient(105deg, transparent 40%, rgba(139,92,246,0.08) 50%, rgba(168,85,247,0.12) 55%, rgba(139,92,246,0.06) 60%, transparent 70%)",
        }}
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.3 }}
      />
      {/* Pulsing icon */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <motion.div
          className="relative"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary/50" />
          </div>
          <motion.div
            className="absolute -inset-1 rounded-xl border border-primary/20"
            animate={{ opacity: [0.4, 0, 0.4], scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
        </motion.div>
        <div className="text-center space-y-1">
          <p className="text-[11px] font-medium text-primary/60">Generating</p>
          <div className="flex items-center gap-1 justify-center">
            {[0, 0.2, 0.4].map((delay) => (
              <motion.div
                key={delay}
                className="w-1 h-1 rounded-full bg-primary/40"
                animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PortraitCard({ url, label, isReference, portraitReady, isLarge }: {
  url?: string | null;
  label: string;
  isReference?: boolean;
  portraitReady?: boolean;
  isLarge?: boolean;
}) {
  const generating = !url && (isReference || portraitReady);
  return (
    <div className="flex flex-col gap-2">
      <div className={`${isLarge ? "aspect-[9/16]" : "aspect-[9/16]"} rounded-xl border overflow-hidden relative group ${
        url ? "border-border/60 shadow-lg shadow-black/20" : generating ? "border-primary/20 bg-card/30" : "border-border/30 bg-card/20"
      }`}>
        <AnimatePresence mode="wait">
          {url ? (
            <motion.img
              key={url}
              src={url}
              alt={label}
              className="w-full h-full object-cover"
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          ) : generating ? (
            <motion.div
              key="shimmer"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ShimmerCard />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <ImageIcon className="w-6 h-6 text-muted-foreground/15" />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Overlay label on hover for generated images */}
        {url && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3">
            <p className="text-xs text-white/80 font-medium text-center">{label}</p>
          </div>
        )}
      </div>
      <p className="text-xs text-center font-medium text-muted-foreground/70">{label}</p>
    </div>
  );
}

export default function CharacterStudioTab({ project }: { project: Project }) {
  const { api } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFinalized = !!project.story_finalized_at;

  const { data: characters = [], isLoading, error } = useQuery<Character[]>({
    queryKey: ["projects", project.id, "characters"],
    queryFn: async () => {
      const res = await api(`/api/projects/${project.id}/characters`);
      return res.json() as Promise<Character[]>;
    },
    refetchInterval: (query) => {
      const chars = query.state.data as Character[] | undefined;
      if (!chars || chars.length === 0) return 3000;
      // Keep polling until ALL 4 images are ready for EVERY character
      const allComplete = chars.every(
        c => c.portrait_url && c.model_sheet_front_url && c.model_sheet_three_quarter_url && c.model_sheet_back_url,
      );
      return allComplete ? false : 3000;
    },
  });

  const generateCharacters = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/characters/generate`, { method: "POST" }),
  });

  const approveLock = useMutation({
    mutationFn: () => api(`/api/projects/${project.id}/characters/approve-lock`, { method: "POST" }),
  });

  // V17 §7.2 — upload reference image; backend runs Gemini 2.5 Flash and
  // creates a character with extracted appearance fields.
  const uploadReference = useMutation<unknown, Error, File>({
    mutationFn: async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api(`/api/projects/${project.id}/characters/upload-reference`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error((err as { error?: string }).error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setUploadError(null);
      qc.invalidateQueries({ queryKey: ["projects", project.id, "characters"] });
    },
    onError: (e) => setUploadError(e.message),
  });

  const handleFile = (f: File | undefined): void => {
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) {
      setUploadError("Please upload a PNG, JPEG, WebP or GIF image.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setUploadError("Image too large (max 20 MB).");
      return;
    }
    uploadReference.mutate(f);
  };

  const selected = characters.find(c => c.id === selectedId) ?? characters[0] ?? null;
  const appearance = parseAppearance(selected?.appearance_json);
  const allPortraitsDone = characters.length > 0 && characters.every(c => c.portrait_url);
  const allImagesDone = characters.length > 0 && characters.every(
    c => c.portrait_url && c.model_sheet_front_url && c.model_sheet_three_quarter_url && c.model_sheet_back_url,
  );
  const portraitCount = characters.filter(c => c.portrait_url).length;
  const doneCount = characters.filter(
    c => c.portrait_url && c.model_sheet_front_url && c.model_sheet_three_quarter_url && c.model_sheet_back_url,
  ).length;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading characters…
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-destructive">Failed to load: {(error as Error).message}</div>;
  }

  if (characters.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="w-16 h-16 rounded-full bg-card border border-border/50 flex items-center justify-center">
          <User className="w-8 h-8 text-muted-foreground/30" />
        </div>
        <div>
          <p className="font-semibold mb-1">Characters not yet generated</p>
          <p className="text-sm text-muted-foreground">
            {isFinalized
              ? "Click below to generate character visuals, or upload a reference image to start from your own portrait."
              : "Finalize your story first — character generation starts automatically on finalization."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button className="gap-2" onClick={() => generateCharacters.mutate()} disabled={generateCharacters.isPending || !isFinalized}>
            {generateCharacters.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PiMagicWandDuotone className="w-4 h-4" />}
            {generateCharacters.isPending ? "Generating…" : "Generate Characters"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadReference.isPending}
          >
            {uploadReference.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Reference
          </Button>
        </div>
        {!isFinalized && (
          <p className="text-xs text-amber-300/80 max-w-sm">
            Story finalization is recommended before generating canon characters,
            but you can upload a reference image at any time.
          </p>
        )}
        {uploadError && (
          <div className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {uploadError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex gap-0">
      {/* Sidebar */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <div className="w-[280px] border-r border-border/50 bg-card/30 flex flex-col">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm">Characters</h3>
            <p className="text-xs text-muted-foreground">
              {allImagesDone
                ? `${characters.length}/${characters.length} complete`
                : portraitCount > 0
                  ? `${doneCount}/${characters.length} full sets • ${portraitCount} portraits`
                  : `${portraitCount}/${characters.length} portraits ready`}
            </p>
          </div>
          {!allImagesDone && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating
            </div>
          )}
        </div>
        <div className="px-3 pt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 h-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadReference.isPending}
            title="Upload a reference image — Vision Analyzer will extract appearance fields"
          >
            {uploadReference.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Upload className="w-3.5 h-3.5" />}
            Upload Reference
          </Button>
          {uploadError && (
            <div className="text-[11px] text-destructive flex items-center gap-1.5 mt-2 px-1">
              <AlertTriangle className="w-3 h-3 shrink-0" /> {uploadError}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {characters.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center gap-3 ${
                selected?.id === c.id ? "border-primary bg-primary/5" : "border-border/50 bg-card/50 hover:border-primary/30"
              }`}
            >
              <div className="w-10 h-10 rounded-lg border border-border/50 bg-background overflow-hidden flex items-center justify-center shrink-0">
                {c.portrait_url ? (
                  <img src={c.portrait_url} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.role ?? "Character"}</div>
              </div>
              {c.portrait_url && c.model_sheet_front_url && c.model_sheet_three_quarter_url && c.model_sheet_back_url
                ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-auto" />
                : c.portrait_url
                  ? <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0 ml-auto" />
                  : null}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-border/50">
          <Button className="w-full gap-2" size="sm" onClick={() => approveLock.mutate()} disabled={approveLock.isPending || !allPortraitsDone}>
            {approveLock.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Lock Canon Designs
          </Button>
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 bg-background/20 overflow-auto scrollbar-none p-8">
        {selected ? (
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Name + role */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold">{selected.name}</h2>
                <p className="text-lg text-muted-foreground">{selected.role}</p>
              </div>
              {selected.portrait_url && (
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 gap-1">
                  <ShieldCheck className="w-3 h-3" /> Full Body Ready
                </Badge>
              )}
            </div>

            {/* Full Body Reference + 3 angle views */}
            <div className="grid grid-cols-4 gap-3">
              {/* Full body ref — spans 2 columns, taller */}
              <div className="col-span-2">
                <PortraitCard url={selected.portrait_url} label="Full Body Ref" isReference isLarge />
              </div>
              {/* 3 angle views stacked vertically in remaining 2 columns */}
              <div className="col-span-2 grid grid-cols-3 gap-3 content-start">
                <PortraitCard url={selected.model_sheet_front_url}         label="Front"  portraitReady={!!selected.portrait_url} />
                <PortraitCard url={selected.model_sheet_three_quarter_url} label="¾ View" portraitReady={!!selected.portrait_url} />
                <PortraitCard url={selected.model_sheet_back_url}          label="Back"   portraitReady={!!selected.portrait_url} />
              </div>
            </div>

            {/* Description + Appearance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selected.description && (
                <div className="p-5 rounded-xl border border-border/50 bg-card/50 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
                </div>
              )}
              {Object.keys(appearance).length > 0 && (
                <div className="p-5 rounded-xl border border-border/50 bg-card/50 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Appearance</h4>
                  <div className="space-y-1.5">
                    {appearance.age !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Age</span><span>{appearance.age}</span>
                      </div>
                    )}
                    {appearance.hairColor && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Hair</span>
                        <span>{appearance.hairStyle ? `${appearance.hairColor} ${appearance.hairStyle}` : appearance.hairColor}</span>
                      </div>
                    )}
                    {appearance.eyeColor && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Eyes</span><span>{appearance.eyeColor}</span>
                      </div>
                    )}
                    {appearance.bodyType && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Build</span><span>{appearance.bodyType}</span>
                      </div>
                    )}
                    {appearance.outfit && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Outfit</span><span className="text-right max-w-[55%]">{appearance.outfit}</span>
                      </div>
                    )}
                    {appearance.distinguishingFeatures && (
                      <div className="text-sm">
                        <span className="text-muted-foreground block mb-1">Notable</span>
                        <span>{appearance.distinguishingFeatures}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <User className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a character</p>
          </div>
        )}
      </div>
    </div>
  );
}
