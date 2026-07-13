import type { WordRoundFoundWord, WordRoundPlayer, WordRoundState } from "@tikgames/shared-types";
import { CheckCircle, PuzzlePiece, Trophy, Users } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCountdown } from "../lib/useCountdown";
import { Branding } from "./Branding";
import { ChatStrip, type ChatItem } from "./ChatStrip";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";

export type { ChatItem };

function rankPlayers(players: WordRoundPlayer[]): WordRoundPlayer[] {
  return [...players].sort((a, b) => b.score - a.score);
}

function ParticipantsPanel({ players }: { players: WordRoundPlayer[] }) {
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
      {players.length === 0 && <p className="text-xs text-ink-muted">لسه محدش لقى كلمة</p>}
    </div>
  );
}

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function LeaderboardPanel({ players }: { players: WordRoundPlayer[] }) {
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

/** Progress bar for this game's fixed round count, same shape as Flags/Capitals/Logos. */
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

function LetterTile({ letter, central }: { letter: string; central?: boolean }) {
  return (
    <div
      className={
        central
          ? "grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-primary text-3xl font-extrabold text-white shadow-glow-md ring-2 ring-white/40"
          : "grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-glass-border bg-canvas-soft/70 text-xl font-bold text-white/85"
      }
    >
      {letter}
    </div>
  );
}

/** Central letter in the middle, extra letters split on either side — every valid word must
 *  contain the central (accent-highlighted) letter. */
function LetterBoard({ centralLetter, extraLetters }: { centralLetter: string | null; extraLetters: string[] }) {
  const half = Math.ceil(extraLetters.length / 2);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {extraLetters.slice(0, half).map((l, i) => (
        <LetterTile key={`a-${i}-${l}`} letter={l} />
      ))}
      {centralLetter && <LetterTile letter={centralLetter} central />}
      {extraLetters.slice(half).map((l, i) => (
        <LetterTile key={`b-${i}-${l}`} letter={l} />
      ))}
    </div>
  );
}

function FoundWordsFeed({ foundWords }: { foundWords: WordRoundFoundWord[] }) {
  const recent = [...foundWords].reverse().slice(0, 8);
  return (
    <div className="flex min-h-[2rem] w-full max-w-[320px] flex-wrap justify-center gap-1.5">
      <AnimatePresence>
        {recent.map((f) => (
          <motion.div
            key={f.word}
            initial={{ opacity: 0, scale: 0.6, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 ring-1 ring-emerald-400/40"
          >
            <CheckCircle size={12} weight="fill" className="text-emerald-400" />
            <bdi className="text-xs font-bold text-white">{f.word}</bdi>
            <span className="text-[10px] text-emerald-300">+{f.points}</span>
          </motion.div>
        ))}
      </AnimatePresence>
      {recent.length === 0 && <p className="text-xs text-white/60">محدش لقى كلمة لسه...</p>}
    </div>
  );
}

function WordReview({ allWords, foundWords }: { allWords: string[]; foundWords: WordRoundFoundWord[] }) {
  const foundSet = new Set(foundWords.map((f) => f.word));
  return (
    <div className="flex max-w-[380px] flex-wrap justify-center gap-1.5">
      {allWords.map((w) => {
        const found = foundSet.has(w);
        return (
          <span
            key={w}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              found ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/40" : "bg-white/5 text-white/40 line-through"
            }`}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
}

/** The puzzle card: letter board + countdown while a round is live, then a brief review of every
 *  valid word (found ones highlighted) before the next puzzle deals or the game auto-finishes. */
function PuzzleArena({ state }: { state: WordRoundState }) {
  const secondsLeft = useCountdown(state.phase === "PUZZLE" ? state.phaseEndsAt : null);
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
            key="puzzle"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="relative flex flex-col items-center gap-4"
          >
            <LetterBoard centralLetter={state.centralLetter} extraLetters={state.extraLetters} />
            <p className="text-sm font-bold text-white">اكتب أي كلمة فيها الحرف المميز في الشات!</p>
            <FoundWordsFeed foundWords={state.foundWords} />
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
            <p className="text-xs font-semibold text-white/80">كل الكلمات الصحيحة:</p>
            <WordReview allWords={state.allWords ?? []} foundWords={state.foundWords} />
          </motion.div>
        )}
      </AnimatePresence>

      {!revealed && secondsLeft !== null && <p className="text-4xl font-extrabold text-white">{secondsLeft}</p>}
    </div>
  );
}

export function WordRoundOverlay({ state, chat }: { state: WordRoundState | null; chat: ChatItem[] }) {
  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Branding />
      </div>
    );
  }

  const inRound = state.phase === "PUZZLE" || state.phase === "REVEALED";

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
              <PuzzlePiece size={48} weight="fill" className="mx-auto mb-2 text-accent" />
              <h1 className="text-2xl font-bold">جولة كلمات</h1>
              <p className="mt-2 text-ink-muted">
                كل جولة فيها حرف مميز وحروف زيادة — اكتب كلمة صحيحة فيها الحرف المميز في الشات وخد نقط على قد طولها!
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
                <PuzzleArena state={state} />
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
                    <PuzzlePiece size={40} className="mx-auto mb-3 text-ink-muted" />
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
