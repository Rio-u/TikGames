import { useEffect, useMemo, useState } from "react";
import { Stage } from "./shared/Stage";
import type { Design } from "./shared/types";
import { getCountdownDesign, getVictoryDesign } from "./registry";
import { useCountdownSelection, useVictorySelection } from "./registry/selection";

/**
 * What the game renders. Everything here resolves the *selected* design from the registry, so
 * changing the selection changes the live game with no other wiring.
 */

/** Renders one design inside the stage it asked for. Shared by the game and the picker, which is
 *  what makes the picker a true preview rather than a lookalike. */
export function DesignStage({
  design,
  value,
  progress,
  urgent,
  active = true,
  parallax,
  className,
  overlaid = false,
}: {
  design: Design;
  value: string | number;
  progress: number;
  urgent?: boolean;
  active?: boolean;
  /** Overrides the design's own parallax — the picker turns it down inside small cards. */
  parallax?: number;
  className?: string;
  /**
   * True when the scene is composited over the page rather than filling a bounded card.
   *
   * Drops the vignette, which is the one effect that cannot survive a transparent backdrop: it
   * darkens toward the canvas edges, and with nothing behind it that paints a visible black
   * rectangle over the page — and in the OBS overlay, over the streamer's scene.
   */
  overlaid?: boolean;
}) {
  const { Scene } = design;
  const effects = overlaid ? { ...design.effects, vignette: 0 } : design.effects;
  return (
    <Stage
      camera={design.camera}
      effects={effects}
      parallax={parallax ?? design.parallax ?? 0.35}
      active={active}
      className={className}
    >
      <Scene value={value} progress={progress} urgent={urgent} />
    </Stage>
  );
}

/* ---------------------------------------------------------------------------
   Pre-roll countdown
   --------------------------------------------------------------------------- */

const PRE_ROLL_LABELS = ["يلا!", "1", "2", "3"] as const;

/**
 * The full-screen 3·2·1 before every game. Counts against the server's `endsAt`, never a local
 * timer, so every viewer of the same broadcast sees the same digit at the same moment; unmounts
 * itself the instant the wait is over so the WebGL context is released for the round.
 */
export function PreRollCountdown({
  endsAt,
  onDone,
  designId,
}: {
  endsAt: string;
  onDone?: () => void;
  /** Overrides the stored selection. The picker uses this; the game never passes it. */
  designId?: string;
}) {
  const [selectedId] = useCountdownSelection();
  const design = useMemo(() => getCountdownDesign(designId ?? selectedId), [designId, selectedId]);

  const [remaining, setRemaining] = useState(() =>
    Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000),
  );
  const [fraction, setFraction] = useState(0);

  useEffect(() => {
    const target = new Date(endsAt).getTime();
    const tick = () => {
      const msLeft = target - Date.now();
      const left = Math.ceil(msLeft / 1000);
      setRemaining(left);
      // Progress through the current second, for designs that beat on each tick.
      setFraction(1 - ((msLeft % 1000) + 1000) % 1000 / 1000);
      if (left <= -1) onDone?.();
    };
    tick();
    const iv = setInterval(tick, 60);
    return () => clearInterval(iv);
    // onDone is intentionally excluded: callers pass an inline closure, and re-running this
    // would restart the interval on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  if (remaining < 0) return null;
  const label = PRE_ROLL_LABELS[Math.min(Math.max(remaining, 0), 3)] ?? "يلا!";

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-canvas/75 backdrop-blur-sm" />
      <div className="relative h-full max-h-[620px] w-full max-w-[620px]">
        <DesignStage design={design} value={label} progress={fraction} urgent={remaining <= 1} overlaid />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   In-round countdown
   --------------------------------------------------------------------------- */

/**
 * The timer inside a live round. Renders nothing once the phase ends rather than leaving an idle
 * canvas running — over a long stream that is the difference between one scene's cost and one
 * scene's cost permanently.
 */
export function RoundCountdown({
  secondsLeft,
  size = 190,
  designId,
}: {
  secondsLeft: number | null;
  size?: number;
  designId?: string;
}) {
  const [selectedId] = useCountdownSelection();
  const design = useMemo(() => getCountdownDesign(designId ?? selectedId), [designId, selectedId]);
  const [fraction, setFraction] = useState(0);

  useEffect(() => {
    if (secondsLeft === null) return;
    const started = Date.now();
    const iv = setInterval(() => setFraction(((Date.now() - started) % 1000) / 1000), 60);
    return () => clearInterval(iv);
  }, [secondsLeft]);

  if (secondsLeft === null) return null;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <DesignStage
        design={design}
        value={secondsLeft}
        progress={fraction}
        urgent={secondsLeft <= 3}
        // Small on screen; a full parallax lean would swing the composition out of its own box.
        parallax={0.12}
        overlaid
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Victory
   --------------------------------------------------------------------------- */

/**
 * The victory scene. Runs its entrance once from mount and then holds — `progress` climbs to 1
 * over `duration` and stays there, so the celebration lands and settles instead of looping.
 */
export function VictoryScene({
  value,
  duration = 2600,
  designId,
  className,
}: {
  /** Whatever the game wants celebrated — a score, a round count, an empty string for none. */
  value: string | number;
  duration?: number;
  designId?: string;
  className?: string;
}) {
  const [selectedId] = useVictorySelection();
  const design = useMemo(() => getVictoryDesign(designId ?? selectedId), [designId, selectedId]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const started = Date.now();
    let raf = 0;
    const step = () => {
      const k = Math.min((Date.now() - started) / duration, 1);
      setProgress(k);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [duration, design.id]);

  return <DesignStage design={design} value={value} progress={progress} className={className} overlaid />;
}
