import type { GuessNumberPlayer, GuessNumberState } from "@tikgames/shared-types";
import { Crown, LockKey, MagnifyingGlass, Trophy, Users } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCountdown } from "../lib/useCountdown";
import { ChatBox, type ChatItem } from "./ChatBox";
import { NoWinnerScreen } from "./NoWinnerScreen";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";
import { RoundCountdown } from "@tikgames/game-3d";

export type { ChatItem };

/** Whoever actually guessed it ranks first regardless of attempts; everyone else by attempts. */
function rankPlayers(players: GuessNumberPlayer[], winnerHandle?: string): GuessNumberPlayer[] {
  return [...players].sort((a, b) => {
    if (a.handle === winnerHandle) return -1;
    if (b.handle === winnerHandle) return 1;
    return b.attempts - a.attempts;
  });
}

function ParticipantsPanel({ players }: { players: GuessNumberPlayer[] }) {
  return (
    <div className="flex h-full w-full flex-col gap-1.5 overflow-y-auto rounded-2xl border border-glass-border bg-canvas-elevated/50 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Users size={16} className="text-accent" weight="fill" />
        بيحاولوا ({players.length})
      </div>
      {players.map((p) => (
        <div key={p.handle} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={30} ring={false} />
          <bdi className="min-w-0 flex-1 truncate text-sm">{p.displayName}</bdi>
          <span className="shrink-0 text-xs text-ink-muted">{p.attempts}</span>
        </div>
      ))}
      {players.length === 0 && <p className="text-sm text-ink-muted">لسه محدش حاول</p>}
    </div>
  );
}

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function LeaderboardPanel({ players, winnerHandle }: { players: GuessNumberPlayer[]; winnerHandle?: string }) {
  const ranked = rankPlayers(players, winnerHandle).slice(0, Math.min(10, players.length));
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
          {i === 0 && <Crown size={14} weight="fill" className="mr-auto shrink-0 text-accent" />}
        </div>
      ))}
      {ranked.length === 0 && <p className="text-sm text-ink-muted">لسه محدش حاول</p>}
    </div>
  );
}

/** The mystery card: hint (if any) + countdown. Never renders the secret — GuessNumberState
 *  simply doesn't carry it until FINISHED, so there's nothing here to accidentally leak. */
function MysteryArena({ state }: { state: GuessNumberState }) {
  const secondsLeft = useCountdown(state.phase === "GUESSING" ? state.phaseEndsAt : null);

  return (
    <div className="relative flex h-[min(72vh,640px)] w-[min(72vh,640px)] flex-col items-center justify-center gap-6 overflow-hidden rounded-3xl border border-glass-border bg-gradient-to-br from-primary/20 via-accent/10 to-canvas-elevated p-10 text-center">
      <motion.div
        animate={{ rotate: [0, -6, 6, -6, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.8 }}
      >
        <LockKey size={64} weight="fill" className="text-accent" />
      </motion.div>

      <p className="rounded-full bg-white/10 px-3 py-1 text-sm text-ink-muted backdrop-blur-sm">فكّر كويس... 🤔</p>

      {state.settings.hint ? (
        <div>
          <p className="text-sm text-ink-muted">تلميح</p>
          <p className="mt-1 text-2xl font-extrabold text-ink">{state.settings.hint}</p>
        </div>
      ) : (
        <p className="text-lg text-ink-muted">من غير تلميح — اكتب تخمينك في الشات!</p>
      )}

      <RoundCountdown secondsLeft={secondsLeft} size={150} />
    </div>
  );
}

export function GuessNumberGameView({
  state,
  chat,
  onNewRound,
}: {
  state: GuessNumberState;
  chat: ChatItem[];
  onNewRound: () => void;
}) {
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
              <MagnifyingGlass size={64} weight="fill" className="mx-auto mb-2 text-accent" />
              <h3 className="text-3xl font-bold">تخمين رقم أو كلمة</h3>
              <p className="mt-3 text-base text-ink-muted">هيبدأ التخمين دلوقتي — اكتب تخمينك في الشات!</p>
            </motion.div>
          )}

          {state.phase === "GUESSING" && (
            <motion.div
              key="round"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="grid h-full w-full grid-cols-1 items-stretch gap-5 lg:grid-cols-[280px_1fr_280px]"
            >
              <ParticipantsPanel players={state.players} />
              <div className="flex items-center justify-center">
                <MysteryArena state={state} />
              </div>
              <div className="flex min-h-0 flex-col gap-4">
                <LeaderboardPanel players={state.players} winnerHandle={state.winner?.handle} />
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
                    subtitle={state.secret ? `الكلمة السرية: ${state.secret}` : undefined}
                  />
                ) : (
                  <NoWinnerScreen
                    message={
                      state.secret
                        ? `خلص الوقت من غير ما حد يخمن صح 😅 — الكلمة السرية كانت: ${state.secret}`
                        : "خلص الوقت من غير ما حد يخمن صح 😅"
                    }
                    onNewRound={onNewRound}
                  />
                )}
              </div>
              <div className="flex min-h-0 flex-col gap-4">
                <LeaderboardPanel players={state.players} winnerHandle={state.winner?.handle} />
                <ChatBox items={chat} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
