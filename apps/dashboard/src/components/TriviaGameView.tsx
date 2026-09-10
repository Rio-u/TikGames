import type { TriviaPlayer, TriviaState } from "@tikgames/shared-types";
import { Question, Trophy, Users } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCountdown } from "../lib/useCountdown";
import { ChatBox, type ChatItem } from "./ChatBox";
import { NoWinnerScreen } from "./NoWinnerScreen";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";
import { RoundCountdown } from "@tikgames/game-3d";

export type { ChatItem };

function rankPlayers(players: TriviaPlayer[]): TriviaPlayer[] {
  return [...players].sort((a, b) => b.score - a.score);
}

function ParticipantsPanel({ players }: { players: TriviaPlayer[] }) {
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
      {players.length === 0 && <p className="text-sm text-ink-muted">لسه محدش جاوب</p>}
    </div>
  );
}

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function LeaderboardPanel({ players }: { players: TriviaPlayer[] }) {
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
 * The question card: a random background per question (server-picked), a countdown while the
 * question is live, and — once someone answers or time runs out — a brief reveal of the correct
 * answer before the next question deals.
 */
function QuestionArena({ state }: { state: TriviaState }) {
  const secondsLeft = useCountdown(state.phase === "QUESTION" ? state.phaseEndsAt : null);
  const revealed = state.phase === "REVEALED";

  return (
    <div className="relative aspect-video w-full max-w-[min(100%,1500px)] overflow-hidden rounded-3xl border border-glass-border">
      {state.backgroundUrl ? (
        <img src={state.backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/10 to-canvas-elevated" />
      )}
      {/* The artwork already darkens its own middle for text, so this only has to lift
          contrast a touch — the heavy scrim it replaced buried the frame it sits on. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

      <div className="absolute inset-x-[12%] bottom-[21%] top-[23%] z-10 flex flex-col gap-4 items-center justify-center text-center">
        <p className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/80 backdrop-blur-sm">سؤال {state.round}</p>

        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.h2
              key="question"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-2xl font-extrabold leading-relaxed text-white"
            >
              {state.question}
            </motion.h2>
          ) : (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <p className="text-base text-white/70">الإجابة الصح</p>
              <p className="text-3xl font-extrabold text-accent">{state.correctAnswer}</p>
              {state.lastWinner ? (
                <div className="mt-1 flex items-center gap-2 rounded-full bg-accent/20 px-5 py-2">
                  <PlayerAvatar displayName={state.lastWinner.displayName} avatarUrl={state.lastWinner.avatarUrl} size={30} ring={false} />
                  <bdi className="text-base font-semibold text-white">{state.lastWinner.displayName}</bdi>
                  <span className="text-sm text-white/70">+1</span>
                </div>
              ) : (
                <p className="text-base text-white/60">محدش جاوب صح 😅</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!revealed && secondsLeft !== null && (
          <RoundCountdown secondsLeft={secondsLeft} size={150} />
        )}
      </div>
    </div>
  );
}

export function TriviaGameView({
  state,
  chat,
  onNewRound,
}: {
  state: TriviaState;
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
              <Question size={64} weight="fill" className="mx-auto mb-2 text-accent" />
              <h3 className="text-3xl font-bold">أسئلة عامة</h3>
              <p className="mt-3 text-base text-ink-muted">هيبدأ أول سؤال دلوقتي — جاوب في الشات!</p>
            </motion.div>
          )}

          {inRound && (
            <motion.div
              key="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid h-full w-full grid-cols-1 items-stretch gap-3 lg:grid-cols-[200px_1fr_200px]"
            >
              <ParticipantsPanel players={state.players} />
              <div className="flex items-center justify-center">
                <QuestionArena state={state} />
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="relative grid h-full w-full grid-cols-1 items-stretch gap-3 lg:grid-cols-[200px_1fr_200px]"
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
