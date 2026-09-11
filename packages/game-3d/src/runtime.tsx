import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Stage } from "./shared/Stage";
import type { Design } from "./shared/types";
import { getCountdownDesign } from "./registry";
import { RoundTimerScene } from "./countdown/RoundTimer";
import { VictoryScene3D } from "./victory/VictoryScene3D";

/**
 * What the game renders.
 *
 * Only one thing here is configurable: which of the nine designs plays as the pre-roll, and that
 * is an admin setting that applies platform-wide. It arrives on the `game:countdown` broadcast
 * alongside the timestamp, so both the dashboard and the overlay use the same design without
 * either of them storing or fetching anything.
 *
 * The round timer and the winner scene are fixed. Neither is chosen — the timer because it has to
 * stay quiet next to the question it sits beside, and the winner because it is the one moment the
 * whole product builds to and should look the same every time.
 */

/** Renders one design inside the stage it asked for. Shared by the game and the admin picker. */
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
  /** The admin's platform-wide choice, forwarded from the game:countdown broadcast. */
  designId?: string | null;
}) {
  const design = useMemo(() => getCountdownDesign(designId), [designId]);

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
      setFraction(1 - (((msLeft % 1000) + 1000) % 1000) / 1000);
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
    // Fixed and edge-to-edge. It was `absolute` inside a 620px box, which both capped the scene
    // to a square in the middle of the page and left it scoped to whatever the nearest positioned
    // ancestor happened to be — on the dashboard, the game view rather than the window.
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-canvas/80 backdrop-blur-sm" />
      <div className="absolute inset-0">
        <DesignStage design={design} value={label} progress={fraction} urgent={remaining <= 1} overlaid />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   In-round timer
   --------------------------------------------------------------------------- */

/**
 * The timer inside a live round. Fixed design, not selectable — see RoundTimerScene for why.
 * Renders nothing once the phase ends rather than leaving an idle canvas running.
 */
export function RoundCountdown({
  secondsLeft,
  size = 170,
  totalSeconds,
}: {
  secondsLeft: number | null;
  size?: number;
  /** The phase's full duration, so the arc can show how much of it is left. */
  totalSeconds?: number;
}) {
  const [fraction, setFraction] = useState(0);

  useEffect(() => {
    if (secondsLeft === null) return;
    const started = Date.now();
    const iv = setInterval(() => setFraction(((Date.now() - started) % 1000) / 1000), 60);
    return () => clearInterval(iv);
  }, [secondsLeft]);

  if (secondsLeft === null) return null;

  // Without a known total the arc would have no scale, so it falls back to a fixed 30s sweep —
  // still a truthful "time is running out", just not calibrated to this particular phase.
  const remainingFraction = Math.min(secondsLeft / (totalSeconds && totalSeconds > 0 ? totalSeconds : 30), 1);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <Stage
        camera={{ position: [0, 0, 6.2], fov: 45 }}
        // No post-processing at all. Two reasons: this is the only scene that renders for the
        // whole round rather than in a burst, so the composer's cost is permanent; and on a
        // transparent canvas the composer's own pass leaves a faint darkened rectangle where the
        // canvas sits, which is plainly visible against the game's artwork. The emissive
        // materials and the backing disc give it enough glow without one.
        effects={{ bloom: 0, chromatic: 0, vignette: 0 }}
        parallax={0}
      >
        <RoundTimerScene
          key={secondsLeft}
          value={secondsLeft}
          progress={fraction}
          urgent={secondsLeft <= 5}
          remainingFraction={remainingFraction}
        />
      </Stage>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Victory
   --------------------------------------------------------------------------- */

/**
 * The winner moment: full-screen, with the winner's photo and name at the centre of it.
 *
 * `pointer-events-none` throughout. It covers the entire viewport by design, and on the
 * streamer's dashboard the "لعبة جديدة" and exit controls are underneath it — blocking those
 * behind a celebration would strand the streamer mid-broadcast.
 */
export function VictoryCelebration({
  displayName,
  avatarUrl,
  handle,
  subtitle,
  duration = 2800,
  children,
}: {
  displayName: string;
  avatarUrl?: string | null;
  /** Remounts the whole moment when the winner changes, restarting the sequence. */
  handle: string;
  subtitle?: string;
  duration?: number;
  /** Optional extra DOM under the name — the dashboard puts its buttons here. */
  children?: ReactNode;
}) {
  const [progress, setProgress] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setProgress(0);
    setImgFailed(false);
    const started = Date.now();
    let raf = 0;
    const step = () => {
      const k = Math.min((Date.now() - started) / duration, 1);
      setProgress(k);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [duration, handle]);

  // The portrait and type ride the same curve as the scene, one beat behind the blast.
  const reveal = Math.min(Math.max((progress - 0.14) / 0.34, 0), 1);
  const settle = 1 - Math.pow(1 - reveal, 3);
  const nameIn = Math.min(Math.max((progress - 0.3) / 0.34, 0), 1);

  return (
    <>
      {/*
       * An in-flow placeholder, and the reason this is a fragment.
       *
       * The celebration below is `position: fixed`, which takes it out of flow — and a fixed child
       * of a grid is not a grid item at all. Game views lay their finished phase out as
       * [panel | winner | panel], so without something here the grid saw only two children and
       * dropped the leaderboard and chat into the wide middle column: they visibly jumped to the
       * centre the moment somebody won. This keeps the slot.
       */}
      <div aria-hidden className="min-h-0" />
      <div key={handle} className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {/* The scene fills the viewport; the portrait is laid over its centre. */}
      <div className="absolute inset-0">
        <Stage
          camera={{ position: [0, 0, 11], fov: 52 }}
          effects={{ bloom: 1.15, bloomThreshold: 0.42, chromatic: 0.0009, vignette: 0 }}
          parallax={0.5}
        >
          <VictoryScene3D progress={progress} />
        </Stage>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div
          className="relative"
          style={{
            transform: `scale(${0.4 + settle * 0.6})`,
            opacity: reveal,
          }}
        >
          <span className="absolute -inset-6 -z-10 animate-glow-pulse rounded-full bg-accent/25 blur-3xl" />
          <div className="h-[clamp(120px,20vh,210px)] w-[clamp(120px,20vh,210px)] overflow-hidden rounded-full border-[3px] border-accent/80 shadow-[0_0_60px_-8px_var(--color-accent)]">
            {avatarUrl && !imgFailed ? (
              <img
                src={avatarUrl}
                alt={displayName}
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-accent text-[clamp(3rem,7vh,5rem)] font-black text-white">
                {displayName.trim().charAt(0) || "?"}
              </div>
            )}
          </div>
        </div>

        <div style={{ opacity: nameIn, transform: `translateY(${(1 - nameIn) * 22}px)` }}>
          <p className="text-[clamp(0.8rem,1.6vh,1rem)] font-bold uppercase tracking-[0.35em] text-accent">
            الفائز
          </p>
          <h1 className="mt-2 text-[clamp(2rem,7vh,4.5rem)] font-black leading-none text-white drop-shadow-[0_0_30px_rgba(192,132,252,0.55)]">
            <bdi>{displayName}</bdi>
          </h1>
          {subtitle && (
            <p className="mt-3 text-[clamp(1rem,2.4vh,1.6rem)] font-bold text-[#ffb545]">{subtitle}</p>
          )}
        </div>

        {children && <div className="pointer-events-auto mt-2">{children}</div>}
        </div>
      </div>
    </>
  );
}
