import { motion } from "framer-motion";
import { useMemo } from "react";

const COLORS = ["#7C3AED", "#A855F7", "#C084FC", "#F8F8FF", "#EAB308", "#F472B6", "#22D3EE"];
const PARTICLE_COUNT = 130;

interface Particle {
  id: number;
  left: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  rotate: number;
  drift: number;
  round: boolean;
}

/** Re-mount with a new `burstKey` (e.g. the winner's handle) to fire a fresh burst. */
export function Confetti({ burstKey }: { burstKey: string }) {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, id) => ({
      id,
      left: Math.random() * 100,
      color: COLORS[id % COLORS.length]!,
      size: 5 + Math.random() * 10,
      delay: Math.random() * 0.9,
      duration: 1.8 + Math.random() * 1.8,
      rotate: (Math.random() - 0.5) * 900,
      drift: (Math.random() - 0.5) * 240,
      round: Math.random() > 0.5,
    }));
  }, [burstKey]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={`${burstKey}-${p.id}`}
          // Animating y/x/rotate/scale (transform) + opacity instead of top/left keeps every
          // frame compositor-only — with 130 particles at once, animating `top` would force a
          // layout reflow on every tick and visibly stutter the rest of the page (chat included).
          initial={{ y: "-10vh", opacity: 1, rotate: 0, scale: 0.4 }}
          animate={{ y: "110vh", x: p.drift, opacity: [1, 1, 0], rotate: p.rotate, scale: 1 }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.2, 0.6, 0.4, 1] }}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: 0,
            width: p.size,
            height: p.round ? p.size : p.size * 0.4,
            backgroundColor: p.color,
            borderRadius: p.round ? "50%" : 2,
          }}
        />
      ))}
    </div>
  );
}
