import { Trophy } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { Confetti } from "./Confetti";
import { PlayerAvatar } from "./PlayerAvatar";

/**
 * The FINISHED-state payoff moment, shared by every game so winning always feels the same:
 * confetti burst, a glow flash behind a bouncing trophy, then the winner card pops in with a
 * staggered reveal. Pass `subtitle` for anything game-specific to show under the name (a score,
 * a round count, ...) — everything else about the moment is identical across games on purpose.
 */
export function WinnerCelebration({
  displayName,
  avatarUrl,
  handle,
  subtitle,
}: {
  displayName: string;
  avatarUrl: string | null;
  handle: string;
  subtitle?: string;
}) {
  return (
    <div className="relative flex flex-col items-center gap-4 text-center">
      <Confetti burstKey={handle} />

      <motion.div
        key={handle}
        initial={{ opacity: 0.75, scale: 0.2 }}
        animate={{ opacity: 0, scale: 2.6 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-accent/40 blur-3xl"
      />

      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: [0, 1.3, 1], rotate: [0, -10, 10, -10, 0] }}
        transition={{ duration: 1.1, times: [0, 0.4, 1], rotate: { duration: 1, repeat: Infinity, repeatDelay: 0.6, delay: 0.5 } }}
        className="relative"
      >
        <motion.div
          animate={{ opacity: [0.35, 0.9, 0.35], scale: [1, 1.35, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-accent/50 blur-xl"
        />
        <Trophy size={52} weight="fill" className="relative text-accent" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.25 }}
        className="rounded-3xl border border-accent/40 bg-gradient-to-br from-primary/20 to-accent/10 p-8 shadow-glow backdrop-blur-2xl"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.45 }}
          className="flex justify-center"
        >
          <PlayerAvatar displayName={displayName} avatarUrl={avatarUrl} size={96} />
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="mt-4 text-sm text-ink-muted">
          الفائز 🎉
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-1 text-2xl font-extrabold"
        >
          {displayName}
        </motion.h1>
        {subtitle && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-1 text-accent">
            {subtitle}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
