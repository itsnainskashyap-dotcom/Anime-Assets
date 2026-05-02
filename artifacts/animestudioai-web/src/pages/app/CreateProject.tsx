import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { PiFilmReelDuotone, PiCoinsDuotone, PiMagicWandDuotone } from "react-icons/pi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AnimePoster } from "@/components/ui/anime-poster";
import { useCreateProject } from "@/hooks/use-projects";
import { useAuth } from "@/hooks/use-auth";
import gAction from "@assets/generated_images/genre_action.png";
import gRomance from "@assets/generated_images/genre_romance.png";
import gMecha from "@assets/generated_images/genre_mecha.png";
import gFantasy from "@assets/generated_images/genre_fantasy.png";
import gScifi from "@assets/generated_images/genre_scifi.png";
import gHorror from "@assets/generated_images/genre_horror.png";
import gSlice from "@assets/generated_images/genre_slice.png";
import gAdventure from "@assets/generated_images/genre_adventure.png";
import gCyberpunk from "@assets/generated_images/genre_cyberpunk.png";
import gDrama from "@assets/generated_images/genre_drama.png";
import gMystery from "@assets/generated_images/genre_mystery.png";
import gPsychological from "@assets/generated_images/genre_psychological.png";

const FORMATS = [
  { id: "short", label: "Animated Short", duration: "1-3 mins", credits: 500, desc: "A self-contained cinematic short." },
  { id: "episode", label: "Single Episode", duration: "20-24 mins", credits: 2500, desc: "Standard anime broadcast length." },
  { id: "series", label: "Mini Series", duration: "3-6 episodes", credits: 10000, desc: "A continuing narrative arc." },
];

// Exact-duration choices per format. `seconds` is what the backend uses to
// build the story bible's scene budget.
const DURATION_OPTIONS: Record<string, { label: string; seconds: number; credits: number }[]> = {
  short: [
    { label: "1 minute",  seconds: 60,  credits: 250 },
    { label: "2 minutes", seconds: 120, credits: 400 },
    { label: "3 minutes", seconds: 180, credits: 500 },
  ],
  episode: [
    { label: "20 minutes", seconds: 1200, credits: 2200 },
    { label: "22 minutes", seconds: 1320, credits: 2500 },
    { label: "24 minutes", seconds: 1440, credits: 2800 },
  ],
  series: [
    { label: "3 episodes (~66 min)",  seconds: 3960,  credits: 7000 },
    { label: "4 episodes (~88 min)",  seconds: 5280,  credits: 9000 },
    { label: "5 episodes (~110 min)", seconds: 6600,  credits: 11000 },
    { label: "6 episodes (~132 min)", seconds: 7920,  credits: 13000 },
  ],
};

const GENRES: { name: string; img: string; caption: string }[] = [
  { name: "Action",        img: gAction,        caption: "High-energy battles, dynamic motion." },
  { name: "Adventure",     img: gAdventure,     caption: "Long journeys, sweeping worlds." },
  { name: "Fantasy",       img: gFantasy,       caption: "Magic, myth, the impossible." },
  { name: "Sci-Fi",        img: gScifi,         caption: "Stations, ships, alternate futures." },
  { name: "Cyberpunk",     img: gCyberpunk,     caption: "Neon cities, augmented humans." },
  { name: "Mecha",         img: gMecha,         caption: "Towering robots, real stakes." },
  { name: "Romance",       img: gRomance,       caption: "Tender, slow-burn moments." },
  { name: "Drama",         img: gDrama,         caption: "Character-driven, emotional weight." },
  { name: "Slice of Life", img: gSlice,         caption: "Cozy, warm, everyday joy." },
  { name: "Mystery",       img: gMystery,       caption: "Hidden truths, slow reveals." },
  { name: "Horror",        img: gHorror,        caption: "Quiet dread, ominous atmosphere." },
  { name: "Psychological", img: gPsychological, caption: "Mind-bending, identity, paranoia." },
];

const VOICES = [
  { id: "cinematic", label: "Cinematic Drama", desc: "Dark, moody, character-driven." },
  { id: "shonen", label: "Shonen Action", desc: "High energy, dynamic, inspiring." },
  { id: "ghibli", label: "Ghibli-esque", desc: "Whimsical, atmospheric, gentle." },
  { id: "dark_fantasy", label: "Dark Fantasy", desc: "Gritty, magical, mature." },
];

const LANGUAGES: { code: string; label: string; flag: string; nativeName: string }[] = [
  { code: "en",    label: "English",    flag: "🇬🇧", nativeName: "English" },
  { code: "hi",    label: "Hindi",      flag: "🇮🇳", nativeName: "हिंदी" },
  { code: "hi-en", label: "Hinglish",   flag: "🇮🇳", nativeName: "Hinglish" },
  { code: "es",    label: "Spanish",    flag: "🇪🇸", nativeName: "Español" },
  { code: "ja",    label: "Japanese",   flag: "🇯🇵", nativeName: "日本語" },
  { code: "ko",    label: "Korean",     flag: "🇰🇷", nativeName: "한국어" },
  { code: "fr",    label: "French",     flag: "🇫🇷", nativeName: "Français" },
  { code: "pt",    label: "Portuguese", flag: "🇧🇷", nativeName: "Português" },
  { code: "zh",    label: "Chinese",    flag: "🇨🇳", nativeName: "中文" },
  { code: "ar",    label: "Arabic",     flag: "🇸🇦", nativeName: "عربي" },
];

