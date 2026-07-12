import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";

export function CursorGlow({ children, className = "" }: { children: ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  }

  const background = useMotionTemplate`radial-gradient(620px circle at ${x}px ${y}px, rgb(192 132 252 / 12%), transparent 70%)`;

  return (
    <div onMouseMove={handleMouseMove} className={className}>
      <motion.div className="pointer-events-none absolute inset-0 -z-[2]" style={{ background }} />
      {children}
    </div>
  );
}
