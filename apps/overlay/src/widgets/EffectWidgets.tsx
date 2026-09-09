import {
  WidgetSocketEvents,
  type OverlayWidgetSettings,
  type WidgetGiftPayload,
  type WidgetLikePayload,
} from "@tikgames/shared-types";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { Socket } from "socket.io-client";
import { bool, num, str, useSnapshotEvent, useSocketEvent, widgetStyle } from "../lib/widget";

/**
 * Effect widgets are full-screen and must stay transparent — they sit on top of the whole scene
 * in OBS. They also have to bound their own element count: a busy stream fires likes several
 * times a second, and an unbounded list of animating nodes will drag the browser source (and OBS
 * with it) to a crawl within minutes.
 */
const MAX_LIVE_ELEMENTS = 60;

let elementId = 0;

// --- Like fountain -------------------------------------------------------------------

interface Heart {
  id: number;
  left: number;
  drift: number;
  duration: number;
  delay: number;
}

export function LikeFountainWidget({
  settings,
  socket,
}: {
  settings: OverlayWidgetSettings | null;
  socket: Socket | null;
}) {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const accent = str(settings, "accent", "#f43f5e");
  const intensity = num(settings, "intensity", 4);
  const rise = num(settings, "riseSeconds", 4);
  const size = num(settings, "sizePx", 34);

  useSocketEvent<WidgetLikePayload>(socket, WidgetSocketEvents.Like, (payload) => {
    // One heart per N likes, capped — a viewer can send 15 likes in one payload, and a burst of
    // 15 simultaneous elements per event compounds fast on an active stream.
    const count = Math.min(intensity, Math.max(1, Math.round(payload.count / 3)));
    const batch: Heart[] = Array.from({ length: count }, (_, i) => ({
      id: ++elementId,
      left: 5 + Math.random() * 90,
      drift: (Math.random() - 0.5) * 140,
      duration: rise * (0.75 + Math.random() * 0.5),
      delay: i * 0.09,
    }));

    setHearts((prev) => [...prev, ...batch].slice(-MAX_LIVE_ELEMENTS));
    const longest = (rise * 1.25 + count * 0.09) * 1000;
    window.setTimeout(() => {
      const ids = new Set(batch.map((b) => b.id));
      setHearts((prev) => prev.filter((h) => !ids.has(h.id)));
    }, longest);
  });

  return (
    <div className="pointer-events-none relative h-dvh w-full overflow-hidden">
      {hearts.map((heart) => (
        <motion.span
          key={heart.id}
          initial={{ opacity: 0, y: 0, x: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 1, 0], y: "-90vh", x: heart.drift, scale: [0.5, 1, 1, 0.8] }}
          transition={{ duration: heart.duration, delay: heart.delay, ease: "easeOut" }}
          className="absolute bottom-0"
          style={{ left: `${heart.left}%`, fontSize: size, color: accent, lineHeight: 1 }}
        >
          ♥
        </motion.span>
      ))}
    </div>
  );
}

// --- Gift cannon ---------------------------------------------------------------------

interface Flight {
  id: number;
  gift: WidgetGiftPayload;
  top: number;
  duration: number;
}

