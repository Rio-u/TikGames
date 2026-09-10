import type { SpinWheelPlayer, SpinWheelState } from "@tikgames/shared-types";
import { Crown, ShieldStar, Trophy, Users } from "@phosphor-icons/react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useMemo } from "react";
import { useCountdown } from "../lib/useCountdown";
import { ChatBox, type ChatItem } from "./ChatBox";
import { NoWinnerScreen } from "./NoWinnerScreen";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";

export type { ChatItem };

/** Site-palette segment gradients ([rim, center]) — violet/fuchsia family only, alternating
 *  light/dark so neighbors always read as separate slices. */
const WHEEL_SEGMENTS: Array<[string, string]> = [
  ["#a78bfa", "#5b21b6"],
  ["#7c3aed", "#2e1065"],
  ["#e879f9", "#86198f"],
  ["#8b5cf6", "#4c1d95"],
  ["#d946ef", "#701a75"],
  ["#6d28d9", "#1e0a3c"],
  ["#c084fc", "#6b21a8"],
  ["#9333ea", "#3b0764"],
];

function segmentGradientIndex(index: number, total: number): number {
  const idx = index % WHEEL_SEGMENTS.length;
  // Keep the last segment from matching the first — they sit next to each other on the circle.
  if (index === total - 1 && idx === 0) return 3;
  return idx;
}

/** Point on a circle, angle in degrees clockwise from 12 o'clock (SVG y-down coords). */
function wheelPoint(radius: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: radius * Math.sin(rad), y: -radius * Math.cos(rad) };
}

