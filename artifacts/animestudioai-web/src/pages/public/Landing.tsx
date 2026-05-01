import { Link } from "wouter";
import { motion } from "framer-motion";
import { Play, Sparkles, Wand2, Film, Layers, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@assets/file_00000000411071fa94a8326fa12ffa91_1777612375116.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <Film className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">AnimeStudioAI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors">Sign In</Link>
            <Link href="/signup">
              <Button size="sm" className="gap-2">
                Start Creating <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden min-h-[90vh] flex items-center">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background z-10" />
          <img src={heroBg} alt="Hero Background" className="w-full h-full object-cover opacity-40 object-center" />
        </div>
        
        <div className="container relative z-20 mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20">
                <Sparkles className="w-4 h-4" />
                <span>Next-Gen Anime Production</span>
              </div>
            </motion.div>
            
            <motion.h1 
              className="text-5xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Your story.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">Your world.</span><br/>
              Your anime.
            </motion.h1>
            
            <motion.p 
              className="text-lg lg:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Type a short story idea and watch it transform autonomously into a full animated short or series with cinematic anime visuals.
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto text-lg px-8 h-14 rounded-full gap-2">
                  <Wand2 className="w-5 h-5" /> Enter the Studio
                </Button>
              </Link>
              <Link href="#showcase">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 h-14 rounded-full gap-2">
                  <Play className="w-5 h-5" /> Watch Showcase
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24 bg-card/50 border-y border-border/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">The Autonomous Pipeline</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">From concept to final render in a unified, AI-driven environment.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { icon: Layers, title: "Story & Characters", desc: "Collaborate with the AI Director to build your world bible and lock character designs." },
              { icon: Film, title: "Storyboard & Pre-vis", desc: "Review generated scene boards, camera angles, and shot pacing before production." },
              { icon: Sparkles, title: "Cinematic Rendering", desc: "High-fidelity generation with temporal consistency and dynamic lighting." }
            ].map((step, i) => (
              <div key={i} className="p-6 rounded-2xl bg-background border border-border/50 hover:border-primary/50 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
                  <step.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} AnimeStudioAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
