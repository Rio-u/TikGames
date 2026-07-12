import type { WouldYouRatherOption, WouldYouRatherState, WouldYouRatherVoter } from "@tikgames/shared-types";
import { Scales } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCountdown } from "../lib/useCountdown";
import { Branding } from "./Branding";
import { ChatStrip, type ChatItem } from "./ChatStrip";
import { PlayerAvatar } from "./PlayerAvatar";

export type { ChatItem };

/** 12-point starburst outline, precomputed once — the spinning frame behind the VS medallion. */
const VS_STAR_POINTS = Array.from({ length: 24 }, (_, k) => {
  const r = k % 2 === 0 ? 58 : 40;
  const a = (k * Math.PI) / 12 - Math.PI / 2;
  return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
}).join(" ");

/** The VS centerpiece: breathing glow, expanding shock rings, a slowly rotating gradient
 *  starburst, and a glass medallion with gradient "VS" — all in the site's violet/fuchsia. */
function VsBadge() {
  return (
    <div className="relative z-10 flex h-28 w-28 shrink-0 items-center justify-center">
      <motion.div
        animate={{ opacity: [0.45, 0.85, 0.45], scale: [1, 1.15, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute h-20 w-20 rounded-full bg-gradient-to-br from-primary/70 to-fuchsia-500/70 blur-2xl"
      />
      {[0, 0.8].map((delay) => (
        <motion.div
          key={delay}
          animate={{ scale: [0.55, 1.7], opacity: [0.7, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, delay, ease: "easeOut" }}
          className="absolute h-16 w-16 rounded-full border-2 border-fuchsia-400/70"
        />
      ))}
      <motion.svg
        viewBox="-60 -60 120 120"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        className="absolute h-full w-full drop-shadow-[0_0_14px_rgba(217,70,239,0.7)]"
      >
        <defs>
          <linearGradient id="ov-vs-star" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="55%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#d946ef" />
          </linearGradient>
        </defs>
        <polygon points={VS_STAR_POINTS} fill="url(#ov-vs-star)" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      </motion.svg>
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 11 }}
        className="relative flex h-[3.2rem] w-[3.2rem] items-center justify-center rounded-full border-2 border-white/40 bg-canvas-soft/90 shadow-[inset_0_2px_10px_rgba(192,132,252,0.35)]"
      >
        <span className="-skew-x-6 bg-gradient-to-b from-white via-[#e9d5ff] to-accent bg-clip-text text-2xl font-black italic text-transparent drop-shadow-[0_2px_6px_rgba(124,58,237,0.8)]">
          VS
        </span>
      </motion.div>
      <motion.span
        animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        className="absolute -top-1.5 text-lg drop-shadow-[0_0_7px_rgba(250,204,21,0.8)]"
      >
        ⚡
      </motion.span>
      <motion.span
        animate={{ opacity: [1, 0.2, 1], y: [0, 3, 0] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        className="absolute -bottom-1.5 text-lg drop-shadow-[0_0_7px_rgba(250,204,21,0.8)]"
      >
        ⚡
      </motion.span>
    </div>
  );
}

/** Overlapping pile of the freshest voters on one side. */
function VoterPile({ voters, max = 6 }: { voters: WouldYouRatherVoter[]; max?: number }) {
  const shown = voters.slice(0, max);
  return (
    <div className="flex h-7 items-center justify-center">
      <AnimatePresence>
        {shown.map((v, i) => (
          <motion.div
            key={v.handle}
            layout
            initial={{ opacity: 0, scale: 0.3, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.3 }}
            style={{ zIndex: max - i }}
            className="-mr-2 first:mr-0"
          >
            <PlayerAvatar displayName={v.displayName} avatarUrl={v.avatarUrl} size={24} ring={false} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Side identities in the site palette: side 1 is violet, side 2 is fuchsia — always, so the
 *  screen reads as one brand. (Cards are placeholder artwork until admin-uploaded images land.) */
const SIDE_THEMES = {
  1: { gradient: "linear-gradient(155deg, #8b5cf6 0%, #6d28d9 45%, #2e1065 100%)" },
  2: { gradient: "linear-gradient(155deg, #e879f9 0%, #c026d3 45%, #701a75 100%)" },
} as const;

/**
 * One option card: site-gradient artwork, floating emoji on a glass disc, label, live vote bar,
 * voter pile, and the big chat number under it. During RESULTS the winner swells and glows
 * while the loser fades.
 */
function OptionCard({
  option,
  number,
  votes,
  totalVotes,
  voters,
  phase,
  won,
  tie,
}: {
  option: WouldYouRatherOption;
  number: 1 | 2;
  votes: number;
  totalVotes: number;
  voters: WouldYouRatherVoter[];
  phase: "VOTING" | "RESULTS";
  won: boolean;
  tie: boolean;
}) {
  const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
  const results = phase === "RESULTS";
  const dimmed = results && !won && !tie;

  return (
    <motion.div
      layout
      animate={{
        scale: results && won ? 1.05 : dimmed ? 0.94 : 1,
        opacity: dimmed ? 0.45 : 1,
        filter: dimmed ? "grayscale(0.8)" : "grayscale(0)",
      }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="flex min-w-0 flex-1 flex-col items-center gap-2.5"
    >
      <div
        className={`relative w-full overflow-hidden rounded-3xl border ${
          results && won
            ? "border-accent shadow-[0_0_40px_rgba(192,132,252,0.55)]"
            : "border-white/15 shadow-[0_10px_35px_rgba(5,3,13,0.5)]"
        }`}
        style={{ background: SIDE_THEMES[number].gradient }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.22),transparent_55%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#05030d]/45 to-transparent" />
        <div className="relative flex flex-col items-center justify-center gap-2.5 p-6">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-white/10 ring-1 ring-white/25 backdrop-blur-sm" />
            <motion.span
              animate={{ y: [0, -6, 0], rotate: [0, -4, 4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="relative text-5xl drop-shadow-[0_8px_16px_rgba(5,3,13,0.55)]"
            >
              {option.emoji}
            </motion.span>
          </div>
          <p className="text-center text-lg font-extrabold leading-snug text-white drop-shadow-[0_2px_6px_rgba(5,3,13,0.7)]">
            {option.label}
          </p>

          <div className="w-full max-w-[220px]">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#05030d]/45 ring-1 ring-white/15">
              <motion.div
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                className="h-full rounded-full bg-gradient-to-l from-white to-[#e9d5ff]"
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs font-bold text-white/90">
              <span>{votes} صوت</span>
              <span>{pct}%</span>
            </div>
          </div>

          <VoterPile voters={voters} />
        </div>

        {results && won && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-2.5 top-2.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-extrabold text-canvas shadow-glow-sm"
          >
            🏆 الأغلبية هنا!
          </motion.div>
        )}
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-fuchsia-600 text-xl font-black text-white ring-2 ring-white/30 shadow-glow-sm">
          {number}
        </div>
        <p className="text-[10px] text-ink-muted">اكتب {number} في الشات</p>
      </div>
    </motion.div>
  );
}

/** The full question stage — title, countdown, the two cards and the VS between them. */
function VoteArena({ state }: { state: WouldYouRatherState }) {
  const secondsLeft = useCountdown(state.phase === "VOTING" ? state.phaseEndsAt : null);
  if (!state.optionA || !state.optionB || (state.phase !== "VOTING" && state.phase !== "RESULTS")) return null;
  const total = state.votesA + state.votesB;
  const tie = state.phase === "RESULTS" && state.resultSide === "TIE";

  return (
    <div className="flex w-full max-w-3xl flex-col items-center justify-center gap-5">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="rounded-full bg-white/10 px-3 py-0.5 text-xs text-ink-muted">سؤال {state.round}</p>
        <motion.h1
          key={state.round}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-extrabold"
        >
          بتفضل إيه أكتر؟ 🤔
        </motion.h1>
        {state.phase === "VOTING" && secondsLeft !== null && (
          <motion.p
            key={`t-${secondsLeft}`}
            initial={{ scale: 1.25, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-3xl font-extrabold text-accent"
          >
            {secondsLeft}
          </motion.p>
        )}
        {tie && (
          <motion.p
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14 }}
            className="text-2xl font-extrabold text-amber-300"
          >
            تعادل! 🤝
          </motion.p>
        )}
      </div>

      <div className="flex w-full items-center gap-4">
        <OptionCard
          option={state.optionA}
          number={1}
          votes={state.votesA}
          totalVotes={total}
          voters={state.recentVotersA}
          phase={state.phase}
          won={state.resultSide === "A"}
          tie={tie}
        />
        <VsBadge />
        <OptionCard
          option={state.optionB}
          number={2}
          votes={state.votesB}
          totalVotes={total}
          voters={state.recentVotersB}
          phase={state.phase}
          won={state.resultSide === "B"}
          tie={tie}
        />
      </div>

      <p className="text-xs text-ink-muted">إجمالي الأصوات: {total} 🔥</p>
    </div>
  );
}

export function WouldYouRatherOverlay({ state, chat }: { state: WouldYouRatherState | null; chat: ChatItem[] }) {
  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Branding />
      </div>
    );
  }

  const inRound = state.phase === "VOTING" || state.phase === "RESULTS";

  return (
    <div className="flex min-h-screen flex-col gap-4 p-6">
      <div className="flex flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {state.phase === "WAITING_TO_START" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-xl rounded-3xl border border-glass-border bg-canvas-soft/70 p-8 text-center shadow-glass backdrop-blur-2xl"
            >
              <Scales size={48} weight="fill" className="mx-auto mb-2 text-accent" />
              <h1 className="text-2xl font-bold">إما / أو</h1>
              <p className="mt-2 text-ink-muted">هيبدأ أول سؤال دلوقتي — صوّت بكتابة 1 أو 2 في الشات!</p>
            </motion.div>
          )}

          {inRound && (
            <motion.div
              key="round"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex w-full justify-center"
            >
              <VoteArena state={state} />
            </motion.div>
          )}

          {state.phase === "FINISHED" && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="flex w-full justify-center"
            >
              {/* winner is always null in this game — a passive wrap-up card, no buttons. */}
              <div className="rounded-3xl border border-glass-border bg-canvas-soft/70 p-8 text-center shadow-glass backdrop-blur-2xl">
                <Scales size={40} weight="fill" className="mx-auto mb-3 text-ink-muted" />
                <p className="text-ink-muted">خلصت الأسئلة — شكراً لكل اللي صوّتوا! 🎭</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ChatStrip items={chat} />
      <Branding />
    </div>
  );
}
