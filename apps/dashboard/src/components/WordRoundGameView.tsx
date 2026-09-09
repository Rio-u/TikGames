import type { WordRoundFoundWord, WordRoundPlayer, WordRoundState } from "@tikgames/shared-types";
import { CheckCircle, PuzzlePiece, Trophy, Users } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCountdown } from "../lib/useCountdown";
import { ChatBox, type ChatItem } from "./ChatBox";
import { NoWinnerScreen } from "./NoWinnerScreen";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";
import { RoundCountdown } from "@tikgames/game-3d";

export type { ChatItem };

function rankPlayers(players: WordRoundPlayer[]): WordRoundPlayer[] {
  return [...players].sort((a, b) => b.score - a.score);
}

function ParticipantsPanel({ players }: { players: WordRoundPlayer[] }) {
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
      {players.length === 0 && <p className="text-sm text-ink-muted">لسه محدش لقى كلمة</p>}
    </div>
  );
}

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function LeaderboardPanel({ players }: { players: WordRoundPlayer[] }) {
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

/** Progress bar for this game's fixed round count, same shape as Flags/Capitals/Logos. */
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
          ? "grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-primary text-4xl font-extrabold text-white shadow-glow-md ring-2 ring-white/40"
          : "grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-glass-border bg-canvas-elevated/70 text-2xl font-bold text-white/85"
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
    <div className="flex flex-wrap items-center justify-center gap-3">
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
  const recent = [...foundWords].reverse().slice(0, 12);
  return (
    <div className="flex min-h-[2.5rem] w-full max-w-md flex-wrap justify-center gap-1.5">
      <AnimatePresence>
        {recent.map((f) => (
          <motion.div
            key={f.word}
            initial={{ opacity: 0, scale: 0.6, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 ring-1 ring-emerald-400/40"
          >
            <CheckCircle size={14} weight="fill" className="text-emerald-400" />
            <bdi className="text-sm font-bold text-white">{f.word}</bdi>
            <span className="text-xs text-emerald-300">+{f.points}</span>
          </motion.div>
        ))}
      </AnimatePresence>
      {recent.length === 0 && <p className="text-sm text-white/60">محدش لقى كلمة لسه...</p>}
    </div>
  );
}

function WordReview({ allWords, foundWords }: { allWords: string[]; foundWords: WordRoundFoundWord[] }) {
  const foundSet = new Set(foundWords.map((f) => f.word));
  return (
    <div className="flex max-w-lg flex-wrap justify-center gap-2">
      {allWords.map((w) => {
        const found = foundSet.has(w);
        return (
          <span
            key={w}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
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
    <div className="relative flex h-[min(72vh,640px)] w-[min(90vh,760px)] flex-col items-center justify-center gap-6 overflow-hidden rounded-3xl border border-glass-border bg-gradient-to-br from-primary/15 via-canvas-elevated to-canvas-elevated p-10">
      <motion.div
        animate={{ opacity: [0.4, 0.75, 0.4], scale: [1, 1.08, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-10 rounded-full bg-primary/30 blur-3xl"
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
            className="relative flex flex-col items-center gap-5"
          >
            <LetterBoard centralLetter={state.centralLetter} extraLetters={state.extraLetters} />
            <p className="text-lg font-bold text-white">اكتب أي كلمة فيها الحرف المميز في الشات!</p>
            <FoundWordsFeed foundWords={state.foundWords} />
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
            <p className="text-base font-semibold text-white/80">كل الكلمات الصحيحة:</p>
            <WordReview allWords={state.allWords ?? []} foundWords={state.foundWords} />
          </motion.div>
        )}
      </AnimatePresence>

      {!revealed && <RoundCountdown secondsLeft={secondsLeft} size={150} />}
    </div>
  );
}

export function WordRoundGameView({
  state,
  chat,
  onNewRound,
}: {
  state: WordRoundState;
  chat: ChatItem[];
  onNewRound: () => void;
}) {
  const inRound = state.phase === "PUZZLE" || state.phase === "REVEALED";

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
              <PuzzlePiece size={64} weight="fill" className="mx-auto mb-2 text-accent" />
              <h3 className="text-3xl font-bold">جولة كلمات</h3>
              <p className="mt-3 text-base text-ink-muted">
                {state.settings.totalRounds} جولة هتظهر واحدة ورا التانية — كل جولة فيها حرف مميز وحروف زيادة، واللي يكتب
                كلمة صحيحة فيها الحرف المميز ياخد نقط على قد طول الكلمة.
              </p>
            </motion.div>
          )}

          {inRound && (
            <motion.div
              key="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid h-full w-full grid-cols-1 items-stretch gap-5 lg:grid-cols-[280px_1fr_280px]"
            >
              <ParticipantsPanel players={state.players} />
              <div className="flex items-center justify-center">
                <PuzzleArena state={state} />
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
                  <NoWinnerScreen message="خلصت الجولات من غير ما حد يسجل نقطة 😅" onNewRound={onNewRound} />
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
