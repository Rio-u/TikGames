import type { MusicalChairsPlayer, MusicalChairsState } from "@tikgames/shared-types";
import { Crown, SpeakerHigh, Trophy, Users } from "@phosphor-icons/react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useCountdown } from "../lib/useCountdown";
import { Branding } from "./Branding";
import { ChatStrip, type ChatItem } from "./ChatStrip";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";
import { ChairsArena3D } from "@tikgames/game-3d";

export type { ChatItem };

const OUTER_RADIUS = 190;
const INNER_RADIUS = 108;

function polar(radius: number, angle: number) {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

/** Best-first ranking: still-in players tie for the lead, then reverse elimination order (last out ranks higher). */
function rankPlayers(players: MusicalChairsPlayer[]): MusicalChairsPlayer[] {
  return [...players].sort((a, b) => (b.eliminatedRound ?? Infinity) - (a.eliminatedRound ?? Infinity));
}

function PlayerChip({ name, avatarUrl, eliminated }: { name: string; avatarUrl?: string | null; eliminated?: boolean }) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.6, y: 10 }}
      animate={{ opacity: eliminated ? 0.35 : 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`flex items-center gap-1.5 rounded-full border py-1.5 pl-4 pr-1.5 text-sm font-medium shadow-glass backdrop-blur-xl ${
        eliminated
          ? "border-glass-border bg-canvas-soft/60 text-ink-muted line-through"
          : "border-accent/40 bg-canvas-soft/80 text-ink"
      }`}
    >
      {name}
      <PlayerAvatar displayName={name} avatarUrl={avatarUrl} size={24} ring={false} />
    </motion.span>
  );
}

