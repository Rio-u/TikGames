import {
  WidgetSocketEvents,
  type OverlayWidgetSettings,
  type WidgetGiftPayload,
} from "@tikgames/shared-types";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { Socket } from "socket.io-client";
import { bool, num, str, useSocketEvent } from "../lib/widget";

/**
 * A gift launches a firework: the gift's own artwork rides a trail up from the bottom of the
 * screen, then bursts at its apex into a ring of copies of itself with sparks at the centre.
 *
 * Two details make it read as a firework rather than a spinning menu:
 *  - the shell *decelerates* on the way up (easeOut) and the burst *accelerates* outward then
 *    slows — matching how a real shell loses momentum and how its stars spread;
 *  - every ring copy drifts downward as it fades, so the burst falls apart under gravity instead
 *    of hanging in a perfect circle.
 *
 * Concurrency is capped: gifts can arrive in bursts, and an unbounded number of simultaneous
 * full-screen animations will drag the browser source — and OBS with it — to a crawl.
 */

const MAX_CONCURRENT = 4;
const SPARK_COLORS = ["#fbbf24", "#f43f5e", "#22d3ee", "#a855f7", "#34d399", "#ffffff"];

interface Firework {
  id: number;
  href: string;
  /** Launch column, in px from the left. */
  x: number;
  /** Detonation height, in px from the top. */
  apex: number;
  seed: number;
}

let fireworkId = 0;