function arcPath(radius: number, startDeg: number, endDeg: number): string {
  const start = wheelPoint(radius, startDeg);
  const end = wheelPoint(radius, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M 0 0 L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

/** Still-in players in stable number order — every client derives the same wheel from the same state. */
function wheelPlayers(state: SpinWheelState): SpinWheelPlayer[] {
  return state.players.filter((p) => !p.eliminatedAt).sort((a, b) => a.number - b.number);
}

/** Best-first ranking: still-in players tie for the lead, then reverse elimination order. */
function rankPlayers(players: SpinWheelPlayer[]): SpinWheelPlayer[] {
  return [...players].sort((a, b) => (b.eliminatedRound ?? Infinity) - (a.eliminatedRound ?? Infinity));
}

/** SVG-unit radius (out of the -120..120 viewBox) where a player marker anchors. */
const MARKER_RADIUS_UNIT = 66;

/**
 * One rider on the wheel: a pennant-shaped name tag — a little triangular flag that echoes the
 * wedge shape itself, pointing straight down at the avatar it labels — stacked above the avatar,
 * with the player's number badged on top. Lives inside a counter-rotated wrapper so it always
 * reads upright to the viewer no matter where the wheel currently is mid-spin (same trick
 * MusicalChairsGameView uses for its hovering avatars), while the wrapper's (x, y) still orbits
 * with the wheel because its *parent* is the one spinning.
 */
function WheelPlayerMarker({
  player,
  x,
  y,
  counterRotation,
  tint,
  selected,
  spotlightActive,
}: {
  player: SpinWheelPlayer;
  x: number;
  y: number;
  counterRotation: MotionValue<number>;
  tint: string;
  selected: boolean;
  spotlightActive: boolean;
}) {
  const dimmed = spotlightActive && !selected;

  return (
    <motion.div
      style={{ x, y }}
      animate={{ opacity: dimmed ? 0.32 : 1, scale: selected && spotlightActive ? 1.12 : 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 20 }}
      className="absolute left-1/2 top-1/2 -ml-9 -mt-9"
    >
      <motion.div style={{ rotate: counterRotation }} className="relative flex flex-col items-center">
        {selected && spotlightActive && (
          <motion.div
            animate={{ opacity: [0.4, 0.85, 0.4], scale: [1, 1.25, 1] }}
            transition={{ duration: 1.1, repeat: Infinity }}
            className="absolute -inset-3 rounded-full bg-fuchsia-400/50 blur-lg"
          />
        )}

        {/* Pennant name tag — flat top, tapers to a point aimed down at the avatar. */}
        <div
          className="relative -mb-1.5 whitespace-nowrap px-2.5 pb-2.5 pt-1 text-[10.5px] font-bold text-white ring-1 ring-inset ring-white/35 backdrop-blur-md"
          style={{
            clipPath: "polygon(6% 0%, 94% 0%, 100% 58%, 50% 100%, 0% 58%)",
            background: `linear-gradient(180deg, ${tint}dd, ${tint}55 70%, transparent)`,
          }}
        >
          <bdi className="block max-w-[76px] truncate drop-shadow-[0_1px_2px_rgba(5,3,13,0.8)]">{player.displayName}</bdi>
        </div>

        <div className="relative">
          <PlayerAvatar displayName={player.displayName} avatarUrl={player.avatarUrl} size={56} />
          <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-fuchsia-600 text-xs font-black text-white ring-2 ring-canvas">
            {player.number}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * The wheel itself. The server already picked the target when SPINNING began — this just spins
 * the SVG (4 extra turns + whatever lands the selected segment under the pointer) timed to end
 * at phaseEndsAt, so the dashboard and overlay stop on the same player at the same moment.
 */
export function FortuneWheel({
  players,
  selectedHandle,
  spinning,
  highlightSelected,
  phaseEndsAt,
  sizeClass,
  diameterPx,
}: {
  players: SpinWheelPlayer[];
  selectedHandle: string | null;
  spinning: boolean;
  highlightSelected: boolean;
  phaseEndsAt: string | null;
  sizeClass: string;
  diameterPx: number;
}) {
  const rotation = useMotionValue(0);
  const counterRotation = useTransform(rotation, (v) => -v);
  const segDeg = 360 / Math.max(1, players.length);
  const scale = diameterPx / 240;

  useEffect(() => {
    if (!spinning || !selectedHandle) return;
    const idx = players.findIndex((p) => p.handle === selectedHandle);
    if (idx < 0) return;
    const mod = (n: number) => ((n % 360) + 360) % 360;
    const center = idx * segDeg + segDeg / 2;
    const current = rotation.get();
    const remainingMs = phaseEndsAt ? Math.max(1500, new Date(phaseEndsAt).getTime() - Date.now()) : 5000;
    const target = current + 360 * 4 + mod(-center - current);
    const controls = animate(rotation, target, { duration: remainingMs / 1000, ease: [0.12, 0.8, 0.2, 1] });
    return () => controls.stop();
    // Deliberately keyed on the spin starting, not the player list — actives never change mid-spin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, selectedHandle]);

  const selectedIdx = players.findIndex((p) => p.handle === selectedHandle);

  return (
    <div className={`relative ${sizeClass}`}>
      {/* Breathing halo behind the whole wheel — the site's signature purple glow. */}
      <motion.div
        animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.05, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-2 rounded-full bg-primary/40 blur-3xl"
      />

      {/* Rotating slice disc — only this layer spins; rim, bulbs, hub and pointer stay put. */}
      <motion.div style={{ rotate: rotation }} className="absolute inset-0">
        <svg viewBox="-120 -120 240 240" className="h-full w-full">
          <defs>
            {WHEEL_SEGMENTS.map(([light, dark], k) => (
              <radialGradient key={k} id={`sw-seg-${k}`} cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
                <stop offset="18%" stopColor={dark} />
                <stop offset="100%" stopColor={light} />
              </radialGradient>
            ))}
          </defs>
          <circle r="103" fill="#0a0616" />
          {players.map((p, i) => {
            const start = i * segDeg;
            const gi = segmentGradientIndex(i, players.length);
            const isSelected = i === selectedIdx;
            const spotlightOthers = highlightSelected && players.length > 1;
            return (
              <g key={p.handle}>
                {players.length > 1 ? (
                  <path
                    d={arcPath(100, start, start + segDeg)}
                    fill={`url(#sw-seg-${gi})`}
                    stroke="rgba(255,255,255,0.28)"
                    strokeWidth="1"
                  />
                ) : (
                  <circle r="100" fill="url(#sw-seg-0)" />
                )}
                {/* Spotlight while the chosen player decides: everyone else falls into shadow. */}
                {spotlightOthers && !isSelected && (
                  <path d={arcPath(100, start, start + segDeg)} fill="rgba(5,3,13,0.55)" />
                )}
                {spotlightOthers && isSelected && (
                  <>
                    <motion.path
                      d={arcPath(100, start, start + segDeg)}
                      fill="#fff"
                      animate={{ fillOpacity: [0.03, 0.26, 0.03] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                    />
                    <path d={arcPath(100, start, start + segDeg)} fill="none" stroke="#f0abfc" strokeWidth="2.2" />
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* Riders — upright HTML markers (name pennant above avatar, number badged on it),
            orbiting because this whole layer rotates while each marker counter-rotates. */}
        {players.map((p, i) => {
          const mid = i * segDeg + segDeg / 2;
          const { x, y } = wheelPoint(MARKER_RADIUS_UNIT, mid);
          const gi = segmentGradientIndex(i, players.length);
          return (
            <WheelPlayerMarker
              key={p.handle}
              player={p}
              x={x * scale}
              y={y * scale}
              counterRotation={counterRotation}
              tint={WHEEL_SEGMENTS[gi]![0]}
              selected={i === selectedIdx}
              spotlightActive={highlightSelected && players.length > 1}
            />
          );
        })}
      </motion.div>

      {/* Static chrome: vignette, gradient rim, marquee bulbs, hub. */}
      <svg viewBox="-120 -120 240 240" className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="sw-vig" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
            <stop offset="70%" stopColor="rgba(5,3,13,0)" />
            <stop offset="100%" stopColor="rgba(5,3,13,0.5)" />
          </radialGradient>
          <linearGradient id="sw-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#d946ef" />
          </linearGradient>
          <radialGradient id="sw-hub" cx="0" cy="0" r="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2a1245" />
            <stop offset="100%" stopColor="#0a0616" />
          </radialGradient>
        </defs>
        <circle r="100" fill="url(#sw-vig)" />
        <circle r="107" fill="none" stroke="url(#sw-rim)" strokeWidth="9" />
        <circle r="112.5" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
        <circle r="101.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
        {Array.from({ length: 16 }).map((_, k) => {
          const { x, y } = wheelPoint(107, k * 22.5);
          return spinning ? (
            <motion.circle
              key={k}
              cx={x}
              cy={y}
              r="2.8"
              fill="#fff"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 0.75, repeat: Infinity, delay: (k % 4) * 0.19 }}
            />
          ) : (
            <circle key={k} cx={x} cy={y} r="2.8" fill="#fff" opacity={highlightSelected ? 0.85 : 0.4} />
          );
        })}
        <circle r="30" fill="url(#sw-hub)" stroke="url(#sw-rim)" strokeWidth="2.5" />
        <circle r="34.5" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        <text x="0" y="9" textAnchor="middle" fontSize="26">
          🎡
        </text>
      </svg>

      {/* Jewel pointer — fixed at 12 o'clock, wobbles while the wheel is moving under it. */}
      <motion.div
        animate={spinning ? { rotate: [0, -14, 0], y: [0, 2, 0] } : { rotate: 0, y: 0 }}
        transition={spinning ? { duration: 0.22, repeat: Infinity } : undefined}
        className="absolute left-1/2 top-0 z-10 -translate-x-1/2"
      >
        <svg
          width={diameterPx * 0.07}
          height={diameterPx * 0.093}
          viewBox="0 0 36 48"
          className="drop-shadow-[0_0_12px_rgba(192,132,252,0.9)]"
        >
          <defs>
            <linearGradient id="sw-ptr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0abfc" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          <path
            d="M18 47 C 10 32 2 24 2 14 A 16 12.5 0 1 1 34 14 C 34 24 26 32 18 47 Z"
            fill="url(#sw-ptr)"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="1.6"
          />
          <circle cx="18" cy="14" r="4.5" fill="#fff" opacity="0.95" />
        </svg>
      </motion.div>
    </div>
  );
}

/** The "بوووم" moment when a hidden shield gets hit: flash, shockwaves, sparks, shaking card. */
export function ShieldExplosion({ burstKey }: { burstKey: string }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        angle: (i / 26) * Math.PI * 2 + Math.random() * 0.5,
        dist: 130 + Math.random() * 160,
        emoji: ["💥", "🔥", "✨", "⚡"][i % 4]!,
        delay: Math.random() * 0.15,
      })),
    // Re-roll per event so back-to-back shields don't replay an identical burst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden">
      <motion.div
        key={`flash-${burstKey}`}
        initial={{ opacity: 0.9 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="absolute inset-0 bg-gradient-to-br from-amber-200 via-orange-400/80 to-transparent"
      />
      {[0, 0.12, 0.24].map((delay, i) => (
        <motion.div
          key={`ring-${burstKey}-${i}`}
          initial={{ scale: 0.1, opacity: 0.9 }}
          animate={{ scale: 3.2, opacity: 0 }}
          transition={{ duration: 1.1, delay, ease: "easeOut" }}
          className="absolute h-64 w-64 rounded-full border-4 border-amber-300/80"
        />
      ))}
      {particles.map((pt, i) => (
        <motion.span
          key={`p-${burstKey}-${i}`}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1.3 }}
          animate={{ x: Math.cos(pt.angle) * pt.dist, y: Math.sin(pt.angle) * pt.dist, opacity: 0, scale: 0.4 }}
          transition={{ duration: 1, delay: pt.delay, ease: "easeOut" }}
          className="absolute text-3xl"
        >
          {pt.emoji}
        </motion.span>
      ))}
    </div>
  );
}

/** RESULT-phase reveal: who got eliminated / saved by a shield / withdrew. */
export function SpinResultReveal({ state, compact }: { state: SpinWheelState; compact?: boolean }) {
  const action = state.lastAction;
  if (!action) return null;

  const avatarSize = compact ? 84 : 112;
  const titleClass = compact ? "text-2xl" : "text-4xl";
  const subClass = compact ? "text-sm" : "text-base";

  if (action.type === "SHIELD_BLOCKED") {
    return (
      <motion.div
        animate={{ x: [0, -14, 12, -9, 6, -3, 0], y: [0, 9, -11, 7, -4, 2, 0] }}
        transition={{ duration: 0.65, ease: "easeOut" }}
        className="relative flex flex-col items-center gap-4 rounded-3xl border border-amber-400/50 bg-gradient-to-br from-amber-500/20 to-orange-600/10 p-10 text-center"
      >
        <ShieldExplosion burstKey={`${state.round}-${action.target.handle}`} />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.6, 1], rotate: [0, -12, 12, 0] }}
          transition={{ duration: 0.8 }}
          className="text-7xl"
        >
          🛡️
        </motion.div>
        <PlayerAvatar displayName={action.target.displayName} avatarUrl={action.target.avatarUrl} size={avatarSize} />
        <h3 className={`${titleClass} font-extrabold text-amber-300`}>
          <bdi>{action.target.displayName}</bdi> معاه حماية!
        </h3>
        <p className={`${subClass} text-ink-muted`}>
          الدرع امتص الضربة 💥 وراح الدور على <bdi className="font-semibold text-ink">{action.picker.displayName}</bdi> —
          العجلة هتلف تاني!
        </p>
      </motion.div>
    );
  }

  if (action.type === "WITHDREW") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-sky-400/40 bg-gradient-to-br from-sky-500/15 to-indigo-600/10 p-10 text-center">
        <motion.div initial={{ y: 0 }} animate={{ y: [-6, 6, -6] }} transition={{ duration: 2, repeat: Infinity }} className="text-6xl">
          🕊️
        </motion.div>
        <PlayerAvatar displayName={action.picker.displayName} avatarUrl={action.picker.avatarUrl} size={avatarSize} />
        <h3 className={`${titleClass} font-extrabold text-sky-300`}>
          <bdi>{action.picker.displayName}</bdi> انسحب بشرف!
        </h3>
        <p className={`${subClass} text-ink-muted`}>كتب 0 وسلّم نفسه بدل ما يطرد حد 🫡</p>
      </div>
    );
  }

  const viaText =
    action.via === "PICK" ? (
      <>
        بقرار من <bdi className="font-semibold text-ink">{action.picker.displayName}</bdi>
      </>
    ) : action.via === "RANDOM" ? (
      <>
        <bdi className="font-semibold text-ink">{action.picker.displayName}</bdi> كتب 00 — والعشوائية اختارت ضحيتها 🎲
      </>
    ) : (
      <>
        <bdi className="font-semibold text-ink">{action.picker.displayName}</bdi> سكت والوقت خلص — فالقدر قرر بداله ⏰
      </>
    );

  return (
    <div className="relative flex flex-col items-center gap-4 rounded-3xl border border-red-400/40 bg-gradient-to-br from-red-500/15 to-rose-600/10 p-10 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: [0, 1.5, 1] }}
        transition={{ duration: 0.6 }}
        className="text-6xl"
      >
        💥
      </motion.div>
      <motion.div
        initial={{ filter: "grayscale(0)" }}
        animate={{ filter: "grayscale(1)" }}
        transition={{ delay: 0.7, duration: 0.8 }}
        className="relative"
      >
        <PlayerAvatar displayName={action.target.displayName} avatarUrl={action.target.avatarUrl} size={avatarSize} />
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 12 }}
          className="absolute -right-2 -top-2 text-4xl"
        >
          ❌
        </motion.span>
      </motion.div>
      <h3 className={`${titleClass} font-extrabold text-red-300`}>
        <bdi>{action.target.displayName}</bdi> برا اللعبة!
      </h3>
      <p className={`${subClass} text-ink-muted`}>{viaText}</p>
    </div>
  );
}

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

