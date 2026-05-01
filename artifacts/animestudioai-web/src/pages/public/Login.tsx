import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import bgImage from "@assets/file_00000000d90c72079fcfe96ea14499ab_1777612374972.png";

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

  const onSubmit = async (data: any) => {
    setError(null);
    try {
      await login(data);
    } catch (err: any) {
      setError(err.message || "Failed to login");
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background selection:bg-primary/30">
      {/* Left side - Image */}
      <div className="hidden lg:flex w-1/2 relative bg-muted items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-background/80 to-transparent" />
        <img src={bgImage} alt="Studio Environment" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        <div className="relative z-20 text-center px-12 max-w-lg">
          <Film className="w-16 h-16 mx-auto mb-8 text-primary" />
          <h2 className="text-4xl font-bold mb-4">Welcome back to the Studio.</h2>
          <p className="text-xl text-muted-foreground">Continue building your cinematic universe.</p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <motion.div 
          className="w-full max-w-md space-y-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight">Sign In</h1>
            <p className="text-muted-foreground mt-2">Enter your email and password to access your projects.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="creator@studio.com" 
                  {...register("email")}
                  className="bg-card"
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
                  className="bg-card"
                />
                {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Sign In
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account? <Link href="/signup" className="text-primary hover:underline">Sign up</Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
