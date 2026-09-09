import type { FlagsPlayer, FlagsState } from "@tikgames/shared-types";
import { CheckCircle, FlagBanner, Trophy, Users } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCountdown } from "../lib/useCountdown";
import { Branding } from "./Branding";
import { ChatStrip, type ChatItem } from "./ChatStrip";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";
import { RoundCountdown } from "@tikgames/game-3d";

export type { ChatItem };

function rankPlayers(players: FlagsPlayer[]): FlagsPlayer[] {
  return [...players].sort((a, b) => b.score - a.score);
}

function ParticipantsPanel({ players }: { players: FlagsPlayer[] }) {
  return (
    <div className="flex max-h-[440px] flex-col gap-1.5 overflow-y-auto rounded-3xl border border-glass-border bg-canvas-soft/70 p-4 shadow-glass backdrop-blur-2xl">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Users size={16} className="text-accent" weight="fill" />
        اللاعبين ({players.length})
      </div>
      {players.map((p) => (
        <div key={p.handle} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={26} ring={false} />
          <bdi className="truncate text-xs">{p.displayName}</bdi>
        </div>
      ))}
      {players.length === 0 && <p className="text-xs text-ink-muted">لسه محدش جاوب</p>}
    </div>
  );
}

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function LeaderboardPanel({ players }: { players: FlagsPlayer[] }) {
  const ranked = rankPlayers(players).slice(0, 10);
  return (
    <div className="flex max-h-[440px] flex-col gap-1.5 overflow-y-auto rounded-3xl border border-glass-border bg-canvas-soft/70 p-4 shadow-glass backdrop-blur-2xl">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Trophy size={16} className="text-accent" weight="fill" />
        الترتيب
      </div>
      {ranked.map((p, i) => (
        <div key={p.handle} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${i < 3 ? "bg-white/5" : ""}`}>
          <span className={`w-4 shrink-0 text-center text-xs font-bold ${i < 3 ? MEDAL_COLORS[i] : "text-ink-muted"}`}>
            {i + 1}
          </span>
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={26} ring={false} />
          <bdi className="truncate text-xs">{p.displayName}</bdi>
          <span className="mr-auto shrink-0 text-xs font-bold text-accent">{p.score}</span>
        </div>
      ))}
      {ranked.length === 0 && <p className="text-xs text-ink-muted">لسه محدش سجل نقطة</p>}
    </div>
  );
}

/** Progress bar for this game's one real difference from Trivia: a fixed round count. */
function RoundProgress({ round, totalRounds }: { round: number; totalRounds: number }) {
  const pct = Math.min(100, Math.round((round / totalRounds) * 100));
  return (
    <div className="flex w-full max-w-[220px] flex-col items-center gap-1.5">
      <p className="text-xs font-semibold text-white/85">
        الجولة {round} / {totalRounds}
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
          className="h-full rounded-full bg-gradient-to-l from-accent to-primary"
        />
      </div>
    </div>
  );
}

/**
 * The flag itself — a real downloaded SVG file (`public/flags/<code>.svg`), not a Unicode flag
 * emoji. Windows/Chrome (and OBS's Chromium Embedded Framework) routinely lack flag-emoji glyphs
 * and silently fall back to rendering the raw two-letter country code as plain text, which would
 * make this entire game unreadable for a huge slice of streamers and viewers — real artwork
 * sidesteps that completely. A slow shine sweep plays across it for a little extra shimmer.
 */
function FlagImage({ code, countryName, width, height }: { code: string; countryName: string | null; width: number; height: number }) {
  return (
    <div
      style={{ width, height }}
      className="relative overflow-hidden rounded-2xl ring-2 ring-white/40 shadow-[0_14px_28px_rgba(5,3,13,0.55)]"
    >
      <img src={`/flags/${code}.svg`} alt={countryName ?? ""} draggable={false} className="h-full w-full object-cover" />
      <motion.div
        animate={{ x: ["-130%", "180%"] }}
        transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent"
      />
    </div>
  );
}

/**
 * The flag card: a huge waving flag on a glowing site-palette backdrop, a countdown while it's
 * live, and — once someone guesses or time runs out — a brief reveal of the country name before
 * the next flag deals (or the game auto-finishes on the last round).
 */
function FlagArena({ state }: { state: FlagsState }) {
  const secondsLeft = useCountdown(state.phase === "QUESTION" ? state.phaseEndsAt : null);
  const revealed = state.phase === "REVEALED";

  return (
    <div className="relative flex h-[440px] w-[440px] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-glass-border bg-gradient-to-br from-primary/15 via-canvas-soft to-canvas-soft p-8 shadow-glass">
      <motion.div
        animate={{ opacity: [0.4, 0.75, 0.4], scale: [1, 1.08, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-8 rounded-full bg-primary/30 blur-3xl"
      />

      <RoundProgress round={state.round} totalRounds={state.settings.totalRounds} />

      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="flag"
            initial={{ opacity: 0, scale: 0.7, rotate: -6 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="relative flex flex-col items-center gap-3"
          >
            <motion.div
              animate={{ rotate: [-2.5, 2.5, -2.5], skewY: [-2, 2, -2] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              {state.countryCode && (
                <FlagImage code={state.countryCode} countryName={state.countryName} width={200} height={150} />
              )}
            </motion.div>
            <p className="text-sm font-bold text-white">العلم ده لمين؟ 🤔</p>
          </motion.div>
        ) : (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="flex flex-col items-center gap-3"
          >
            {state.countryCode && (
              <FlagImage code={state.countryCode} countryName={state.countryName} width={140} height={105} />
            )}
            <p className="text-2xl font-extrabold text-accent">{state.countryName}</p>
            {state.lastWinner ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }}
                className="mt-1 flex items-center gap-2 rounded-full bg-emerald-400/15 px-4 py-1.5 ring-1 ring-emerald-400/40"
              >
                <CheckCircle size={16} weight="fill" className="text-emerald-400" />
                <PlayerAvatar displayName={state.lastWinner.displayName} avatarUrl={state.lastWinner.avatarUrl} size={24} ring={false} />
                <bdi className="text-sm font-semibold text-white">{state.lastWinner.displayName}</bdi>
                <span className="text-xs text-emerald-300">+1</span>
              </motion.div>
            ) : (
              <p className="text-sm text-white/60">محدش عرفها 😅</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!revealed && <RoundCountdown secondsLeft={secondsLeft} size={120} />}
    </div>
  );
}

export function FlagsOverlay({ state, chat }: { state: FlagsState | null; chat: ChatItem[] }) {
  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Branding />
      </div>
    );
  }

  const inRound = state.phase === "QUESTION" || state.phase === "REVEALED";

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
              <FlagBanner size={48} weight="fill" className="mx-auto mb-2 text-accent" />
              <h1 className="text-2xl font-bold">أعلام</h1>
              <p className="mt-2 text-ink-muted">
                {state.settings.totalRounds} علم هيظهروا واحد ورا التاني — جاوب باسم الدولة في الشات!
              </p>
            </motion.div>
          )}

          {inRound && (
            <motion.div
              key="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid w-full max-w-6xl grid-cols-[240px_1fr_240px] items-center gap-5"
            >
              <ParticipantsPanel players={state.players} />
              <div className="flex justify-center">
                <FlagArena state={state} />
              </div>
              <LeaderboardPanel players={state.players} />
            </motion.div>
          )}

          {state.phase === "FINISHED" && (
            <motion.div
              key="finished"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="grid w-full max-w-6xl grid-cols-[240px_1fr_240px] items-center gap-5"
            >
              <ParticipantsPanel players={state.players} />
              <div className="flex flex-col items-center gap-4 text-center">
                {state.winner ? (
                  <WinnerCelebration
                    displayName={state.winner.displayName}
                    avatarUrl={state.winner.avatarUrl}
                    handle={state.winner.handle}
                    subtitle={`${state.winner.score} نقطة`}
                  />
                ) : (
                  <div className="rounded-3xl border border-glass-border bg-canvas-soft/70 p-8 shadow-glass backdrop-blur-2xl">
                    <FlagBanner size={40} className="mx-auto mb-3 text-ink-muted" />
                    <p className="text-ink-muted">خلصت الأعلام من غير ما حد يسجل نقطة</p>
                  </div>
                )}
              </div>
              <LeaderboardPanel players={state.players} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ChatStrip items={chat} />
      <Branding />
    </div>
  );
}