function ParticipantsPanel({ state }: { state: SpinWheelState }) {
  return (
    <div className="flex h-full w-full flex-col gap-1.5 overflow-y-auto rounded-2xl border border-glass-border bg-canvas-elevated/50 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Users size={16} className="text-accent" weight="fill" />
        اللاعبين ({state.players.filter((p) => !p.eliminatedAt).length})
      </div>
      {state.shieldsTotal > 0 && (
        <div className="mb-1 flex items-center gap-1.5 rounded-xl bg-amber-400/10 px-2 py-1.5 text-xs font-semibold text-amber-300">
          <ShieldStar size={15} weight="fill" />
          دروع مخفية: {state.shieldsLeft} / {state.shieldsTotal}
        </div>
      )}
      {state.players.map((p) => (
        <div
          key={p.handle}
          className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${p.eliminatedAt ? "opacity-40" : ""} ${
            p.handle === state.selectedHandle && state.phase !== "FINISHED" ? "bg-accent/15 ring-1 ring-accent/40" : ""
          }`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-accent">
            {p.number}
          </span>
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={30} ring={false} />
          <bdi className={`truncate text-sm ${p.eliminatedAt ? "line-through" : ""}`}>{p.displayName}</bdi>
        </div>
      ))}
      {state.players.length === 0 && <p className="text-sm text-ink-muted">لسه محدش دخل</p>}
    </div>
  );
}

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function LeaderboardPanel({ players }: { players: SpinWheelPlayer[] }) {
  const ranked = rankPlayers(players).slice(0, Math.min(10, players.length));
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
      {ranked.length === 0 && <p className="text-sm text-ink-muted">لسه محدش خرج</p>}
    </div>
  );
}

/** Center column: wheel while spinning/picking, the reveal card while RESULT shows. */
function WheelArena({ state }: { state: SpinWheelState }) {
  const actives = wheelPlayers(state);
  const selected = state.players.find((p) => p.handle === state.selectedHandle) ?? null;
  const secondsLeft = useCountdown(state.phase === "PICKING" ? state.phaseEndsAt : null);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <span className="rounded-full bg-white/10 px-3 py-1">الجولة {state.round}</span>
        {state.shieldsTotal > 0 && (
          <span className="rounded-full bg-amber-400/15 px-3 py-1 text-amber-300">
            🛡️ {state.shieldsLeft} دروع لسه مستخبية
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {state.phase !== "RESULT" ? (
          <motion.div
            key="wheel"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            className="flex flex-col items-center gap-5"
          >
            <FortuneWheel
              players={actives}
              selectedHandle={state.selectedHandle}
              spinning={state.phase === "SPINNING"}
              highlightSelected={state.phase === "PICKING"}
              phaseEndsAt={state.phase === "SPINNING" ? state.phaseEndsAt : null}
              sizeClass="h-[min(66vh,660px)] w-[min(66vh,660px)]"
              diameterPx={660}
            />

            {state.phase === "SPINNING" && (
              <motion.p
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-lg font-semibold"
              >
                🎡 العجلة بتلف... مين اللي هيقرر مصير حد؟
              </motion.p>
            )}

            {state.phase === "PICKING" && selected && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-2 rounded-3xl border border-accent/40 bg-canvas-elevated/70 px-8 py-4 text-center"
              >
                <div className="flex items-center gap-3">
                  <PlayerAvatar displayName={selected.displayName} avatarUrl={selected.avatarUrl} size={48} />
                  <p className="text-lg font-bold">
                    يا <bdi className="text-accent">{selected.displayName}</bdi> — اكتب رقم اللاعب اللي هتطرده! 😈
                  </p>
                  {secondsLeft !== null && <span className="text-3xl font-extrabold text-accent">{secondsLeft}</span>}
                </div>
                <p className="text-xs text-ink-muted">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">0</span> تنسحب بنفسك
                  <span className="mx-2">•</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">00</span> طرد عشوائي 🎲
                </p>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={`result-${state.round}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="w-full max-w-xl"
          >
            <SpinResultReveal state={state} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SpinWheelGameView({
  state,
  chat,
  onNewRound,
}: {
  state: SpinWheelState;
  chat: ChatItem[];
  onNewRound: () => void;
}) {
  const inRound = state.phase === "SPINNING" || state.phase === "PICKING" || state.phase === "RESULT";

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col gap-4">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {state.phase === "WAITING_FOR_PLAYERS" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl rounded-3xl border border-glass-border bg-canvas-elevated/40 p-12 text-center"
            >
              <p className="mb-2 text-6xl">🎡</p>
              <h3 className="text-3xl font-bold">عجلة الحظ</h3>
              <p className="mt-3 text-base text-ink-muted">
                اكتب <bdi className="font-semibold text-accent">{state.settings.joinCommand}</bdi> عشان تدخل اللعبة!
              </p>
              <p className="mt-3 text-sm text-ink-muted">
                العجلة بتختار لاعب، واللاعب يكتب رقم اللي عايز يطرده — <span className="font-semibold text-ink">0</span>{" "}
                ينسحب، <span className="font-semibold text-ink">00</span> طرد عشوائي، وفي دروع مخفية 🛡️ محدش يعرف مين
                معاه!
              </p>
              <p className="mt-5 text-2xl font-semibold text-accent">
                {state.players.length} / {state.settings.maxPlayers}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
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
              key="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid h-full w-full grid-cols-1 items-stretch gap-3 lg:grid-cols-[200px_1fr_200px]"
            >
              <ParticipantsPanel state={state} />
              <WheelArena state={state} />
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
              <ParticipantsPanel state={state} />
              {state.winner ? (
                <WinnerCelebration
                  displayName={state.winner.displayName}
                  avatarUrl={state.winner.avatarUrl}
                  handle={state.winner.handle}
                  subtitle="آخر ناجي من عجلة الحظ 🎡"
                />
              ) : (
                <div className="flex items-center justify-center">
                  <NoWinnerScreen message="اتوقفت اللعبة قبل ما حد يفوز 😅" onNewRound={onNewRound} />
                </div>
              )}
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
