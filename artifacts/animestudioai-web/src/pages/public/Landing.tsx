import { Link } from "wouter";
import { motion } from "framer-motion";
import { ChevronRight, ArrowRight, Github, Twitter } from "lucide-react";
import {
  PiPlayCircleDuotone,
  PiMagicWandDuotone,
  PiLightningDuotone,
  PiBrainDuotone,
  PiPaletteDuotone,
  PiClockDuotone,
  PiStarDuotone,
  PiSlidersHorizontalDuotone,
} from "react-icons/pi";
import { Button } from "@/components/ui/button";
import { AnimePoster } from "@/components/ui/anime-poster";
import heroBg from "@assets/generated_images/hero_landing.png";
import logoMark from "@assets/generated_images/logo_mark.png";
import featCharacter from "@assets/generated_images/feature_character.png";
import featStoryboard from "@assets/generated_images/feature_storyboard.png";
import featRender from "@assets/generated_images/feature_render.png";
import gAction from "@assets/generated_images/genre_action.png";
import gRomance from "@assets/generated_images/genre_romance.png";
import gMecha from "@assets/generated_images/genre_mecha.png";
import gFantasy from "@assets/generated_images/genre_fantasy.png";
import gScifi from "@assets/generated_images/genre_scifi.png";
import gHorror from "@assets/generated_images/genre_horror.png";
import gSlice from "@assets/generated_images/genre_slice.png";
import gAdventure from "@assets/generated_images/genre_adventure.png";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: "easeOut" as const },
} as const;

const GENRES = [
  { src: gAction, label: "Action", caption: "High-energy shounen battles." },
  { src: gRomance, label: "Romance", caption: "Tender, slow-burn moments." },
  { src: gMecha, label: "Mecha", caption: "Towering robots, real stakes." },
  { src: gFantasy, label: "Fantasy", caption: "Magic, myths, far-off worlds." },
  { src: gScifi, label: "Sci-Fi", caption: "Stations, ships, the unknown." },
  { src: gSlice, label: "Slice of Life", caption: "Cozy, warm, everyday joy." },
  { src: gHorror, label: "Horror", caption: "Quiet dread, hidden things." },
  { src: gAdventure, label: "Adventure", caption: "Long journeys, big horizons." },
];

const FEATURES = [
  {
    img: featCharacter,
    eyebrow: "Story & Characters",
    title: "Build a cast that feels alive",
    desc: "The AI Director collaborates with you on a full Story Bible — characters, world rules, themes, and arcs locked before a single frame is rendered.",
  },
  {
    img: featStoryboard,
    eyebrow: "Storyboard & Pre-vis",
    title: "See every shot before it ships",
    desc: "Auto-generated storyboards with shot composition, camera angles, and pacing notes. Iterate panel by panel, no guessing.",
  },
  {
    img: featRender,
    eyebrow: "Cinematic Rendering",
    title: "Final frames with temporal consistency",
    desc: "Characters stay on-model across cuts. Lighting holds across scenes. Render the short, the episode, or the whole arc.",
  },
];

