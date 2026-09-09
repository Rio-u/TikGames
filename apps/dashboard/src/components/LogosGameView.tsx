import type { LogosPlayer, LogosState } from "@tikgames/shared-types";
import { CheckCircle, SealCheck, Storefront, Trophy, Users } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCountdown } from "../lib/useCountdown";
import { ChatBox, type ChatItem } from "./ChatBox";
import { NoWinnerScreen } from "./NoWinnerScreen";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";
import { RoundCountdown } from "./three/Countdown3D";

export type { ChatItem };

function rankPlayers(players: LogosPlayer[]): LogosPlayer[] {
  return [...players].sort((a, b) => b.score - a.score);
}

function ParticipantsPanel({ players }: { players: LogosPlayer[] }) {
  return (
    <div className="flex h-full w-full flex-col gap-1.5 overflow-y-auto rounded-2xl border border-glass-border bg-canvas-elevated/50 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Users size={16} className="text-amber-400" weight="fill" />
        اللاعبين ({players.length})
      </div>
      {players.map((p) => (
        <div key={p.handle} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={30} ring={false} />
          <bdi className="truncate text-sm">{p.displayName}</bdi>
        </div>
      ))}
      {players.length === 0 && <p className="text-sm text-ink-muted">لسه محدش جاوب</p>}
    </div>
  );
}

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function LeaderboardPanel({ players }: { players: LogosPlayer[] }) {
  const ranked = rankPlayers(players).slice(0, 10);
  return (
    <div className="flex min-h-0 flex-[1.2] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-glass-border bg-canvas-elevated/50 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Trophy size={16} className="text-amber-400" weight="fill" />
        الترتيب
      </div>
      {ranked.map((p, i) => (
        <div key={p.handle} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${i < 3 ? "bg-white/5" : ""}`}>
          <span className={`w-4 shrink-0 text-center text-xs font-bold ${i < 3 ? MEDAL_COLORS[i] : "text-ink-muted"}`}>
            {i + 1}
          </span>
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={30} ring={false} />
          <bdi className="truncate text-sm">{p.displayName}</bdi>
          <span className="mr-auto shrink-0 text-sm font-bold text-amber-400">{p.score}</span>
        </div>
      ))}
      {ranked.length === 0 && <p className="text-sm text-ink-muted">لسه محدش سجل نقطة</p>}
    </div>
  );
}

/** Progress bar for this game's one real difference from Trivia: a fixed round count. */
function RoundProgress({ round, totalRounds }: { round: number; totalRounds: number }) {
  const pct = Math.min(100, Math.round((round / totalRounds) * 100));
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-1.5">
      <p className="text-sm font-semibold text-white/85">
        الجولة {round} / {totalRounds}
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
          className="h-full rounded-full bg-gradient-to-l from-amber-400 to-orange-500"
        />
      </div>
    </div>
  );
}

/**
 * The logo itself, on a bright white "sticker" tile — unlike Flags' dark waving rectangle and
 * Capitals' dark medallion, brand marks read correctly (and look like an actual product/app
 * tile) only against light space, so this card intentionally breaks from the app's dark theme.
 * A slow shine sweep plays across it for a little extra shimmer.
 */
function LogoTile({ slug, size }: { slug: string; size: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="relative overflow-hidden rounded-3xl bg-white p-[14%] shadow-[0_18px_40px_rgba(251,191,36,0.25)] ring-4 ring-amber-300/60"
    >
      <img src={`/logos/${slug}.svg`} alt="" draggable={false} className="h-full w-full object-contain" />
      <motion.div
        animate={{ x: ["-130%", "180%"] }}
        transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-black/10 to-transparent"
      />
    </div>
  );
}

/**
 * The question card: brand logo tile, a countdown while it's live, and — once someone guesses or
 * time runs out — a "verified" stamp reveal with the brand's name before the next logo deals (or
 * the game auto-finishes on the last round).
 */
function LogoArena({ state }: { state: LogosState }) {
  const secondsLeft = useCountdown(state.phase === "QUESTION" ? state.phaseEndsAt : null);
  const revealed = state.phase === "REVEALED";

  return (
    <div className="relative flex h-[min(72vh,640px)] w-[min(72vh,640px)] flex-col items-center justify-center gap-6 overflow-hidden rounded-3xl border border-glass-border bg-gradient-to-br from-amber-500/10 via-canvas-elevated to-canvas-elevated p-10">
      <motion.div
        animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.08, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-10 rounded-full bg-amber-400/20 blur-3xl"
      />

      <RoundProgress round={state.round} totalRounds={state.settings.totalRounds} />

      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="logo"
            initial={{ opacity: 0, scale: 0.7, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="flex flex-col items-center gap-4"
          >
            {state.logoSlug && <LogoTile slug={state.logoSlug} size={260} />}
            <p className="flex items-center gap-1.5 text-xl font-bold text-white">
              <Storefront size={22} weight="fill" className="text-amber-400" />
              الماركة دي إيه؟
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="flex flex-col items-center gap-4"
          >
            {state.logoSlug && <LogoTile slug={state.logoSlug} size={170} />}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: -8 }}
              transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.1 }}
              className="flex items-center gap-2 rounded-2xl border-2 border-amber-400 px-4 py-1.5"
            >
              <SealCheck size={22} weight="fill" className="text-amber-400" />
              <p className="text-2xl font-extrabold text-amber-300">{state.brandName}</p>
            </motion.div>
            {state.lastWinner ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.25 }}
                className="mt-1 flex items-center gap-2 rounded-full bg-emerald-400/15 px-5 py-2 ring-1 ring-emerald-400/40"
              >
                <CheckCircle size={20} weight="fill" className="text-emerald-400" />
                <PlayerAvatar displayName={state.lastWinner.displayName} avatarUrl={state.lastWinner.avatarUrl} size={30} ring={false} />
                <bdi className="text-base font-semibold text-white">{state.lastWinner.displayName}</bdi>
                <span className="text-sm text-emerald-300">+1</span>
              </motion.div>
            ) : (
              <p className="text-base text-white/60">محدش عرفها 😅</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!revealed && <RoundCountdown secondsLeft={secondsLeft} size={150} />}
    </div>
  );
}

export function LogosGameView({
  state,
  chat,
  onNewRound,
}: {
  state: LogosState;
  chat: ChatItem[];
  onNewRound: () => void;
}) {
  const inRound = state.phase === "QUESTION" || state.phase === "REVEALED";

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {state.phase === "WAITING_TO_START" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl rounded-3xl border border-glass-border bg-canvas-elevated/40 p-12 text-center"
            >
              <Storefront size={64} weight="fill" className="mx-auto mb-2 text-amber-400" />
              <h3 className="text-3xl font-bold">شعارات</h3>
              <p className="mt-3 text-base text-ink-muted">
                {state.settings.totalRounds} شعار ماركة هيظهروا واحد ورا التاني — هيبدأ أول شعار دلوقتي، جاوب باسم
                الماركة في الشات!
              </p>
            </motion.div>
          )}

          {inRound && (
            <motion.div
              key="round"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="grid h-full w-full grid-cols-1 items-stretch gap-5 lg:grid-cols-[280px_1fr_280px]"
            >
              <ParticipantsPanel players={state.players} />
              <div className="flex items-center justify-center">
                <LogoArena state={state} />
              </div>
              <div className="flex min-h-0 flex-col gap-4">
                <LeaderboardPanel players={state.players} />
                <ChatBox items={chat} />
              </div>
            </motion.div>
          )}

          {state.phase === "FINISHED" && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="relative grid h-full w-full grid-cols-1 items-stretch gap-5 lg:grid-cols-[280px_1fr_280px]"
            >
              <ParticipantsPanel players={state.players} />
              <div className="flex flex-col items-center justify-center gap-6 text-center">
                {state.winner ? (
                  <WinnerCelebration
                    displayName={state.winner.displayName}
                    avatarUrl={state.winner.avatarUrl}
                    handle={state.winner.handle}
                    subtitle={`${state.winner.score} نقطة`}
                  />
                ) : (
                  <NoWinnerScreen message="خلصت الشعارات من غير ما حد يسجل نقطة 😅" onNewRound={onNewRound} />
                )}
              </div>
              <div className="flex min-h-0 flex-col gap-4">
                <LeaderboardPanel players={state.players} />
                <ChatBox items={chat} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