/** Deterministic per-firework jitter, so a given burst is stable across re-renders. */
function seeded(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function Burst({
  firework,
  giftSize,
  ringCount,
  radius,
  burstSeconds,
  showSparks,
}: {
  firework: Firework;
  giftSize: number;
  ringCount: number;
  radius: number;
  burstSeconds: number;
  showSparks: boolean;
}) {
  const ring = Array.from({ length: ringCount }, (_, i) => {
    const angle = (i / ringCount) * Math.PI * 2;
    // Vary each star's reach a little; a mathematically perfect circle looks like a gear.
    const reach = radius * (0.82 + seeded(firework.seed + i) * 0.36);
    return {
      i,
      dx: Math.cos(angle) * reach,
      dy: Math.sin(angle) * reach,
      spin: (seeded(firework.seed + i + 400) - 0.5) * 220,
    };
  });

  const sparks = showSparks
    ? Array.from({ length: 18 }, (_, i) => {
        const angle = seeded(firework.seed + i + 900) * Math.PI * 2;
        const reach = radius * (0.35 + seeded(firework.seed + i + 1500) * 0.9);
        return {
          i,
          dx: Math.cos(angle) * reach,
          dy: Math.sin(angle) * reach,
          color: SPARK_COLORS[i % SPARK_COLORS.length]!,
          size: 5 + seeded(firework.seed + i + 2100) * 7,
        };
      })
    : [];

  return (
    <div className="absolute inset-0">
      {/* Flash at the moment of detonation — sells the "bang" more than any particle does. */}
      <motion.span
        className="absolute rounded-full"
        style={{
          left: 0,
          top: 0,
          width: radius * 1.6,
          height: radius * 1.6,
          marginLeft: -radius * 0.8,
          marginTop: -radius * 0.8,
          background: "radial-gradient(circle, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)",
        }}
        initial={{ scale: 0.2, opacity: 0.9 }}
        animate={{ scale: 1.5, opacity: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />

      {sparks.map((spark) => (
        <motion.span
          key={`s${spark.i}`}
          className="absolute rounded-full"
          style={{
            left: 0,
            top: 0,
            width: spark.size,
            height: spark.size,
            marginLeft: -spark.size / 2,
            marginTop: -spark.size / 2,
            background: spark.color,
            boxShadow: `0 0 10px ${spark.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: spark.dx, y: [0, spark.dy, spark.dy + radius * 0.5], opacity: [1, 1, 0] }}
          transition={{ duration: burstSeconds, ease: "easeOut" }}
        />
      ))}

      {ring.map((star) => (
        <motion.img
          key={star.i}
          src={firework.href}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute object-contain"
          style={{
            left: 0,
            top: 0,
            width: giftSize,
            height: giftSize,
            marginLeft: -giftSize / 2,
            marginTop: -giftSize / 2,
            // Tailwind's preflight applies `max-width: 100%` to every img. The containing block
            // here is a zero-width positioned wrapper, so 100% resolves to 0 and the image
            // collapses to nothing while still loading and reporting as present in the DOM.
            maxWidth: "none",
          }}
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
          animate={{
            x: star.dx,
            // Out along the ring, then sagging under gravity as it fades.
            y: [0, star.dy, star.dy + radius * 0.55],
            scale: [0.4, 1, 0.85],
            opacity: [0, 1, 1, 0],
            rotate: star.spin,
          }}
          transition={{ duration: burstSeconds, ease: [0.15, 0.6, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

function Rocket({
  firework,
  giftSize,
  riseSeconds,
  burstSeconds,
  trailColor,
  ringCount,
  radius,
  showSparks,
}: {
  firework: Firework;
  giftSize: number;
  riseSeconds: number;
  burstSeconds: number;
  trailColor: string;
  ringCount: number;
  radius: number;
  showSparks: boolean;
}) {
  const [exploded, setExploded] = useState(false);

  return (
    <div className="absolute" style={{ left: firework.x, top: 0, bottom: 0, width: 0 }}>
      <AnimatePresence>
        {!exploded && (
          <motion.div
            className="absolute"
            style={{ left: 0, top: 0 }}
            initial={{ y: typeof window === "undefined" ? 1080 : window.innerHeight + 60 }}
            // Decelerating climb: a shell is slowest right before it detonates.
            animate={{ y: firework.apex }}
            transition={{ duration: riseSeconds, ease: "easeOut" }}
            onAnimationComplete={() => setExploded(true)}
          >
            {/* Trail, anchored under the shell and stretching back toward the launch point. */}
            <span
              className="absolute rounded-full"
              style={{
                left: -3,
                top: giftSize * 0.35,
                width: 6,
                height: giftSize * 1.6,
                background: `linear-gradient(to bottom, ${trailColor}, rgba(0,0,0,0))`,
                filter: "blur(0.5px)",
              }}
            />
            <img
              src={firework.href}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute object-contain"
              style={{
                left: -giftSize / 2,
                top: -giftSize / 2,
                width: giftSize,
                height: giftSize,
                // See the ring image: preflight's max-width:100% would collapse this to 0 inside
                // its zero-width positioned wrapper.
                maxWidth: "none",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {exploded && (
        <div className="absolute" style={{ left: 0, top: firework.apex }}>
          <Burst
            firework={firework}
            giftSize={giftSize * 0.72}
            ringCount={ringCount}
            radius={radius}
            burstSeconds={burstSeconds}
            showSparks={showSparks}
          />
        </div>
      )}
    </div>
  );
}

export function GiftFireworkWidget({
  settings,
  socket,
}: {
  settings: OverlayWidgetSettings | null;
  socket: Socket | null;
}) {
  const [fireworks, setFireworks] = useState<Firework[]>([]);

  const giftSize = num(settings, "giftSize", 96);
  const ringCount = num(settings, "ringCount", 14);
  const radius = num(settings, "burstRadius", 190);
  const riseSeconds = num(settings, "riseSeconds", 1.1);
  const burstSeconds = num(settings, "burstSeconds", 1.7);
  const trailColor = str(settings, "trailColor", "#fbbf24");
  const showSparks = bool(settings, "showSparks", true);
  const minCoins = num(settings, "minCoins", 0);

  useSocketEvent<WidgetGiftPayload>(socket, WidgetSocketEvents.Gift, (gift) => {
    // A threshold keeps a stream of 1-coin roses from carpeting the screen while still letting
    // a real gift land. 0 disables it.
    if (gift.totalCoins < minCoins) return;

    const seed = ++fireworkId;

    // Place the burst in real pixels against the actual browser-source size, so the ring always
    // lands fully on screen. Picking a percentage-based apex looked fine until the radius was
    // turned up (or the source made short) and the top of the ring was cut off by the edge.
    const vw = window.innerWidth || 1920;
    const vh = window.innerHeight || 1080;
    const margin = radius + giftSize / 2 + 12;
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.min(hi, Math.max(lo, hi)));

    const firework: Firework = {
      id: seed,
      // TikTok ships the gift's artwork with the event; the coin stands in when it didn't.
      href: gift.imageUrl ?? "/jar/coin.png",
      x: clamp(vw * (0.12 + seeded(seed) * 0.76), margin, vw - margin),
      apex: clamp(vh * (0.24 + seeded(seed + 50) * 0.24), margin, vh - margin),
      seed,
    };

    setFireworks((prev) => [...prev, firework].slice(-MAX_CONCURRENT));
    window.setTimeout(
      () => setFireworks((prev) => prev.filter((f) => f.id !== firework.id)),
      (riseSeconds + burstSeconds) * 1000 + 400,
    );
  });

  return (
    <div className="pointer-events-none relative h-dvh w-full overflow-hidden">
      {fireworks.map((firework) => (
        <Rocket
          key={firework.id}
          firework={firework}
          giftSize={giftSize}
          riseSeconds={riseSeconds}
          burstSeconds={burstSeconds}
          trailColor={trailColor}
          ringCount={ringCount}
          radius={radius}
          showSparks={showSparks}
        />
      ))}
    </div>
  );
}
