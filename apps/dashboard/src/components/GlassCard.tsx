import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
  hoverLift = true,
}: {
  children: ReactNode;
  className?: string;
  hoverLift?: boolean;
}) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }

  const background = useMotionTemplate`radial-gradient(240px circle at ${mouseX}px ${mouseY}px, rgb(168 85 247 / 15%), transparent 70%)`;

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      whileHover={hoverLift ? { y: -6 } : undefined}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative flex flex-col rounded-3xl border border-glass-border bg-glass shadow-glass backdrop-blur-2xl transition-shadow duration-300 hover:shadow-glow-sm ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </motion.div>
  );
}