export default function CreateProject() {
  const [, setLocation] = useLocation();
  const { user, api } = useAuth();
  const createProject = useCreateProject();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: "",
    format: "short",
    durationLabel: "3 minutes",
    targetSeconds: 180,
    genres: [] as string[],
    voice: "cinematic",
    storyPrompt: "",
    language: "en",
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
      // Send the field names the backend actually reads: `genre` (joined),
      // `voiceStyle`, plus the exact target duration.
      const payload = {
        title: formData.title,
        format: formData.format,
        genre: formData.genres.join(", "),
        genres: formData.genres,
        voiceStyle: formData.voice,
        voice: formData.voice,
        storyPrompt: formData.storyPrompt,
        durationLabel: formData.durationLabel,
        targetSeconds: formData.targetSeconds,
        language: formData.language,
      };
      const res = await createProject.mutateAsync(payload);
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
              <p className="text-muted-foreground">Give your project a name, choose your output language, and select its format.</p>
            </div>

            {/* Language selector — shown first */}
            <div className="space-y-3">
              <Label>Output Language</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Dialogue, voiceover, and agent prompts will all use this language.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => updateForm("language", lang.code)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                      formData.language === lang.code
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card hover:border-primary/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-lg leading-none">{lang.flag}</span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-xs">{lang.label}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{lang.nativeName}</div>
                    </div>
                  </button>
                ))}
              </div>
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
                      data-testid={`format-${f.id}`}
                      onClick={() => {
                        const def = (DURATION_OPTIONS[f.id] || [])[0];
                        setFormData(prev => ({
                          ...prev,
                          format: f.id,
                          durationLabel: def?.label ?? f.duration,
                          targetSeconds: def?.seconds ?? prev.targetSeconds,
                        }));
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

              <div className="space-y-3 pt-4">
                <Label>Exact Duration</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Pick the precise length — the AI Director will scale the scene count and pacing to match.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(DURATION_OPTIONS[formData.format] || []).map(d => (
                    <button
                      key={d.seconds}
                      type="button"
                      data-testid={`duration-${d.seconds}`}
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        durationLabel: d.label,
                        targetSeconds: d.seconds,
                      }))}
                      className={`px-3 py-3 rounded-lg border-2 text-sm font-medium transition-colors text-left ${formData.targetSeconds === d.seconds ? 'border-primary bg-primary/5 text-foreground' : 'border-border bg-card hover:border-primary/50 text-foreground'}`}
                    >
                      <div className="font-semibold">{d.label}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <PiCoinsDuotone className="w-3.5 h-3.5" /> {d.credits.toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold mb-2">Pick Your Anime Type</h2>
                <p className="text-muted-foreground">Choose up to 3 genres. The Director adapts pacing, palette, and shot language to match.</p>
              </div>
              <Badge variant={formData.genres.length === 0 ? "outline" : "default"} className="rounded-full">
                {formData.genres.length}/3 selected
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4" role="group" aria-label="Anime genres (choose up to 3)">
              {GENRES.map((g, i) => {
                const selected = formData.genres.includes(g.name);
                const atCap = !selected && formData.genres.length >= 3;
                return (
                  <AnimePoster
                    key={g.name}
                    src={g.img}
                    label={g.name}
                    caption={g.caption}
                    selected={selected}
                    disabled={atCap}
                    onClick={() => toggleGenre(g.name)}
                    index={i}
                    testId={`genre-${g.name.toLowerCase().replace(/\s+/g, "-")}`}
                  />
                );
              })}
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
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Language</div>
                  <div className="font-medium flex items-center gap-1.5">
                    {(() => { const l = LANGUAGES.find(x => x.code === formData.language); return l ? <><span>{l.flag}</span> {l.label}</> : formData.language; })()}
                  </div>
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

  const estCredits =
    (DURATION_OPTIONS[formData.format] || []).find(d => d.seconds === formData.targetSeconds)?.credits ??
    FORMATS.find(f => f.id === formData.format)?.credits ?? 0;

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

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border">
          <AnimatePresence mode="wait">
            <div key={step} className="pb-6">
              {renderStep()}
            </div>
          </AnimatePresence>
        </div>

        <div className="pt-8 mt-8 border-t border-border flex items-center justify-between">
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
                <PiMagicWandDuotone className="w-4 h-4 mr-2" />
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
              <PiFilmReelDuotone className="w-5 h-5 text-primary" /> Live Summary
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Language</span>
                  <span className="font-medium flex items-center gap-1">
                    {(() => { const l = LANGUAGES.find(x => x.code === formData.language); return l ? <><span>{l.flag}</span> {l.label}</> : "English"; })()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Estimated Time</span>
                  <span className="font-medium">~5-10 mins (setup)</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Required Credits</span>
                  <span className="font-medium text-primary flex items-center gap-1">
                    <PiCoinsDuotone className="w-3.5 h-3.5" /> {estCredits.toLocaleString()}
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
              <PiMagicWandDuotone className="w-4 h-4" /> AI Director Note
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
