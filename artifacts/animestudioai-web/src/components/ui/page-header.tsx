import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, align = "left", className = "" }: PageHeaderProps) {
  const alignClass = align === "center" ? "text-center items-center" : "";
  return (
    <div className={`flex flex-col md:flex-row md:items-end md:justify-between gap-4 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`flex flex-col gap-2 ${alignClass}`}
      >
        {eyebrow && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            className="inline-flex items-center gap-2 self-start text-xs font-semibold uppercase tracking-[0.18em] text-primary"
          >
            <span className="inline-block w-6 h-px bg-primary/60" />
            {eyebrow}
          </motion.span>
        )}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-3xl md:text-4xl font-bold tracking-tight"
        >
          {title}
        </motion.h1>
        {description && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.4 }}
            className="text-muted-foreground max-w-2xl"
          >
            {description}
          </motion.div>
        )}
      </motion.div>
      {actions && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.4 }}
          className="flex items-center gap-2 flex-wrap"
        >
          {actions}
        </motion.div>
      )}
    </div>
  );
}

export default PageHeader;
