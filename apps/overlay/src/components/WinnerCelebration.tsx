import { motion } from "framer-motion";
import { PlayerAvatar } from "./PlayerAvatar";
import { VictoryScene } from "@tikgames/game-3d";

/**
 * The FINISHED-state payoff moment, shared by every game so winning always feels the same: the
 * streamer's chosen victory scene plays behind the winner's card, which pops in over it.
 *
 * Which scene that is comes from the registry in @tikgames/game-3d, resolved at render time from
 * the stored selection — so picking a different design on /3d-designs changes this with no
 * The scene shows "1" — first place. The winner's *name* is DOM text on the card in front of it,
 * where it stays crisp and correctly bidi-wrapped; the 3D layer carries the rank, which is the
 * one number that means the same thing in all twelve games.
 *
 * The trophy, rings, sparkles and confetti are real three.js geometry (`WinnerScene`); the card on
 * top stays DOM. That split is deliberate — the avatar is a real <img> and the name is real text,
 * so both stay crisp, stay selectable, and stay correctly bidi-wrapped in `<bdi>`, none of which
 * survives being drawn into a WebGL texture.
 *
 * Pass `subtitle` for anything game-specific under the name (a score, a round count, ...) —
 * everything else about the moment is identical across games on purpose.
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
    <div key={handle} className="relative flex w-full flex-col items-center justify-center">
      {/* Absolutely placed and non-interactive so it never pushes the card around or eats a
          click meant for the page behind it. Anchored to the top rather than filling the box:
          the scenes centre their number, and centring both put the card straight over it. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 min-h-[470px]">
        <VictoryScene value="1" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 18, delay: 0.55 }}
        className="relative z-10 mt-[250px] rounded-3xl border border-accent/40 bg-canvas-elevated/80 p-8 shadow-glow backdrop-blur-2xl"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.75 }}
          className="flex justify-center"
        >
          <PlayerAvatar displayName={displayName} avatarUrl={avatarUrl} size={96} />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="mt-4 text-sm text-ink-muted"
        >
          الفائز 🎉
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mt-1 text-2xl font-extrabold"
        >
          <bdi>{displayName}</bdi>
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-1 text-accent"
          >
            {subtitle}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
