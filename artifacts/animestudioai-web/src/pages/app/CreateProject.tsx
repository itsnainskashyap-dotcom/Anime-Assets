import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Film, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useCreateProject } from "@/hooks/use-projects";
import { useAuth } from "@/hooks/use-auth";

const FORMATS = [
  { id: "short", label: "Animated Short", duration: "1-3 mins", credits: 500, desc: "A self-contained cinematic short." },
  { id: "episode", label: "Single Episode", duration: "20-24 mins", credits: 2500, desc: "Standard anime broadcast length." },
  { id: "series", label: "Mini Series", duration: "3-6 episodes", credits: 10000, desc: "A continuing narrative arc." },
];

const GENRES = [
  "Action", "Adventure", "Fantasy", "Sci-Fi", "Cyberpunk", "Slice of Life",
  "Romance", "Drama", "Mecha", "Mystery", "Horror", "Psychological"
];

const VOICES = [
  { id: "cinematic", label: "Cinematic Drama", desc: "Dark, moody, character-driven." },
  { id: "shonen", label: "Shonen Action", desc: "High energy, dynamic, inspiring." },
  { id: "ghibli", label: "Ghibli-esque", desc: "Whimsical, atmospheric, gentle." },
  { id: "dark_fantasy", label: "Dark Fantasy", desc: "Gritty, magical, mature." },
];