export function GiftCannonWidget({
  settings,
  socket,
}: {
  settings: OverlayWidgetSettings | null;
  socket: Socket | null;
}) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const accent = str(settings, "accent", "#a855f7");
  const textColor = str(settings, "textColor", "#ffffff");
  const seconds = num(settings, "flightSeconds", 5);
  const avatarSize = num(settings, "avatarSize", 78);
  const showGiftName = bool(settings, "showGiftName", true);

  useSocketEvent<WidgetGiftPayload>(socket, WidgetSocketEvents.Gift, (gift) => {
    const flight: Flight = {
      id: ++elementId,
      gift,
      top: 10 + Math.random() * 65,
      duration: seconds,
    };
    setFlights((prev) => [...prev, flight].slice(-12));
    window.setTimeout(
      () => setFlights((prev) => prev.filter((f) => f.id !== flight.id)),
      seconds * 1000 + 400,
    );
  });

  return (
    <div dir="rtl" className="pointer-events-none relative h-dvh w-full overflow-hidden">
      <AnimatePresence>
        {flights.map((flight) => (
          <motion.div
            key={flight.id}
            initial={{ x: "-25vw", opacity: 0 }}
            animate={{ x: "110vw", opacity: [0, 1, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: flight.duration, ease: "linear" }}
            className="absolute flex items-center gap-3"
            style={{ top: `${flight.top}%` }}
          >
            {flight.gift.viewer.avatarUrl ? (
              <img
                src={flight.gift.viewer.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="rounded-full object-cover"
                style={{ width: avatarSize, height: avatarSize, border: `3px solid ${accent}` }}
              />
            ) : (
              <span
                className="grid place-items-center rounded-full font-bold"
                style={{
                  width: avatarSize,
                  height: avatarSize,
                  border: `3px solid ${accent}`,
                  background: "rgba(255,255,255,0.15)",
                  color: textColor,
                  fontSize: avatarSize * 0.4,
                }}
              >
                {flight.gift.viewer.displayName.slice(0, 1)}
              </span>
            )}

            <div
              className="rounded-2xl px-4 py-2 backdrop-blur-sm"
              style={{ background: "rgba(8,5,18,0.55)", color: textColor, border: `1px solid ${accent}` }}
            >
              <p className="font-bold leading-tight">
                <bdi>{flight.gift.viewer.displayName}</bdi>
              </p>
              {showGiftName && (
                <p className="text-sm opacity-85">
                  {flight.gift.giftName ?? "هدية"}
                  {flight.gift.repeatCount > 1 ? ` ×${flight.gift.repeatCount}` : ""}
                </p>
              )}
            </div>

            {flight.gift.imageUrl && (
              <img src={flight.gift.imageUrl} alt="" referrerPolicy="no-referrer" className="h-14 w-14 object-contain" />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// --- Gift goal -----------------------------------------------------------------------

export function GiftGoalWidget({
  settings,
  socket,
}: {
  settings: OverlayWidgetSettings | null;
  socket: Socket | null;
}) {
  const [coins, setCoins] = useState(0);
  const style = widgetStyle(settings);
  const goal = Math.max(1, num(settings, "goalCoins", 1000));
  const title = str(settings, "titleAr", "هدف اللايف");
  const showNumbers = bool(settings, "showNumbers", true);

  useSnapshotEvent(socket, (snap) => setCoins(snap.totals.totalCoins));
  useSocketEvent<{ totalCoins: number }>(socket, WidgetSocketEvents.Totals, (totals) =>
    setCoins(totals.totalCoins),
  );
  // The Test button fires a gift, not a totals update (there's no live tally to update on a
  // stream that isn't running), so nudge the bar locally too.
  useSocketEvent<WidgetGiftPayload>(socket, WidgetSocketEvents.Gift, (gift) =>
    setCoins((prev) => (gift.viewer.handle === "tikgames_test" ? prev + gift.totalCoins : prev)),
  );

  const percent = Math.min(100, (coins / goal) * 100);
  const reached = coins >= goal;

  return (
    <div
      dir="rtl"
      className="flex h-dvh w-full flex-col justify-center p-3"
      style={{ fontFamily: style.fontFamily, color: style.textColor, fontSize: style.fontSize }}
    >
      <div className="rounded-2xl p-4" style={{ background: style.panelBg }}>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-bold">{title}</span>
          {showNumbers && (
            // dir="ltr" is load-bearing: "40 / 1,000" inside an RTL block gets bidi-reordered
            // into "1,000 / 40" — the two numbers swap and the progress reads backwards. Any
            // number-separator-number pair on this overlay needs its own direction.
            <span dir="ltr" className="font-bold tabular-nums" style={{ color: style.accent }}>
              {coins.toLocaleString("en-US")} / {goal.toLocaleString("en-US")}
            </span>
          )}
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: reached
                ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                : `linear-gradient(90deg, ${style.accent}, #ffffff55)`,
            }}
            animate={{ width: `${percent}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          />
        </div>
        {reached && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-center font-bold"
            style={{ color: "#fbbf24" }}
          >
            🎉 وصلنا للهدف!
          </motion.p>
        )}
      </div>
    </div>
  );
}
