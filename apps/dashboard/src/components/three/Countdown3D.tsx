import { useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BRAND, Float, GlyphPlate, NeonRing, PopIn, Sparkles, Stage, ToonMaterial } from "./brandKit";

/**
 * The 3D countdown, in two sizes off one scene:
 *
 * - `<PreRollCountdown>` — the full-screen 3·2·1·يلا! that plays before every game. The server
 *   holds the game for exactly this long (see POST /games/session/:id/begin), so what you see
 *   counting down is the real wait, not a decorative pre-roll running over an already-live round.
 * - `<RoundCountdown>` — the in-round timer that replaced the flat number each game used to print.
 *
 * Both take their number from a server `endsAt`, never a local timer, so every viewer of the same
 * broadcast sees the same digit at the same moment.
 */

/**
 * The plate plus its furniture — spins gently, leans toward the camera, and pulses on each tick.
 *
 * `compact` tightens the rings in around the plate. The pre-roll owns the whole screen, so it can
 * afford wide orbits; the round timer lives in a ~150px corner of a game arena, where the same
 * orbits shrink the digit to something you can't read at a glance.
 */
function CountdownBadge({ label, urgent, compact = false }: { label: string; urgent: boolean; compact?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const born = useRef(0);

  useFrame((state, delta) => {
    if (!group.current) return;
    born.current += delta;
    const t = state.clock.elapsedTime;
    // A slow figure-eight lean reads as "alive" without ever turning the glyph away from view.
    group.current.rotation.y = Math.sin(t * 0.9) * 0.28;
    group.current.rotation.x = Math.cos(t * 0.7) * 0.12;
    // Each new digit remounts this component, so `born` restarts and every tick gets its own kick.
    const kick = Math.exp(-born.current * 6) * 0.35;
    group.current.scale.setScalar(1 + kick);
  });

  const ringColor = urgent ? BRAND.gold : BRAND.accent;

  return (
    <group ref={group}>
      <Float speed={2.2} rotationIntensity={0.25} floatIntensity={0.5}>
        <PopIn from={0.25}>
          <GlyphPlate text={label} size={2.5} glow={ringColor} />
        </PopIn>
      </Float>
      <NeonRing radius={compact ? 1.95 : 2.25} thickness={0.06} color={ringColor} speed={0.9} />
      <NeonRing radius={compact ? 2.25 : 2.7} thickness={0.035} color={BRAND.primary} speed={-0.55} tilt={1.1} />
      {/* A soft disc behind the plate: reads as a glow bloom without a post-processing pass. */}
      <mesh position={[0, 0, -1.2]}>
        <circleGeometry args={[compact ? 2.4 : 2.9, 48]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.1} toneMapped={false} />
      </mesh>
      <Sparkles count={compact ? 12 : 26} scale={compact ? 5 : 7} size={4} speed={0.4} color={ringColor} />
    </group>
  );
}

/** The four cartoon pills that orbit the pre-roll badge — pure decoration, cheap to draw. */
function OrbitBits() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z += delta * 0.5;
    ref.current.children.forEach((child, i) => {
      child.position.y = Math.sin(state.clock.elapsedTime * 2 + i) * 0.2;
      child.rotation.x += delta * (1 + i * 0.3);
    });
  });
  return (
    <group ref={ref}>
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 3.5, Math.sin(angle) * 3.5, -0.5]}>
            <capsuleGeometry args={[0.11, 0.3, 4, 8]} />
            <ToonMaterial color={i % 2 === 0 ? BRAND.accent : BRAND.primary} emissiveIntensity={1.1} />
          </mesh>
        );
      })}
    </group>
  );
}

const PRE_ROLL_LABELS = ["يلا!", "1", "2", "3"] as const;

/**
 * Full-screen 3·2·1·يلا! Renders only while `endsAt` is in the future, then unmounts itself and
 * calls `onDone` — so the WebGL context is torn down the moment the game actually starts and
 * costs the stream nothing for the rest of the round.
 */
export function PreRollCountdown({ endsAt, onDone }: { endsAt: string; onDone?: () => void }) {
  const [remaining, setRemaining] = useState(() =>
    Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000),
  );

  useEffect(() => {
    const target = new Date(endsAt).getTime();
    const tick = () => {
      const left = Math.ceil((target - Date.now()) / 1000);
      setRemaining(left);
      if (left <= -1) onDone?.();
    };
    tick();
    const iv = setInterval(tick, 100);
    return () => clearInterval(iv);
    // onDone is intentionally not a dep: callers pass an inline closure, and re-running this
    // effect on every parent render would restart the interval and stall the countdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  // 0 is the "يلا!" beat — it holds for the last second rather than showing a bare zero.
  if (remaining < 0) return null;
  const label = PRE_ROLL_LABELS[Math.min(Math.max(remaining, 0), 3)] ?? "يلا!";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-canvas/70 backdrop-blur-sm" />
      <div className="relative h-full max-h-[560px] w-full max-w-[560px]">
        {/* 9.5 puts the half-height at ~3.9 — enough for the 3.5-radius orbit
            pills to stay inside the frame instead of being clipped at the edges. */}
        <Stage camera={9.5}>
          <OrbitBits />
          {/* Keyed on the label so each tick remounts the badge and replays its pop. */}
          <CountdownBadge key={label} label={label} urgent={remaining <= 1} />
        </Stage>
      </div>
    </motion.div>
  );
}

/**
 * The in-round timer. Sized to sit inside a game arena, and it deliberately stops rendering once
 * `secondsLeft` is null (the phase ended) rather than lingering as an idle canvas.
 */
export function RoundCountdown({ secondsLeft, size = 150 }: { secondsLeft: number | null; size?: number }) {
  if (secondsLeft === null) return null;
  const urgent = secondsLeft <= 5;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Half-height ~2.6 here, which clears the compact 2.25-radius outer ring while leaving the
          plate large enough to read from across a room. */}
      <Stage camera={6.3}>
        {/* Keying on the value remounts the badge each tick, which is what replays its pop —
            the Canvas itself stays mounted, so the WebGL context is never rebuilt. */}
        <CountdownBadge key={secondsLeft} label={String(secondsLeft)} urgent={urgent} compact />
      </Stage>
    </div>
  );
}