function ParticipantsPanel({ players }: { players: MusicalChairsPlayer[] }) {
  return (
    <div className="flex max-h-[440px] flex-col gap-1.5 overflow-y-auto rounded-3xl border border-glass-border bg-canvas-soft/70 p-4 shadow-glass backdrop-blur-2xl">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Users size={16} className="text-accent" weight="fill" />
        اللاعبين ({players.length})
      </div>
      {players.map((p) => (
        <div key={p.handle} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${p.eliminatedAt ? "opacity-40" : ""}`}>
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={26} ring={false} />
          <bdi className={`truncate text-xs ${p.eliminatedAt ? "line-through" : ""}`}>{p.displayName}</bdi>
        </div>
      ))}
    </div>
  );
}

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function LeaderboardPanel({ players }: { players: MusicalChairsPlayer[] }) {
  const ranked = rankPlayers(players).slice(0, Math.min(10, players.length));
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
      {ranked.length === 0 && <p className="text-xs text-ink-muted">لسه محدش خرج</p>}
    </div>
  );
}

/**
 * One persistent element for the whole game, play/pause driven by `active` — never re-created
 * per round, because strict-autoplay browsers (Brave blocks per-site by default; Chrome wants a
 * prior gesture) grant playback to an element once it has played inside a real gesture. Until
 * then, any click on the page silently unlocks it at volume 0 (document-level pointerdown still
 * runs in the gesture context); if a music phase still finds it blocked, a persistent enable
 * button appears. Inside OBS (a Browser Source) autoplay isn't restricted, so this mostly
 * matters when this page is opened in a normal browser tab.
 */
function MusicPlayer({ url, active }: { url: string; active: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const unlockedRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) {
      try {
        el.currentTime = 0;
      } catch {
        // metadata not loaded yet — plays from 0 anyway
      }
      el.volume = 1;
      el.play()
        .then(() => {
          unlockedRef.current = true;
          setBlocked(false);
          console.log("[music] playing:", url);
        })
        .catch((err) => {
          console.error("[music] play() rejected:", err);
          setBlocked(true);
        });
    } else {
      el.pause();
    }
  }, [active, url]);

  useEffect(() => {
    const unlock = () => {
      const el = ref.current;
      if (!el || unlockedRef.current) return;
      if (!activeRef.current) el.volume = 0;
      el.play()
        .then(() => {
          unlockedRef.current = true;
          setBlocked(false);
          if (!activeRef.current) {
            el.pause();
            try {
              el.currentTime = 0;
            } catch {
              // fine — next play resets it
            }
          }
          el.volume = 1;
          console.log("[music] unlocked by user gesture");
        })
        .catch(() => {
          el.volume = 1;
        });
    };
    document.addEventListener("pointerdown", unlock, true);
    return () => document.removeEventListener("pointerdown", unlock, true);
  }, []);

  return (
    <>
      <audio
        ref={ref}
        src={url}
        loop
        onError={(e) => {
          console.error("[music] <audio> element error:", e.currentTarget.error, url);
          setBlocked(true);
        }}
      />
      {blocked && (
        <button
          type="button"
          onClick={() => ref.current?.play().then(() => setBlocked(false)).catch((err) => console.error("[music] retry failed:", err))}
          className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent backdrop-blur-md"
        >
          <SpeakerHigh size={12} weight="fill" />
          شغّل صوت الموسيقى
        </button>
      )}
    </>
  );
}

/**
 * Chairs stay put and get numbered live. While the "music" plays (RUNNING) the avatar ring
 * orbits; once it stops (CHOOSING) the ring holds still and each player snaps onto their chair
 * the instant their claim lands — driven by server-authoritative state, not a local guess, so
 * this stays correct even if the browser tab was backgrounded. Anyone still chairless when the
 * round resolves holds visible for one beat before dropping out.
 */
function ChairsArena({ state }: { state: MusicalChairsState }) {
  const stillIn = state.players.filter((p) => !p.eliminatedAt);
  const musicPlaying = state.phase === "RUNNING";
  // The ring itself rotates for the orbit motion, but each player counter-rotates by the same
  // amount so their avatar/name stay upright — including when `.stop()` freezes the ring
  // mid-spin as the music cuts off, since the counter-rotation just tracks whatever the live
  // value is at that instant.
  const rotation = useMotionValue(0);
  const counterRotation = useTransform(rotation, (v) => -v);
  const [justOut, setJustOut] = useState<string[]>([]);
  const prevKeyRef = useRef("");
  const secondsLeft = useCountdown(state.phase === "CHOOSING" ? state.phaseEndsAt : null);

  useEffect(() => {
    if (!musicPlaying) return;
    rotation.set(0);
    const controls = animate(rotation, 360, { duration: 6, repeat: Infinity, ease: "linear" });
    return () => controls.stop();
  }, [musicPlaying, rotation]);

  useEffect(() => {
    const key = state.lastEliminated.map((p) => p.handle).join(",");
    if (key && key !== prevKeyRef.current) {
      prevKeyRef.current = key;
      setJustOut(state.lastEliminated.map((p) => p.handle));
      const t = setTimeout(() => setJustOut([]), 1000);
      return () => clearTimeout(t);
    }
    prevKeyRef.current = key;
  }, [state.lastEliminated]);

  const loserSet = new Set(justOut);
  const losers = state.players.filter((p) => loserSet.has(p.handle));
  const seatedHandles = new Set(state.chairClaims.map((c) => c.handle));
  const seated = stillIn.filter((p) => seatedHandles.has(p.handle));
  const hovering = [...stillIn.filter((p) => !seatedHandles.has(p.handle) && !loserSet.has(p.handle)), ...losers];
  const chairsCount = state.chairCount;

  return (
    <div className="relative flex h-[440px] w-[440px] items-center justify-center">
      {/* The chairs themselves are 3D now — a raked overhead camera keeps their ring projecting
          to almost a circle, so the DOM avatar rings layered on top still land on them. */}
      <ChairsArena3D
        className="pointer-events-none absolute inset-0"
        chairCount={chairsCount}
        takenNumbers={state.chairClaims.map((c) => c.chairNumber)}
        spinning={state.phase === "RUNNING"}
      />

      <AnimatePresence>
        {seated.map((p) => {
          const chairNumber = state.chairClaims.find((c) => c.handle === p.handle)?.chairNumber ?? 1;
          const angle = (2 * Math.PI * (chairNumber - 1)) / chairsCount - Math.PI / 2;
          const { x, y } = polar(INNER_RADIUS, angle);
          return (
            <motion.div
              key={p.handle}
              layout
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1, x, y }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="absolute left-1/2 top-1/2 -ml-7 -mt-9 flex flex-col items-center gap-1"
            >
              <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={56} />
              <span className="max-w-[80px] truncate rounded-full bg-accent/90 px-2 py-0.5 text-[10px] text-canvas-elevated backdrop-blur-sm">
                {p.displayName}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <motion.div style={{ rotate: rotation }} className="absolute inset-0">
        <AnimatePresence>
          {hovering.map((p, i) => {
            const isLoser = loserSet.has(p.handle);
            const angle = (2 * Math.PI * i) / hovering.length - Math.PI / 2;
            const { x, y } = polar(OUTER_RADIUS, angle);
            return (
              <motion.div
                key={p.handle}
                layout
                initial={{ opacity: 0, scale: 0.4, x, y }}
                animate={{ opacity: isLoser ? 0 : 1, scale: isLoser ? 0.4 : 1, x, y }}
                exit={{ opacity: 0, scale: 0.3 }}
                transition={{ type: "spring", stiffness: 160, damping: 18 }}
                className="absolute left-1/2 top-1/2 -ml-7 -mt-9"
              >
                <motion.div style={{ rotate: counterRotation }} className="flex flex-col items-center gap-1">
                  <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={56} />
                  <span className="max-w-[80px] truncate rounded-full bg-canvas-soft/80 px-2 py-0.5 text-[10px] text-ink backdrop-blur-sm">
                    {p.displayName}
                  </span>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-xs text-ink-muted">الجولة {state.round + 1}</p>
        {musicPlaying ? (
          <p className="mt-1 text-sm font-semibold">🎵 الموسيقى شغالة...</p>
        ) : (
          <>
            <p className="mt-1 text-sm font-semibold text-accent">اكتب رقم الكرسي دلوقتي!</p>
            {secondsLeft !== null && <p className="mt-0.5 text-lg font-bold">{secondsLeft}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export function MusicalChairsOverlay({ state, chat }: { state: MusicalChairsState | null; chat: ChatItem[] }) {
  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Branding />
      </div>
    );
  }

  const inRound = state.phase === "RUNNING" || state.phase === "CHOOSING";

  return (
    <div className="relative flex min-h-screen flex-col gap-4 p-6">
      {state.musicUrl && state.phase !== "FINISHED" && (
        <MusicPlayer url={state.musicUrl} active={state.phase === "RUNNING"} />
      )}
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
              <p className="mb-2 text-4xl">🪑</p>
              <h1 className="text-2xl font-bold">الكراسي الموسيقية</h1>
              <p className="mt-2 text-ink-muted">
                اكتب <bdi className="font-semibold text-accent">{state.settings.joinCommand}</bdi> عشان تدخل اللعبة!
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

          {inRound && (
            <motion.div
              key="running"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="grid w-full max-w-[1500px] grid-cols-[180px_1fr_180px] items-center gap-3"
            >
              <ParticipantsPanel players={state.players} />
              <div className="flex justify-center">
                <ChairsArena state={state} />
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
              className="grid w-full max-w-[1500px] grid-cols-[180px_1fr_180px] items-center gap-3"
            >
              <ParticipantsPanel players={state.players} />
              {state.winner ? (
                <WinnerCelebration
                  displayName={state.winner.displayName}
                  avatarUrl={state.winner.avatarUrl}
                  handle={state.winner.handle}
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="rounded-3xl border border-glass-border bg-canvas-soft/70 p-8 shadow-glass backdrop-blur-2xl">
                    <Crown size={40} className="mx-auto mb-3 text-ink-muted" />
                    <p className="text-ink-muted">اتوقفت اللعبة قبل ما حد يفوز</p>
                  </div>
                </div>
              )}
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
