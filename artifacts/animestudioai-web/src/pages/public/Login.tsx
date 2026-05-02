import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import bgImage from "@assets/generated_images/auth_splash.png";
import logoMark from "@assets/generated_images/logo_mark.png";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  type LoginFormData = z.infer<typeof loginSchema>;

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    try {
      await login(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to login");
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background selection:bg-primary/30">
      {/* Left side - Splash */}
      <div className="hidden lg:flex w-1/2 relative bg-muted items-center justify-center overflow-hidden">
        <motion.img
          src={bgImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ scale: 1.15, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.85 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/30 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background/80 z-10" />
        <motion.div
          className="absolute -bottom-10 -left-10 w-72 h-72 rounded-full bg-primary/30 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.75, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="relative z-20 text-left px-12 max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Link href="/">
            <div className="flex items-center gap-2.5 mb-10 cursor-pointer">
              <img src={logoMark} alt="" className="w-10 h-10 rounded-lg" />
              <span className="font-bold text-lg tracking-tight">
                Anime<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">StudioAI</span>
              </span>
            </div>
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold mb-5 border border-primary/30 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5" />
            Continue your story
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold mb-4 tracking-tight leading-tight">
            Welcome back to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">the studio</span>.
          </h2>
          <p className="text-base xl:text-lg text-muted-foreground/90 leading-relaxed">
            Pick up where you left off. Your characters are waiting, your storyboards are saved, and the Director has notes for you.
          </p>
        </motion.div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 relative">
        <Link href="/" className="lg:hidden absolute top-6 left-6 flex items-center gap-2">
          <img src={logoMark} alt="" className="w-8 h-8 rounded" />
          <span className="font-bold tracking-tight">AnimeStudioAI</span>
        </Link>

        <motion.div
          className="w-full max-w-md space-y-7"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight">Sign In</h1>
            <p className="text-muted-foreground mt-2 text-sm">Enter your email and password to access your projects.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="creator@studio.com"
                  {...register("email")}
                  className="bg-card h-11"
                />
                {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="#" className="text-xs text-primary hover:underline">Forgot password?</Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  {...register("password")}
                  className="bg-card h-11"
                />
                {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
              </div>
            </div>

            <Button type="submit" className="w-full h-11 rounded-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Sign In
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account? <Link href="/signup" className="text-primary hover:underline font-medium">Sign up</Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
