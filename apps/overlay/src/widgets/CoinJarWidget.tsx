import {
  WidgetSocketEvents,
  type OverlayWidgetSettings,
  type WidgetGiftPayload,
  type WidgetTotals,
} from "@tikgames/shared-types";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import { bool, num, str, useSnapshotEvent, useSocketEvent, widgetStyle } from "../lib/widget";

/**
 * Coin jar built from the supplied artwork rather than drawn shapes.
 *
 * Depth is the whole trick: the coins have to look like they are *inside* the glass, so the
 * layers are stacked back-to-front —
 *
 *   1. `jar-top-bg-2.png`  the back half of the rim, seen through the glass
 *   2. `jar-bottom.png`    the inner base the pile rests on
 *   3. coins               clipped to the cavity, so nothing can sit on top of a wall
 *   4. `jar-top.png`       the glass itself, drawn last so it covers the coins
 *
 * Every coordinate below is in the artwork's own 500×500 space and was measured off the actual
 * alpha channel of jar-top.png (scanning each row for where the glass wall ends and the
 * see-through cavity begins), not eyeballed — a guessed cavity is what makes coins clip through
 * the glass at the shoulders and the base curve.
 */

const ART = 500; // jar-top.png is square; everything is in this coordinate space.

// Cavity outline, traced from the measured inner walls. Straight through the body, pinching in
// at the shoulder (y≈130) and rounding off into the base (y≈432).
const CAVITY_PATH = `
  M 152 132
  L 128 176
  L 122 250
  L 124 320
  L 129 382
  L 143 420
  Q 250 447 357 420
  L 371 382
  L 376 320
  L 378 250
  L 372 176
  L 348 132
  Z
`;

const CAVITY_TOP = 140;
const CAVITY_BOTTOM = 434;
const CAVITY_LEFT = 126;
const CAVITY_RIGHT = 374;
const CAVITY_H = CAVITY_BOTTOM - CAVITY_TOP;

const COIN = 30;
const COIN_R = COIN / 2;
/** The gift artwork drops in larger than a coin — it's the thing that was actually sent. */
const GIFT_SIZE = 92;
const ROW_H = COIN * 0.62; // Overlapping rows — a real pile interlocks rather than stacking flat.

// Placements measured against the same artwork.
const MOUTH = { x: 122, y: 78, w: 256, h: 34 };
const BASE = { x: 133, y: 392, w: 233, h: 62 };

/**
 * What the pile is made of. Mostly coins with real gift artwork mixed through it, so a full jar
 * reads as "the gifts people sent" rather than a bucket of identical tokens. The weights keep
 * coins dominant — an even split makes the pile look like a toy box, not currency.
 */
const PILE_SPRITES: { href: string; weight: number; scale: number }[] = [
  { href: "/jar/coin.png", weight: 10, scale: 1 },
  { href: "/jar/gifts/rose.webp", weight: 3, scale: 1.28 },
  { href: "/jar/gifts/heart.webp", weight: 2, scale: 1.2 },
  { href: "/jar/gifts/finger-heart.webp", weight: 2, scale: 1.22 },
  { href: "/jar/gifts/doughnut.webp", weight: 1.5, scale: 1.24 },
  { href: "/jar/gifts/ice-cream.webp", weight: 1.5, scale: 1.26 },
  { href: "/jar/gifts/cake.webp", weight: 1, scale: 1.24 },
  { href: "/jar/gifts/rosa.webp", weight: 1, scale: 1.28 },
  { href: "/jar/gifts/perfume.webp", weight: 1, scale: 1.2 },
];

const SPRITE_TOTAL_WEIGHT = PILE_SPRITES.reduce((sum, s) => sum + s.weight, 0);

/** Maps a stable 0..1 roll onto the weighted sprite table. */
function spriteFor(roll: number): { href: string; scale: number } {
  let acc = roll * SPRITE_TOTAL_WEIGHT;
  for (const sprite of PILE_SPRITES) {
    acc -= sprite.weight;
    if (acc <= 0) return sprite;
  }
  return PILE_SPRITES[0]!;
}

interface PileCoin {
  x: number;
  y: number;
  threshold: number;
  tilt: number;
  size: number;
  href: string;
}