export default function CreateProject() {
  const [, setLocation] = useLocation();
  const { user, api } = useAuth();
  const createProject = useCreateProject();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: "",
    format: "short",
    durationLabel: "1-3 mins",
    genres: [] as string[],
    voice: "cinematic",
    storyPrompt: "",
  });

  const updateForm = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const toggleGenre = (genre: string) => {
    setFormData(prev => {
      if (prev.genres.includes(genre)) {
        return { ...prev, genres: prev.genres.filter(g => g !== genre) };
      }
      if (prev.genres.length >= 3) return prev;
      return { ...prev, genres: [...prev.genres, genre] };
    });
  };

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    try {
      const res = await createProject.mutateAsync(formData);
      // Auto-kick the full autonomous pipeline: story → chars → storyboard → visualization
      await api(`/api/projects/${res.id}/story-bible/generate`, { method: "POST" }).catch(() => {});
      setLocation(`/app/projects/${res.id}/story`);
    } catch (err) {
      console.error(err);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Project Basics</h2>
              <p className="text-muted-foreground">Give your project a name and select its format.</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Project Title</Label>
                <Input 
                  id="title" 
                  value={formData.title} 
                  onChange={e => updateForm("title", e.target.value)} 
                  placeholder="e.g. Neon Resonance"
                  className="bg-card text-lg py-6"
                />
              </div>

              <div className="space-y-3 pt-4">
                <Label>Format</Label>
                <div className="grid gap-4">
                  {FORMATS.map(f => (
                    <div 
                      key={f.id}
                      className={`relative flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${formData.format === f.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
                      onClick={() => {
                        updateForm("format", f.id);
                        updateForm("durationLabel", f.duration);
                      }}
                    >
                      <div className={`mt-1 w-5 h-5 rounded-full border flex items-center justify-center ${formData.format === f.id ? 'border-primary' : 'border-muted-foreground'}`}>
                        {formData.format === f.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold">{f.label}</h4>
                          <span className="text-sm font-medium text-muted-foreground">{f.duration}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Select Genres</h2>
              <p className="text-muted-foreground">Choose up to 3 genres that define your world.</p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {GENRES.map(g => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${formData.genres.includes(g) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/50 text-foreground'}`}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="text-sm text-muted-foreground pt-4">
              Selected: {formData.genres.length}/3
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Directorial Voice</h2>
              <p className="text-muted-foreground">Set the overall tone and visual style for the AI Director.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {VOICES.map(v => (
                <div 
                  key={v.id}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-colors text-center ${formData.voice === v.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
                  onClick={() => updateForm("voice", v.id)}
                >
                  <h4 className="font-bold mb-2">{v.label}</h4>
                  <p className="text-sm text-muted-foreground">{v.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Story Prompt</h2>
              <p className="text-muted-foreground">Describe your core concept. The AI Director will expand this into a full Story Bible.</p>
            </div>
            
            <div className="space-y-2">
              <Textarea 
                value={formData.storyPrompt}
                onChange={e => updateForm("storyPrompt", e.target.value)}
                placeholder="In a cyberpunk city where memories are traded as currency, a rogue archivist discovers a memory that belongs to no one..."
                className="min-h-[250px] bg-card text-base resize-none"
              />
            </div>
          </motion.div>
        );
      case 5:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Review & Initialize</h2>
              <p className="text-muted-foreground">Verify your project settings before we spin up the studio instance.</p>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-6 space-y-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Project Title</div>
                <div className="text-xl font-bold">{formData.title || "Untitled Project"}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Format</div>
                  <div className="font-medium capitalize">{formData.format} ({formData.durationLabel})</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Voice</div>
                  <div className="font-medium capitalize">{formData.voice.replace('_', ' ')}</div>
                </div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground mb-2">Genres</div>
                <div className="flex flex-wrap gap-2">
                  {formData.genres.length > 0 ? formData.genres.map(g => (
                    <Badge key={g} variant="secondary">{g}</Badge>
                  )) : <span className="text-muted-foreground italic">None selected</span>}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground mb-2">Story Core</div>
                <div className="p-4 bg-muted/50 rounded-lg text-sm italic border border-border/50">
                  {formData.storyPrompt ? `"${formData.storyPrompt}"` : "No story prompt provided."}
                </div>
              </div>
            </div>
          </motion.div>
        );
      default: return null;
    }
  };

  const isNextDisabled = () => {
    if (step === 1) return !formData.title.trim();
    if (step === 2) return formData.genres.length === 0;
    if (step === 4) return !formData.storyPrompt.trim();
    return false;
  };

  const estCredits = FORMATS.find(f => f.id === formData.format)?.credits || 0;

  return (
    <div className="p-8 max-w-6xl mx-auto w-full h-full flex flex-col md:flex-row gap-8">
      {/* Main Wizard Area */}
      <div className="flex-1 flex flex-col max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Create Project</h1>
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-secondary">
                <div className={`h-full bg-primary transition-all duration-500 ${step >= i ? 'w-full' : 'w-0'}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2 font-medium">
            <span>Format</span>
            <span>Genres</span>
            <span>Voice</span>
            <span>Story</span>
            <span>Review</span>
          </div>
        </div>

        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            <div key={step} className="absolute inset-0">
              {renderStep()}
            </div>
          </AnimatePresence>
        </div>

        <div className="pt-8 border-t border-border mt-auto flex items-center justify-between">
          <Button variant="outline" onClick={handleBack} disabled={step === 1 || createProject.isPending}>
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          
          {step < 5 ? (
            <Button onClick={handleNext} disabled={isNextDisabled()}>
              Next <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={createProject.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createProject.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Initialize Studio
            </Button>
          )}
        </div>
      </div>

      {/* Live Summary Panel */}
      <div className="w-80 hidden lg:block border-l border-border pl-8 relative">
        <div className="sticky top-8 space-y-6">
          <div>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" /> Live Summary
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Estimated Time</span>
                  <span className="font-medium">~5-10 mins (setup)</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Required Credits</span>
                  <span className="font-medium text-primary flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {estCredits.toLocaleString()}
                  </span>
                </div>
                <div className="pt-3 border-t border-border/50">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Your Balance</span>
                    <span className={`font-medium ${(user?.credits || 0) < estCredits ? 'text-destructive' : ''}`}>
                      {user?.credits?.toLocaleString() ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
            <h4 className="font-semibold text-sm text-primary mb-2 flex items-center gap-2">
              <Wand2 className="w-4 h-4" /> AI Director Note
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Once initialized, the AI Director will automatically generate a detailed Story Bible based on your core prompt. You'll be able to review and modify it before proceeding to character design.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