const STATS = [
  { value: "12k+", label: "Shorts produced" },
  { value: "60+", label: "Style presets" },
  { value: "4 min", label: "Avg first-cut time" },
  { value: "98%", label: "Character consistency" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer group">
              <motion.img
                src={logoMark}
                alt="AnimeStudioAI"
                className="w-9 h-9 rounded-lg object-cover"
                whileHover={{ rotate: -8, scale: 1.08 }}
                transition={{ type: "spring", stiffness: 300 }}
              />
              <span className="font-bold text-lg tracking-tight">
                Anime<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">StudioAI</span>
              </span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#workflow" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Workflow</a>
            <a href="#genres" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Genres</a>
            <a href="#stats" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Studio</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors hidden sm:inline">Sign In</Link>
            <Link href="/signup">
              <Button size="sm" className="gap-1.5 rounded-full">
                Start Creating <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-36 overflow-hidden min-h-[92vh] flex items-center">
        <div className="absolute inset-0 z-0">
          <motion.img
            src={heroBg}
            alt=""
            className="w-full h-full object-cover object-center"
            initial={{ scale: 1.12, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.55 }}
            transition={{ duration: 2.5, ease: "easeOut" as const }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60 z-10" />
          {/* Animated grid noise */}
          <div className="absolute inset-0 z-10 opacity-[0.04] mix-blend-screen" style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }} />
          {/* Floating glow orbs */}
          <motion.div
            className="absolute top-1/4 left-[12%] w-72 h-72 rounded-full bg-primary/20 blur-3xl"
            animate={{ y: [0, 24, 0], x: [0, -16, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-1/4 right-[10%] w-96 h-96 rounded-full bg-purple-500/15 blur-3xl"
            animate={{ y: [0, -20, 0], x: [0, 20, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="container relative z-20 mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6 border border-primary/30 backdrop-blur-md">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-primary" />
                </span>
                NEXT-GEN ANIME PRODUCTION STUDIO
              </div>
            </motion.div>

            <motion.h1
              className="text-5xl md:text-6xl lg:text-8xl font-bold tracking-tight mb-7 leading-[0.95]"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
            >
              Your story.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-fuchsia-400 to-purple-400">Your world.</span><br />
              Your anime.
            </motion.h1>

            <motion.p
              className="text-lg lg:text-xl text-muted-foreground/90 mb-10 max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
            >
              Type a story idea and watch an autonomous studio of AI agents turn it into a full animated short, episode, or series — with cinematic anime visuals and on-model characters.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28 }}
            >
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto text-base px-8 h-14 rounded-full gap-2 group">
                  <PiMagicWandDuotone className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  Enter the Studio
                </Button>
              </Link>
              <Link href="#workflow">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 h-14 rounded-full gap-2 border-border/60 backdrop-blur-md">
                  <PiPlayCircleDuotone className="w-6 h-6" /> See How It Works
                </Button>
              </Link>
            </motion.div>

            {/* Tiny trust row */}
            <motion.div
              className="mt-12 flex items-center justify-center gap-6 text-xs text-muted-foreground/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <div className="flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => <PiStarDuotone key={i} className="w-3.5 h-3.5 text-amber-400" />)}
                <span className="ml-1.5 font-medium">4.9 from creators</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <PiLightningDuotone className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium">First cut in &lt; 5 min</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 hidden md:block"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-foreground/30 flex items-start justify-center p-1.5">
            <div className="w-1 h-2 rounded-full bg-foreground/50" />
          </div>
        </motion.div>
      </section>

      {/* Stats strip */}
      <section id="stats" className="border-y border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className="text-center md:text-left"
              >
                <div className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                  {s.value}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground mt-1 uppercase tracking-wider font-medium">
                  {s.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section — illustrated cards */}
      <section id="workflow" className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-16 max-w-2xl mx-auto" {...fadeUp}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
              <span className="w-6 h-px bg-primary/50" />
              The Autonomous Pipeline
              <span className="w-6 h-px bg-primary/50" />
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              From idea to final cut, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">in one studio</span>.
            </h2>
            <p className="text-muted-foreground text-lg">
              Every stage of anime production runs as a coordinated AI agent. You direct, the studio executes.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.1, duration: 0.55, ease: "easeOut" as const }}
                whileHover={{ y: -6 }}
                className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card hover:border-primary/40 transition-colors"
              >
                <div className="aspect-[4/3] relative overflow-hidden">
                  <img
                    src={f.img}
                    alt={f.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/30">
                    {String(i + 1).padStart(2, "0")} · {f.eyebrow}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2 tracking-tight">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Genre showcase */}
      <section id="genres" className="py-24 md:py-32 bg-card/30 border-y border-border/40 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: "radial-gradient(ellipse at top, hsl(var(--primary) / 0.15), transparent 60%)"
        }} />
        <div className="container mx-auto px-4 relative">
          <motion.div className="text-center mb-14 max-w-2xl mx-auto" {...fadeUp}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
              <PiPaletteDuotone className="w-4 h-4" />
              Pick your universe
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Any genre, any tone.
            </h2>
            <p className="text-muted-foreground text-lg">
              Mix up to three. The Director adapts pacing, palette, and shot language to match.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-5 max-w-6xl mx-auto">
            {GENRES.map((g, i) => (
              <AnimePoster key={g.label + i} src={g.src} label={g.label} caption={g.caption} index={i} />
            ))}
          </div>

          <motion.div className="mt-12 text-center" {...fadeUp}>
            <Link href="/signup">
              <Button size="lg" className="rounded-full gap-2 group">
                Start with your genre <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Why us */}
      <section className="py-24 md:py-28">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              { icon: PiBrainDuotone, title: "AI Director Brain", desc: "A persistent agent that remembers your characters, themes, and continuity across every chunk." },
              { icon: PiClockDuotone, title: "Hours, not months", desc: "Cut production time by 100×. Iterate at the speed of an idea, ship at the polish of a studio." },
              { icon: PiSlidersHorizontalDuotone, title: "Stay in control", desc: "Edit any beat, any storyboard panel, any frame. The studio adapts everything downstream." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="p-7 rounded-2xl bg-gradient-to-br from-card to-card/50 border border-border/60 hover:border-primary/40 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/10 flex items-center justify-center mb-5 text-primary border border-primary/20">
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold mb-2 tracking-tight">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-600/10 to-fuchsia-500/10" />
          <motion.div
            className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-primary/30 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <motion.div className="container mx-auto px-4 text-center max-w-3xl" {...fadeUp}>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Ready to direct your first anime?
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            Get studio-grade results in minutes. No animation degree required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-base px-8 h-14 rounded-full gap-2 shadow-lg shadow-primary/30">
                <PiMagicWandDuotone className="w-5 h-5" /> Create your studio
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="ghost" className="text-base px-8 h-14 rounded-full gap-2">
                Sign in <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <img src={logoMark} alt="" className="w-7 h-7 rounded object-cover" />
              <span className="font-bold tracking-tight">AnimeStudioAI</span>
              <span className="text-xs text-muted-foreground ml-2">© {new Date().getFullYear()}</span>
            </div>
            <div className="flex items-center gap-5 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors flex items-center gap-1.5"><Twitter className="w-4 h-4" /></a>
              <a href="#" className="hover:text-foreground transition-colors flex items-center gap-1.5"><Github className="w-4 h-4" /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
