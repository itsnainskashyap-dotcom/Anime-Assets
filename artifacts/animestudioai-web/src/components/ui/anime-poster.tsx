import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface AnimePosterProps {
  src: string;
  label: string;
  caption?: string;
  selected?: boolean;
  onClick?: () => void;
  index?: number;
  className?: string;
  testId?: string;
  disabled?: boolean;
}

export function AnimePoster({
  src,
  label,
  caption,
  selected = false,
  onClick,
  index = 0,
  className = "",
  testId,
  disabled = false,
}: AnimePosterProps) {
  const interactive = typeof onClick === "function" && !disabled;
  const ariaLabel = `${label}${caption ? `. ${caption}` : ""}${selected ? " (selected)" : ""}${disabled && !selected ? " (selection limit reached)" : ""}`;
  return (
    <motion.button
      type="button"
      onClick={interactive ? onClick : undefined}
      data-testid={testId}
      disabled={!interactive}
      aria-pressed={typeof onClick === "function" ? selected : undefined}
      aria-label={ariaLabel}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: "easeOut" }}
      whileHover={interactive ? { y: -4, scale: 1.02 } : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      className={`group relative aspect-[3/4] w-full overflow-hidden rounded-2xl border-2 text-left transition-colors ${
        selected ? "border-primary shadow-[0_0_0_4px_rgba(168,85,247,0.18)]" : "border-border/60 hover:border-primary/60"
      } ${interactive ? "cursor-pointer" : "cursor-default"} ${disabled && !selected ? "opacity-40" : ""} ${className}`}
    >
      <img
        src={src}
        alt={label}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
      {selected && (
        <motion.div
          layoutId={`poster-glow-${label}`}
          className="absolute inset-0 ring-2 ring-primary/70 rounded-2xl pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
      <div className="absolute top-3 right-3">
        {selected ? (
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
          >
            <Check className="w-4 h-4" strokeWidth={3} />
          </motion.div>
        ) : (
          interactive && (
            <div className="w-7 h-7 rounded-full border-2 border-white/40 backdrop-blur-sm bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          )
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h4 className="text-base font-bold text-white tracking-tight drop-shadow-md">{label}</h4>
        {caption && <p className="text-xs text-white/75 mt-0.5 line-clamp-2 drop-shadow">{caption}</p>}
      </div>
    </motion.button>
  );
}

export default AnimePoster;
