import type { CapitalsPlayer, CapitalsState } from "@tikgames/shared-types";
import { CheckCircle, Compass, MapPinLine, Trophy, Users } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCountdown } from "../lib/useCountdown";
import { Branding } from "./Branding";
import { ChatStrip, type ChatItem } from "./ChatStrip";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";
import { RoundCountdown } from "./three/Countdown3D";

export type { ChatItem };

function rankPlayers(players: CapitalsPlayer[]): CapitalsPlayer[] {
  return [...players].sort((a, b) => b.score - a.score);
}

function ParticipantsPanel({ players }: { players: CapitalsPlayer[] }) {
  return (
    <div className="flex max-h-[440px] flex-col gap-1.5 overflow-y-auto rounded-3xl border border-glass-border bg-canvas-soft/70 p-4 shadow-glass backdrop-blur-2xl">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Users size={16} className="text-cyan-400" weight="fill" />
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

function LeaderboardPanel({ players }: { players: CapitalsPlayer[] }) {
  const ranked = rankPlayers(players).slice(0, 10);
  return (
    <div className="flex max-h-[440px] flex-col gap-1.5 overflow-y-auto rounded-3xl border border-glass-border bg-canvas-soft/70 p-4 shadow-glass backdrop-blur-2xl">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Trophy size={16} className="text-cyan-400" weight="fill" />
        الترتيب
      </div>
      {ranked.map((p, i) => (
        <div key={p.handle} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${i < 3 ? "bg-white/5" : ""}`}>
          <span className={`w-4 shrink-0 text-center text-xs font-bold ${i < 3 ? MEDAL_COLORS[i] : "text-ink-muted"}`}>
            {i + 1}
          </span>
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={26} ring={false} />
          <bdi className="truncate text-xs">{p.displayName}</bdi>
          <span className="mr-auto shrink-0 text-xs font-bold text-cyan-400">{p.score}</span>
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
          className="h-full rounded-full bg-gradient-to-l from-cyan-400 to-sky-500"
        />
      </div>
    </div>
  );
}

/**
 * The country's flag, shown as a small round medallion (not the big waving rectangle Flags
 * uses) — Capitals is about the *city*, not the flag, so the flag here is a static supporting
 * badge sitting inside a slowly-rotating compass-ring frame.
 */
function FlagMedallion({ code, size }: { code: string; size: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-400/40"
      />
      <div
        className="relative overflow-hidden rounded-full ring-4 ring-white/50 shadow-[0_0_24px_rgba(34,211,238,0.45)]"
        style={{ width: size * 0.78, height: size * 0.78 }}
      >
        <img src={`/flags/${code}.svg`} alt="" draggable={false} className="h-full w-full object-cover" />
      </div>
    </div>
  );
}

/**
 * The question card: country flag medallion + name up top asking for its capital, a countdown
 * while it's live, and — once someone guesses or time runs out — a map pin drops in with the
 * capital's name before the next country deals (or the game auto-finishes on the last round).
 */
function CapitalArena({ state }: { state: CapitalsState }) {
  const secondsLeft = useCountdown(state.phase === "QUESTION" ? state.phaseEndsAt : null);
  const revealed = state.phase === "REVEALED";

  return (
    <div className="relative flex h-[440px] w-[440px] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-glass-border bg-gradient-to-br from-cyan-500/10 via-canvas-soft to-canvas-soft p-8 shadow-glass">
      <motion.div
        animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.08, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-8 rounded-full bg-cyan-400/20 blur-3xl"
      />

      <RoundProgress round={state.round} totalRounds={state.settings.totalRounds} />

      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="question"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="flex flex-col items-center gap-4"
          >
            {state.countryCode && <FlagMedallion code={state.countryCode} size={128} />}
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                <Compass size={14} weight="fill" />
                عاصمة إيه؟
              </p>
              <p className="text-2xl font-extrabold text-white">{state.countryName}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="flex flex-col items-center gap-2.5"
          >
            {state.countryCode && <FlagMedallion code={state.countryCode} size={76} />}
            <p className="text-xs text-white/60">{state.countryName}</p>
            <motion.div
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
              className="flex items-center gap-1.5"
            >
              <MapPinLine size={20} weight="fill" className="text-cyan-400" />
              <p className="text-2xl font-extrabold text-cyan-300">{state.capitalName}</p>
            </motion.div>
            {state.lastWinner ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.2 }}
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

export function CapitalsOverlay({ state, chat }: { state: CapitalsState | null; chat: ChatItem[] }) {
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
              <Compass size={48} weight="fill" className="mx-auto mb-2 text-cyan-400" />
              <h1 className="text-2xl font-bold">عواصم</h1>
              <p className="mt-2 text-ink-muted">
                {state.settings.totalRounds} دولة هيظهروا واحدة ورا التانية — جاوب باسم عاصمتها في الشات!
              </p>
            </motion.div>
          )}

          {inRound && (
            <motion.div
              key="round"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="grid w-full max-w-6xl grid-cols-[240px_1fr_240px] items-center gap-5"
            >
              <ParticipantsPanel players={state.players} />
              <div className="flex justify-center">
                <CapitalArena state={state} />
              </div>
              <LeaderboardPanel players={state.players} />
            </motion.div>
          )}

          {state.phase === "FINISHED" && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
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
                    <Compass size={40} className="mx-auto mb-3 text-ink-muted" />
                    <p className="text-ink-muted">خلصت الجولات من غير ما حد يسجل نقطة</p>
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
