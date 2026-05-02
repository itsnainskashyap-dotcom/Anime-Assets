import { motion } from "framer-motion";

interface AnimatedLoaderProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { svg: 32, ring: 2, text: "text-xs" },
  md: { svg: 56, ring: 3, text: "text-sm" },
  lg: { svg: 88, ring: 4, text: "text-base" },
};

export function AnimatedLoader({ label, size = "md", className = "" }: AnimatedLoaderProps) {
  const cfg = SIZE_MAP[size];
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
      <div className="relative" style={{ width: cfg.svg, height: cfg.svg }}>
        <motion.div
          className="absolute inset-0 rounded-full border-primary/30"
          style={{ borderWidth: cfg.ring, borderStyle: "solid" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            borderWidth: cfg.ring,
            borderStyle: "solid",
            borderColor: "transparent",
            borderTopColor: "hsl(var(--primary))",
            borderRightColor: "hsl(var(--primary) / 0.6)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/40 to-purple-500/20 blur-sm"
          animate={{ scale: [0.8, 1.05, 0.8], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="rounded-full bg-primary"
            style={{ width: cfg.ring * 2, height: cfg.ring * 2 }}
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
      {label && (
        <motion.p
          className={`${cfg.text} text-muted-foreground font-medium tracking-wide`}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}

export default AnimatedLoader;
