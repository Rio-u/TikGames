import type { GuessNumberPlayer, GuessNumberState } from "@tikgames/shared-types";
import { Crown, LockKey, MagnifyingGlass, Trophy, Users } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCountdown } from "../lib/useCountdown";
import { Branding } from "./Branding";
import { ChatStrip, type ChatItem } from "./ChatStrip";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";

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
    <div className="flex max-h-[440px] flex-col gap-1.5 overflow-y-auto rounded-3xl border border-glass-border bg-canvas-soft/70 p-4 shadow-glass backdrop-blur-2xl">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Users size={16} className="text-accent" weight="fill" />
        بيحاولوا ({players.length})
      </div>
      {players.map((p) => (
        <div key={p.handle} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={26} ring={false} />
          <bdi className="min-w-0 flex-1 truncate text-xs">{p.displayName}</bdi>
          <span className="shrink-0 text-[10px] text-ink-muted">{p.attempts}</span>
        </div>
      ))}
      {players.length === 0 && <p className="text-xs text-ink-muted">لسه محدش حاول</p>}
    </div>
  );
}

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function LeaderboardPanel({ players, winnerHandle }: { players: GuessNumberPlayer[]; winnerHandle?: string }) {
  const ranked = rankPlayers(players, winnerHandle).slice(0, 10);
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
          {i === 0 && <Crown size={14} weight="fill" className="mr-auto shrink-0 text-accent" />}
        </div>
      ))}
      {ranked.length === 0 && <p className="text-xs text-ink-muted">لسه محدش حاول</p>}
    </div>
  );
}

/** The mystery card: hint (if any) + countdown. Never renders the secret — GuessNumberState
 *  simply doesn't carry it until FINISHED, so there's nothing here to accidentally leak. */
function MysteryArena({ state }: { state: GuessNumberState }) {
  const secondsLeft = useCountdown(state.phase === "GUESSING" ? state.phaseEndsAt : null);

  return (
    <div className="relative flex h-[440px] w-[440px] flex-col items-center justify-center gap-5 overflow-hidden rounded-3xl border border-glass-border bg-gradient-to-br from-primary/20 via-accent/10 to-canvas-soft p-8 text-center shadow-glass">
      <motion.div
        animate={{ rotate: [0, -6, 6, -6, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.8 }}
      >
        <LockKey size={48} weight="fill" className="text-accent" />
      </motion.div>

      <p className="rounded-full bg-white/10 px-3 py-1 text-xs text-ink-muted backdrop-blur-sm">فكّر كويس... 🤔</p>

      {state.settings.hint ? (
        <div>
          <p className="text-xs text-ink-muted">تلميح</p>
          <p className="mt-1 text-xl font-extrabold text-ink">{state.settings.hint}</p>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">من غير تلميح — اكتب تخمينك في الشات!</p>
      )}

      {secondsLeft !== null && <p className="text-4xl font-extrabold text-white">{secondsLeft}</p>}
    </div>
  );
}

export function GuessNumberOverlay({ state, chat }: { state: GuessNumberState | null; chat: ChatItem[] }) {
  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Branding />
      </div>
    );
  }

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
              <MagnifyingGlass size={48} weight="fill" className="mx-auto mb-2 text-accent" />
              <h1 className="text-2xl font-bold">تخمين رقم أو كلمة</h1>
              <p className="mt-2 text-ink-muted">هيبدأ التخمين دلوقتي — اكتب تخمينك في الشات!</p>
            </motion.div>
          )}

          {state.phase === "GUESSING" && (
            <motion.div
              key="round"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="grid w-full max-w-6xl grid-cols-[240px_1fr_240px] items-center gap-5"
            >
              <ParticipantsPanel players={state.players} />
              <div className="flex justify-center">
                <MysteryArena state={state} />
              </div>
              <LeaderboardPanel players={state.players} winnerHandle={state.winner?.handle} />
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
                    subtitle={state.secret ? `الكلمة السرية: ${state.secret}` : undefined}
                  />
                ) : (
                  <div className="rounded-3xl border border-glass-border bg-canvas-soft/70 p-8 shadow-glass backdrop-blur-2xl">
                    <Crown size={40} className="mx-auto mb-3 text-ink-muted" />
                    <p className="text-ink-muted">خلص الوقت من غير ما حد يخمن صح 😅</p>
                    {state.secret && (
                      <p className="mt-2 text-base font-bold text-accent">الكلمة السرية كانت: {state.secret}</p>
                    )}
                  </div>
                )}
              </div>
              <LeaderboardPanel players={state.players} winnerHandle={state.winner?.handle} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ChatStrip items={chat} />
      <Branding />
    </div>
  );
}