/** Deterministic pseudo-random: the pile must not re-scatter on every re-render. */
function seeded(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function buildPile(): PileCoin[] {
  const coins: PileCoin[] = [];
  const rows = Math.ceil(CAVITY_H / ROW_H);
  const centre = (CAVITY_LEFT + CAVITY_RIGHT) / 2;
  const halfWidth = (CAVITY_RIGHT - CAVITY_LEFT) / 2;
  let n = 0;

  for (let row = 0; row < rows; row += 1) {
    const y = CAVITY_BOTTOM - COIN_R - row * ROW_H;
    // The cavity narrows towards the base, so the usable width has to follow it or the lowest
    // rows push coins straight through the rounded corners.
    const depth = (CAVITY_BOTTOM - y) / CAVITY_H;
    const inset = depth < 0.12 ? (0.12 - depth) * 220 : 0;
    const left = CAVITY_LEFT + inset;
    const right = CAVITY_RIGHT - inset;

    // Lay each row out centred rather than left-anchored: stepping from the left wall until you
    // run out leaves all the slack piled against the right one, and the pile visibly hugs one
    // side of the jar.
    const step = COIN * 0.84;
    const usable = right - left - COIN;
    const perRow = Math.max(1, Math.floor(usable / step) + 1);
    const rowWidth = (perRow - 1) * step;
    const startX = left + COIN_R + (usable - rowWidth) / 2;
    // Alternate rows shift half a step so the stack interlocks instead of forming columns.
    const offset = row % 2 === 0 ? 0 : step / 2;

    for (let i = 0; i < perRow; i += 1) {
      const x = startX + i * step + offset;
      if (x + COIN_R > right) continue;
      n += 1;
      // Coins near the walls need a slightly higher fill before appearing, so the surface mounds
      // in the middle instead of being a dead-flat line across the jar.
      const edgeBias = (Math.abs(x - centre) / halfWidth) ** 2 * 0.07;
      const sprite = spriteFor(seeded(n + 2100));
      coins.push({
        x: x + (seeded(n) - 0.5) * 5,
        y: y + (seeded(n + 500) - 0.5) * 4,
        threshold: (row * ROW_H) / CAVITY_H + edgeBias,
        tilt: (seeded(n + 900) - 0.5) * 70,
        // Slight size variance breaks up the grid — identical discs in a lattice read as a
        // texture, not as loose change. Gift art is drawn a touch larger than a coin so it
        // stays recognisable at pile scale.
        size: COIN * sprite.scale * (0.9 + seeded(n + 1300) * 0.2),
        href: sprite.href,
      });
    }
  }
  return coins;
}

interface Drop {
  id: number;
  x: number;
  delay: number;
  landY: number;
  spin: number;
  href: string;
  size: number;
}

/** The gift's own artwork tumbling into the jar, ahead of the coins it converts into. */
interface GiftDrop {
  id: number;
  href: string;
  x: number;
  landY: number;
  spin: number;
}

let dropId = 0;

/** How long the gift image lingers in the jar before it fades and the coins land. */
const GIFT_LINGER_MS = 1500;

export function CoinJarWidget({
  settings,
  socket,
}: {
  settings: OverlayWidgetSettings | null;
  socket: Socket | null;
}) {
  const [coins, setCoins] = useState(0);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [giftDrops, setGiftDrops] = useState<GiftDrop[]>([]);
  const [sender, setSender] = useState<WidgetGiftPayload | null>(null);

  const style = widgetStyle(settings);
  const goal = Math.max(1, num(settings, "goalCoins", 1000));
  const perGift = num(settings, "coinsPerGift", 6);
  const showCounter = bool(settings, "showCounter", true);
  const showGoal = bool(settings, "showGoal", false);
  const showGiftInJar = bool(settings, "showGiftInJar", true);
  const showSenderCard = bool(settings, "showSenderCard", true);
  const senderSeconds = num(settings, "senderCardSeconds", 5);
  const label = str(settings, "labelAr", "");

  const pile = useMemo(buildPile, []);
  const fill = Math.min(1, coins / goal);

  useSnapshotEvent(socket, (snap) => setCoins(snap.totals.jarCoins));
  useSocketEvent<WidgetTotals>(socket, WidgetSocketEvents.Totals, (t) => setCoins(t.jarCoins));

  useSocketEvent<WidgetGiftPayload>(socket, WidgetSocketEvents.Gift, (gift) => {
    // Aim at where the pile will be *after* this gift is counted, not where it is now. The
    // totals broadcast that raises the pile arrives while these are still falling, so targeting
    // the current surface drops everything to a level the pile has already grown past — which
    // buried the gift artwork inside the coins instead of showing it above them.
    const projectedFill = Math.min(1, (coins + gift.totalCoins) / goal);
    const surface = CAVITY_BOTTOM - projectedFill * CAVITY_H - COIN_R;
    const landY = Math.max(CAVITY_TOP + COIN_R, surface);

    // --- Who sent it, shown under the jar and self-dismissing --------------------------
    if (showSenderCard) {
      setSender(gift);
      window.setTimeout(
        // Only clear if this is still the gift on screen — a newer gift during the window owns
        // the card and must not be wiped by the older one's timer.
        () => setSender((current) => (current?.at === gift.at ? null : current)),
        senderSeconds * 1000,
      );
    }

    // --- The gift's own artwork tumbling in ---------------------------------------------
    // TikTok sends the picture URL with the live event, so this is always the real, current
    // artwork for whatever gift was sent — nothing is bundled or cached locally. Falls back to
    // the coin when TikTok didn't include one (and for the Test button, which has no gift).
    const giftHref = showGiftInJar ? (gift.imageUrl ?? "/jar/coin.png") : null;
    let giftDelayMs = 0;

    if (giftHref) {
      // Hovers in the clear glass above the pile rather than landing on it: dropped all the way
      // to the surface it sits among the coins and is effectively invisible — which defeats the
      // point of showing which gift was sent. Clamped so a nearly-full jar still shows it.
      const giftLandY = Math.max(CAVITY_TOP + GIFT_SIZE / 2 + 8, surface - 62);
      const drop: GiftDrop = {
        id: ++dropId,
        href: giftHref,
        x: (CAVITY_LEFT + CAVITY_RIGHT) / 2 + (seeded(dropId) - 0.5) * 70,
        landY: giftLandY,
        spin: (seeded(dropId + 31) - 0.5) * 40,
      };
      setGiftDrops((prev) => [...prev, drop].slice(-6));
      window.setTimeout(
        () => setGiftDrops((prev) => prev.filter((g) => g.id !== drop.id)),
        GIFT_LINGER_MS + 600,
      );
      // Coins follow the gift rather than racing it, so it reads as the gift turning into coins.
      giftDelayMs = GIFT_LINGER_MS * 0.6;
    }

    // --- The coins it converts into ------------------------------------------------------
    const count = Math.max(1, Math.min(perGift, Math.round(gift.totalCoins / 5) || 1));
    window.setTimeout(() => {
      const batch: Drop[] = Array.from({ length: count }, (_, i) => {
        const sprite = spriteFor(seeded(dropId + i + 4200));
        return {
          id: ++dropId,
          x: CAVITY_LEFT + COIN_R + seeded(dropId + i) * (CAVITY_RIGHT - CAVITY_LEFT - COIN),
          delay: i * 0.09,
          landY,
          spin: (seeded(dropId + i + 77) - 0.5) * 360,
          href: sprite.href,
          size: COIN * sprite.scale,
        };
      });

      setDrops((prev) => [...prev, ...batch].slice(-40));
      window.setTimeout(
        () => {
          const ids = new Set(batch.map((b) => b.id));
          setDrops((prev) => prev.filter((d) => !ids.has(d.id)));
        },
        1500 + count * 90,
      );
    }, giftDelayMs);
  });

  return (
    <div
      dir="rtl"
      className="flex h-dvh w-full flex-col items-center justify-center gap-1 p-2"
      style={{ fontFamily: style.fontFamily, color: style.textColor }}
    >
      {label && (
        <p className="shrink-0 font-bold" style={{ fontSize: style.fontSize }}>
          {label}
        </p>
      )}

      <svg
        viewBox={`0 0 ${ART} ${ART}`}
        className="min-h-0 w-full flex-1"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <clipPath id="jar-cavity">
            <path d={CAVITY_PATH} />
          </clipPath>
        </defs>

        {/* 1 — back of the rim, behind everything */}
        <image href="/jar/jar-top-bg-2.png" x={MOUTH.x} y={MOUTH.y} width={MOUTH.w} height={MOUTH.h} />

        {/* 2 — inner base the pile sits on */}
        <image href="/jar/jar-bottom.png" x={BASE.x} y={BASE.y} width={BASE.w} height={BASE.h} />

        {/* 3 — the coins, confined to the cavity */}
        <g clipPath="url(#jar-cavity)">
          {/* `threshold < fill` with a `fill > 0` guard: the bottom row's threshold is exactly 0,
              so `<=` left coins sitting in a jar the counter called empty. */}
          {pile.map((coin, i) =>
            fill > 0 && coin.threshold < fill ? (
              <image
                key={i}
                href={coin.href}
                width={coin.size}
                height={coin.size}
                x={coin.x - coin.size / 2}
                y={coin.y - coin.size / 2}
                transform={`rotate(${coin.tilt} ${coin.x} ${coin.y})`}
              />
            ) : null,
          )}

          <AnimatePresence>
            {drops.map((drop) => (
              <motion.image
                key={drop.id}
                href={drop.href}
                width={drop.size}
                height={drop.size}
                x={drop.x - drop.size / 2}
                initial={{ y: CAVITY_TOP - 110, opacity: 0, rotate: 0 }}
                animate={{ y: drop.landY - drop.size / 2, opacity: [0, 1, 1, 1], rotate: drop.spin }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.8,
                  delay: drop.delay,
                  // Accelerating, not linear — a constant-speed drop reads as floating.
                  ease: [0.45, 0, 0.75, 1],
                }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
            ))}
          </AnimatePresence>

          {/* The gift itself, dropped in before its coins. Bigger than a coin so it reads as
              the actual thing that was sent, and it fades once the coins arrive. */}
          <AnimatePresence>
            {giftDrops.map((gift) => (
              <motion.image
                key={gift.id}
                href={gift.href}
                width={GIFT_SIZE}
                height={GIFT_SIZE}
                x={gift.x - GIFT_SIZE / 2}
                crossOrigin="anonymous"
                initial={{ y: CAVITY_TOP - 150, opacity: 0, rotate: 0 }}
                animate={{
                  y: [CAVITY_TOP - 150, gift.landY - GIFT_SIZE / 2, gift.landY - GIFT_SIZE / 2],
                  opacity: [0, 1, 1, 0],
                  rotate: gift.spin,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: (GIFT_LINGER_MS + 600) / 1000, times: [0, 0.35, 0.8, 1] }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
            ))}
          </AnimatePresence>
        </g>

        {/* 4 — the glass, last, so the coins are behind it */}
        <image href="/jar/jar-top.png" x={0} y={0} width={ART} height={ART} />
      </svg>

      {/* Who just gave, and how much — self-dismissing so the overlay doesn't accumulate
          stale names on screen between gifts. */}
      <div className="flex h-14 shrink-0 items-center justify-center">
        <AnimatePresence mode="wait">
          {showSenderCard && sender && (
            <motion.div
              key={sender.at}
              initial={{ opacity: 0, y: 14, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="flex items-center gap-2.5 rounded-2xl border px-2.5 py-1.5"
              style={{
                background: "rgba(10, 6, 22, 0.82)",
                borderColor: "rgba(255,255,255,0.14)",
                boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
              }}
            >
              {/* The gift that was sent, as its badge. */}
              <img
                src={sender.imageUrl ?? "/jar/coin.png"}
                alt=""
                referrerPolicy="no-referrer"
                className="shrink-0 object-contain"
                style={{ width: style.fontSize * 1.5, height: style.fontSize * 1.5 }}
              />

              {sender.viewer.avatarUrl ? (
                <img
                  src={sender.viewer.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="shrink-0 rounded-full object-cover"
                  style={{
                    width: style.fontSize * 1.7,
                    height: style.fontSize * 1.7,
                    border: "2px solid rgba(255,255,255,0.25)",
                  }}
                />
              ) : (
                <span
                  className="grid shrink-0 place-items-center rounded-full bg-white/20 font-bold"
                  style={{ width: style.fontSize * 1.7, height: style.fontSize * 1.7 }}
                >
                  {sender.viewer.displayName.slice(0, 1)}
                </span>
              )}

              <span
                className="max-w-[11ch] truncate font-bold"
                style={{ fontSize: style.fontSize * 0.9 }}
              >
                <bdi>{sender.viewer.displayName}</bdi>
              </span>

              <span
                className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1"
                style={{ background: "rgba(251, 191, 36, 0.16)" }}
              >
                <img
                  src="/jar/coin.png"
                  alt=""
                  style={{ width: style.fontSize * 0.85, height: style.fontSize * 0.85 }}
                />
                <span
                  dir="ltr"
                  className="font-bold tabular-nums"
                  style={{ fontSize: style.fontSize * 0.9, color: "#fbbf24" }}
                >
                  {sender.totalCoins.toLocaleString("en-US")}
                </span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showCounter && (
        <motion.div
          key={coins}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.14, 1] }}
          transition={{ duration: 0.35 }}
          className="flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5"
          style={{ background: style.panelBg }}
        >
          <img src="/jar/coin.png" alt="" style={{ width: style.fontSize, height: style.fontSize }} />
          {/* dir="ltr": "20 / 1,000" bidi-reorders inside RTL text and the numbers swap. */}
          <span dir="ltr" className="font-bold tabular-nums" style={{ fontSize: style.fontSize }}>
            {coins.toLocaleString("en-US")}
            {showGoal ? ` / ${goal.toLocaleString("en-US")}` : ""}
          </span>
        </motion.div>
      )}
    </div>
  );
}
