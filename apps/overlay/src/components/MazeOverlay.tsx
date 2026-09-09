import type { MazePlayer, MazeState } from "@tikgames/shared-types";
import { Crown, Flag, Users } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useCountdown } from "../lib/useCountdown";
import { Branding } from "./Branding";
import { ChatStrip, type ChatItem } from "./ChatStrip";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";

export type { ChatItem };

function PlayerChip({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.6, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-canvas-elevated/80 py-1.5 pl-4 pr-1.5 text-sm font-medium text-ink"
    >
      <bdi>{name}</bdi>
      <PlayerAvatar displayName={name} avatarUrl={avatarUrl} size={24} ring={false} />
    </motion.span>
  );
}

function ParticipantsPanel({ players }: { players: MazePlayer[] }) {
  return (
    <div className="flex max-h-[60vh] w-full flex-col gap-1.5 overflow-y-auto rounded-2xl border border-glass-border bg-canvas-soft/70 p-4 shadow-glass backdrop-blur-2xl">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Users size={16} className="text-accent" weight="fill" />
        اللاعبين ({players.length})
      </div>
      {players.map((p) => (
        <div key={p.handle} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={28} ring={false} />
          <bdi className="truncate text-sm">{p.displayName}</bdi>
          {p.hasUsedTrap && <span className="mr-auto shrink-0 text-xs opacity-50">🕳️</span>}
        </div>
      ))}
      {players.length === 0 && <p className="text-sm text-ink-muted">لسه محدش دخل</p>}
    </div>
  );
}

const LEGEND: Array<{ digit: string; label: string; arrow: string }> = [
  { digit: "1", label: "فوق", arrow: "⬆️" },
  { digit: "2", label: "يمين", arrow: "➡️" },
  { digit: "3", label: "تحت", arrow: "⬇️" },
  { digit: "4", label: "شمال", arrow: "⬅️" },
];

function MoveLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-glass-border bg-canvas-soft/70 px-4 py-2 text-sm shadow-glass backdrop-blur-2xl">
      {LEGEND.map((l) => (
        <span key={l.digit} className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 font-semibold">
          <span className="text-accent">{l.digit}</span>
          {l.arrow}
          <span className="text-xs font-normal text-ink-muted">{l.label}</span>
        </span>
      ))}
      <span className="flex items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 font-semibold text-amber-300">
        !فخ<span className="text-xs font-normal text-ink-muted">فخ مكانك</span>
      </span>
    </div>
  );
}

function cellBorderClasses(bits: number): string {
  const classes: string[] = [];
  if ((bits & 1) === 0) classes.push("border-t-2");
  if ((bits & 2) === 0) classes.push("border-r-2");
  if ((bits & 4) === 0) classes.push("border-b-2");
  if ((bits & 8) === 0) classes.push("border-l-2");
  return classes.join(" ");
}

