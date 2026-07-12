import type { SpeedWordPlayer, SpeedWordState } from "@tikgames/shared-types";
import { Lightning, Trophy, Users } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCountdown } from "../lib/useCountdown";
import { ChatBox, type ChatItem } from "./ChatBox";
import { NoWinnerScreen } from "./NoWinnerScreen";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";

export type { ChatItem };

function rankPlayers(players: SpeedWordPlayer[]): SpeedWordPlayer[] {
  return [...players].sort((a, b) => b.score - a.score);
}

function ParticipantsPanel({ players }: { players: SpeedWordPlayer[] }) {
  return (
    <div className="flex h-full w-full flex-col gap-1.5 overflow-y-auto rounded-2xl border border-glass-border bg-canvas-elevated/50 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Users size={16} className="text-accent" weight="fill" />
        اللاعبين ({players.length})
      </div>
      {players.map((p) => (
        <div key={p.handle} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={30} ring={false} />
          <bdi className="truncate text-sm">{p.displayName}</bdi>
        </div>
      ))}
      {players.length === 0 && <p className="text-sm text-ink-muted">لسه محدش كتب حاجة</p>}
    </div>
  );
}

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function LeaderboardPanel({ players }: { players: SpeedWordPlayer[] }) {
  const ranked = rankPlayers(players).slice(0, 10);
  return (
    <div className="flex min-h-0 flex-[1.2] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-glass-border bg-canvas-elevated/50 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Trophy size={16} className="text-accent" weight="fill" />
        الترتيب
      </div>
      {ranked.map((p, i) => (
        <div key={p.handle} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${i < 3 ? "bg-white/5" : ""}`}>
          <span className={`w-4 shrink-0 text-center text-xs font-bold ${i < 3 ? MEDAL_COLORS[i] : "text-ink-muted"}`}>
            {i + 1}
          </span>
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={30} ring={false} />
          <bdi className="truncate text-sm">{p.displayName}</bdi>
          <span className="mr-auto shrink-0 text-sm font-bold text-accent">{p.score}</span>
        </div>
      ))}
      {ranked.length === 0 && <p className="text-sm text-ink-muted">لسه محدش سجل نقطة</p>}
    </div>
  );
}

/**
 * The word card: a random background per word (server-picked), a countdown while the word is
 * live, and — once someone types it right or time runs out — a brief reveal of who won before the
 * next word deals. Unlike Trivia there's no separate "correct answer" to hide: the word shown *is*
 * the target text, so REVEALED just restyles the same word and announces the winner.
 */
function WordArena({ state }: { state: SpeedWordState }) {
  const secondsLeft = useCountdown(state.phase === "QUESTION" ? state.phaseEndsAt : null);
  const revealed = state.phase === "REVEALED";

  return (
    <div className="relative h-[min(72vh,640px)] w-[min(72vh,640px)] overflow-hidden rounded-3xl border border-glass-border">
      {state.backgroundUrl ? (
        <img src={state.backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/10 to-canvas-elevated" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-8 p-10 text-center">
        <p className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/80 backdrop-blur-sm">كلمة {state.round}</p>

        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div key="word" className="relative flex items-center justify-center px-4">
              <motion.span
                className="absolute h-48 w-full rounded-full bg-accent/40 blur-3xl"
                animate={{ opacity: [0.35, 0.75, 0.35], scale: [0.85, 1.05, 0.85] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.h2
                initial={{ opacity: 0, scale: 0.35, rotate: -6 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.6, rotate: 6 }}
                transition={{ type: "spring", stiffness: 260, damping: 15 }}
                dir="auto"
                className="relative break-words text-6xl font-black leading-tight text-white sm:text-7xl"
                style={{ textShadow: "0 0 40px rgba(192,132,252,0.9), 0 0 80px rgba(124,58,237,0.6)" }}
              >
                {state.word}
              </motion.h2>
            </motion.div>
          ) : (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <p
                className="text-4xl font-black text-accent sm:text-5xl"
                dir="auto"
                style={{ textShadow: "0 0 30px rgba(192,132,252,0.7)" }}
              >
                {state.word}
              </p>
              {state.lastWinner ? (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                  className="mt-1 flex items-center gap-2 rounded-full bg-accent/20 px-5 py-2 shadow-glow-sm"
                >
                  <PlayerAvatar displayName={state.lastWinner.displayName} avatarUrl={state.lastWinner.avatarUrl} size={30} ring={false} />
                  <bdi className="text-base font-semibold text-white">{state.lastWinner.displayName}</bdi>
                  <span className="text-sm text-white/70">+1</span>
                </motion.div>
              ) : (
                <p className="text-base text-white/60">محدش كتبها صح 😅</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!revealed && secondsLeft !== null && (
          <AnimatePresence mode="popLayout">
            <motion.p
              key={secondsLeft}
              initial={{ opacity: 0, scale: 1.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="text-6xl font-extrabold text-white"
            >
              {secondsLeft}
            </motion.p>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

export function SpeedWordGameView({
  state,
  chat,
  onNewRound,
}: {
  state: SpeedWordState;
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
              <Lightning size={64} weight="fill" className="mx-auto mb-2 text-accent" />
              <h3 className="text-3xl font-bold">أسرع</h3>
              <p className="mt-3 text-base text-ink-muted">هتظهر أول كلمة دلوقتي — اكتبها بالظبط في الشات وكن الأسرع!</p>
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
                <WordArena state={state} />
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
                  <NoWinnerScreen message="خلصت اللعبة من غير ما حد يسجل نقطة 😅" onNewRound={onNewRound} />
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
