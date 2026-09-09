import type { SpeedWordPlayer, SpeedWordState } from "@tikgames/shared-types";
import { Crown, Lightning, Trophy, Users } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCountdown } from "../lib/useCountdown";
import { Branding } from "./Branding";
import { ChatStrip, type ChatItem } from "./ChatStrip";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";
import { RoundCountdown } from "@tikgames/game-3d";

export type { ChatItem };

function rankPlayers(players: SpeedWordPlayer[]): SpeedWordPlayer[] {
  return [...players].sort((a, b) => b.score - a.score);
}

function ParticipantsPanel({ players }: { players: SpeedWordPlayer[] }) {
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
      {players.length === 0 && <p className="text-xs text-ink-muted">لسه محدش كتب حاجة</p>}
    </div>
  );
}

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function LeaderboardPanel({ players }: { players: SpeedWordPlayer[] }) {
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

/**
 * The word card: a random background per word (server-picked, so it's consistent across every
 * viewer of this same broadcast), a countdown while the word is live, and — once someone types it
 * right or time runs out — a brief reveal of who won before the next word deals.
 */
function WordArena({ state }: { state: SpeedWordState }) {
  const secondsLeft = useCountdown(state.phase === "QUESTION" ? state.phaseEndsAt : null);
  const revealed = state.phase === "REVEALED";

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-glass-border shadow-glass">
      {state.backgroundUrl ? (
        <img src={state.backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/10 to-canvas-soft" />
      )}
      {/* The artwork already darkens its own middle for text, so this only has to lift
          contrast a touch — the heavy scrim it replaced buried the frame it sits on. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

      <div className="absolute inset-x-[12%] bottom-[21%] top-[23%] z-10 flex flex-col gap-4 items-center justify-center text-center">
        <p className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">كلمة {state.round}</p>

        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div key="word" className="relative flex items-center justify-center px-2">
              <motion.span
                className="absolute h-32 w-full rounded-full bg-accent/40 blur-3xl"
                animate={{ opacity: [0.35, 0.75, 0.35], scale: [0.85, 1.05, 0.85] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.h1
                initial={{ opacity: 0, scale: 0.35, rotate: -6 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.6, rotate: 6 }}
                transition={{ type: "spring", stiffness: 260, damping: 15 }}
                dir="auto"
                className="relative break-words text-4xl font-black leading-tight text-white sm:text-5xl"
                style={{ textShadow: "0 0 32px rgba(192,132,252,0.9), 0 0 64px rgba(124,58,237,0.6)" }}
              >
                {state.word}
              </motion.h1>
            </motion.div>
          ) : (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <p
                className="text-3xl font-black text-accent"
                dir="auto"
                style={{ textShadow: "0 0 24px rgba(192,132,252,0.7)" }}
              >
                {state.word}
              </p>
              {state.lastWinner ? (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                  className="mt-1 flex items-center gap-2 rounded-full bg-accent/20 px-4 py-1.5 shadow-glow-sm"
                >
                  <PlayerAvatar displayName={state.lastWinner.displayName} avatarUrl={state.lastWinner.avatarUrl} size={24} ring={false} />
                  <bdi className="text-sm font-semibold text-white">{state.lastWinner.displayName}</bdi>
                  <span className="text-xs text-white/70">+1</span>
                </motion.div>
              ) : (
                <p className="text-sm text-white/60">محدش كتبها صح 😅</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!revealed && <RoundCountdown secondsLeft={secondsLeft} size={120} />}
      </div>
    </div>
  );
}

export function SpeedWordOverlay({ state, chat }: { state: SpeedWordState | null; chat: ChatItem[] }) {
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
              <Lightning size={48} weight="fill" className="mx-auto mb-2 text-accent" />
              <h1 className="text-2xl font-bold">أسرع</h1>
              <p className="mt-2 text-ink-muted">هتظهر أول كلمة دلوقتي — اكتبها بالظبط في الشات!</p>
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
                <WordArena state={state} />
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
                    <Crown size={40} className="mx-auto mb-3 text-ink-muted" />
                    <p className="text-ink-muted">خلصت اللعبة من غير ما حد يسجل نقطة</p>
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