function MazeBoard({ state }: { state: MazeState }) {
  const { size, cells } = state.grid;
  const [trapFlash, setTrapFlash] = useState<{ atX: number; atY: number; key: number } | null>(null);

  useEffect(() => {
    if (!state.lastTrap) return;
    const flash = { atX: state.lastTrap.atX, atY: state.lastTrap.atY, key: Date.now() };
    setTrapFlash(flash);
    const timeout = setTimeout(() => setTrapFlash((cur) => (cur?.key === flash.key ? null : cur)), 1100);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lastTrap]);

  return (
    <div dir="ltr" className="relative h-[min(56vh,520px)] w-[min(56vh,520px)]">
      <div
        className="absolute inset-0 grid overflow-hidden rounded-2xl border-2 border-glass-border bg-canvas-soft/70 shadow-glass backdrop-blur-2xl"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)` }}
      >
        {cells.map((row, y) =>
          row.map((bits, x) => (
            <div key={`${x}-${y}`} className={`relative border-accent/30 ${cellBorderClasses(bits)}`}>
              {x === state.exit.x && y === state.exit.y && (
                <span className="absolute inset-0 flex items-center justify-center text-[min(3.4vh,28px)]">🏆</span>
              )}
              {x === state.start.x && y === state.start.y && (
                <span className="absolute left-1 top-1 text-[10px] opacity-40">
                  <Flag size={11} weight="fill" />
                </span>
              )}
            </div>
          )),
        )}
      </div>

      {state.players.map((p) => (
        <motion.div
          key={p.handle}
          animate={{ left: `${((p.x + 0.5) / size) * 100}%`, top: `${((p.y + 0.5) / size) * 100}%` }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
        >
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={Math.max(16, 210 / size)} />
        </motion.div>
      ))}

      <AnimatePresence>
        {trapFlash && (
          <motion.div
            key={trapFlash.key}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1.4 }}
            exit={{ opacity: 0, scale: 1.8 }}
            transition={{ duration: 0.5 }}
            style={{ left: `${((trapFlash.atX + 0.5) / size) * 100}%`, top: `${((trapFlash.atY + 0.5) / size) * 100}%` }}
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 text-3xl"
          >
            💥
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MazeArena({ state }: { state: MazeState }) {
  const secondsLeft = useCountdown(state.phase === "RACING" ? state.phaseEndsAt : null);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3">
      <div className="flex items-center gap-3">
        <MoveLegend />
        {secondsLeft !== null && (
          <span className="rounded-full bg-accent/15 px-3 py-1.5 text-lg font-extrabold text-accent">{secondsLeft}</span>
        )}
      </div>
      <MazeBoard state={state} />
    </div>
  );
}

export function MazeOverlay({ state, chat }: { state: MazeState | null; chat: ChatItem[] }) {
  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Branding />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col gap-4 p-6">
      <div className="flex flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {state.phase === "WAITING_FOR_PLAYERS" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-xl rounded-3xl border border-glass-border bg-canvas-soft/70 p-8 text-center shadow-glass backdrop-blur-2xl"
            >
              <p className="mb-2 text-4xl">🧩</p>
              <h1 className="text-2xl font-bold">متاهة</h1>
              <p className="mt-2 text-ink-muted">
                اكتب <bdi className="font-semibold text-accent">{state.settings.joinCommand}</bdi> عشان تدخل اللعبة!
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                أول واحد يوصل للكأس 🏆 هو الفايز — اتحرك بكتابة 1 لـ 4، وحط فخ بكتابة{" "}
                <span className="font-semibold text-ink">!فخ</span>
              </p>
              <p className="mt-4 text-lg font-semibold text-accent">
                {state.players.length} / {state.settings.maxPlayers}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <AnimatePresence>
                  {state.players.map((p) => (
                    <PlayerChip key={p.handle} name={p.displayName} avatarUrl={p.avatarUrl} />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {state.phase === "RACING" && (
            <motion.div
              key="racing"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="grid w-full max-w-5xl grid-cols-[220px_1fr] items-center gap-5"
            >
              <ParticipantsPanel players={state.players} />
              <MazeArena state={state} />
            </motion.div>
          )}

          {state.phase === "FINISHED" && (
            <motion.div
              key="finished"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="grid w-full max-w-5xl grid-cols-[220px_1fr] items-center gap-5"
            >
              <ParticipantsPanel players={state.players} />
              {state.winner ? (
                <WinnerCelebration
                  displayName={state.winner.displayName}
                  avatarUrl={state.winner.avatarUrl}
                  handle={state.winner.handle}
                  subtitle="🏆 أول واحد وصل للكأس في المتاهة"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="rounded-3xl border border-glass-border bg-canvas-soft/70 p-8 shadow-glass backdrop-blur-2xl">
                    <Crown size={40} className="mx-auto mb-3 text-ink-muted" />
                    <p className="text-ink-muted">محدش وصل للكأس قبل ما الوقت يخلص</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ChatStrip items={chat} />
      <Branding />
    </div>
  );
}
