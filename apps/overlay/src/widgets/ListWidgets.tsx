import {
  LiveSocketEvents,
  WidgetSocketEvents,
  type NormalizedViewer,
  type OverlayWidgetSettings,
  type WidgetGiftPayload,
  type WidgetRankRow,
  type WidgetTotals,
} from "@tikgames/shared-types";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { PREVIEW_TOKEN, bool, num, str, useSnapshotEvent, useSocketEvent, widgetStyle } from "../lib/widget";

/** Shared frame for the panel-style widgets so they line up visually when stacked in OBS. */
function Panel({
  settings,
  title,
  children,
}: {
  settings: OverlayWidgetSettings | null;
  title?: string;
  children: React.ReactNode;
}) {
  const style = widgetStyle(settings);
  return (
    <div
      dir="rtl"
      className="flex h-dvh w-full flex-col gap-2 overflow-hidden p-3"
      style={{ fontFamily: style.fontFamily, color: style.textColor, fontSize: style.fontSize }}
    >
      {title && (
        // The accent used to be a `borderInlineEnd` on this rounded box, which rendered as a
        // detached crescent at the far edge — it read as a stray bracket, not a design element.
        // A real child bar sits flush inside the padding instead.
        <div
          className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 font-bold"
          style={{ background: style.panelBg }}
        >
          <span
            className="h-[1.1em] w-1 shrink-0 rounded-full"
            style={{ background: style.accent }}
          />
          {title}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">{children}</div>
    </div>
  );
}

function Avatar({ viewer, size }: { viewer: { displayName: string; avatarUrl: string | null }; size: number }) {
  if (viewer.avatarUrl) {
    return (
      <img
        src={viewer.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-white/20 font-bold"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {viewer.displayName.slice(0, 1)}
    </span>
  );
}

// --- Chat ---------------------------------------------------------------------------

interface ChatLine {
  id: number;
  viewer: NormalizedViewer;
  text: string;
}

let chatLineId = 0;

export function ChatWidget({ settings, socket }: { settings: OverlayWidgetSettings | null; socket: Socket | null }) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const style = widgetStyle(settings);
  const max = num(settings, "maxMessages", 12);
  const showAvatars = bool(settings, "showAvatars", true);
  const hideAfter = num(settings, "hideAfterSeconds", 0);

  useSocketEvent<{ viewer: NormalizedViewer; text: string }>(
    socket,
    LiveSocketEvents.ChatComment,
    (payload) => {
      const id = ++chatLineId;
      setLines((prev) => [...prev, { id, viewer: payload.viewer, text: payload.text }].slice(-max));
      if (hideAfter > 0) {
        window.setTimeout(() => setLines((prev) => prev.filter((l) => l.id !== id)), hideAfter * 1000);
      }
    },
  );

  return (
    <Panel settings={settings}>
      <div className="flex flex-1 flex-col justify-end gap-1.5 overflow-hidden">
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25 }}
              className="flex items-start gap-2 rounded-xl px-3 py-2"
              style={{ background: style.panelBg }}
            >
              {showAvatars && <Avatar viewer={line.viewer} size={style.fontSize * 1.5} />}
              <p className="min-w-0 leading-snug">
                <span className="font-bold" style={{ color: style.accent }}>
                  <bdi>{line.viewer.displayName}</bdi>
                </span>
                <span className="mx-1">:</span>
                <span className="break-words">{line.text}</span>
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

// --- Gift feed ----------------------------------------------------------------------

export function GiftFeedWidget({
  settings,
  socket,
}: {
  settings: OverlayWidgetSettings | null;
  socket: Socket | null;
}) {
  const [gifts, setGifts] = useState<WidgetGiftPayload[]>([]);
  const style = widgetStyle(settings);
  const max = num(settings, "maxItems", 8);
  const showCoins = bool(settings, "showCoins", true);

  useSnapshotEvent(socket, (snap) => setGifts(snap.recentGifts.slice(0, max)));
  useSocketEvent<WidgetGiftPayload>(socket, WidgetSocketEvents.Gift, (gift) =>
    setGifts((prev) => [gift, ...prev].slice(0, max)),
  );

  return (
    <Panel settings={settings}>
      <AnimatePresence initial={false}>
        {gifts.map((gift, i) => (
          <motion.div
            key={`${gift.viewer.handle}-${gift.at}-${i}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: style.panelBg }}
          >
            <Avatar viewer={gift.viewer} size={style.fontSize * 1.7} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate font-bold">
                <bdi>{gift.viewer.displayName}</bdi>
              </p>
              <p className="truncate opacity-80" style={{ fontSize: style.fontSize * 0.8 }}>
                {gift.giftName ?? "هدية"}
                {gift.repeatCount > 1 ? ` ×${gift.repeatCount}` : ""}
              </p>
            </div>
            {gift.imageUrl && (
              <img src={gift.imageUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-8 object-contain" />
            )}
            {showCoins && gift.totalCoins > 0 && (
              <span className="shrink-0 font-bold tabular-nums" style={{ color: style.accent }}>
                {gift.totalCoins}
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </Panel>
  );
}

// --- Rank lists (top gifters / top likers) --------------------------------------------

const MEDALS = ["🥇", "🥈", "🥉"];

function RankList({
  settings,
  rows,
  suffix,
  showValue = true,
}: {
  settings: OverlayWidgetSettings | null;
  rows: WidgetRankRow[];
  suffix?: string;
  showValue?: boolean;
}) {
  const style = widgetStyle(settings);
  const top = num(settings, "topCount", 5);

  return (
    <Panel settings={settings} title={str(settings, "titleAr", "")}>
      {rows.slice(0, top).map((row, i) => (
        <motion.div
          key={row.handle}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: style.panelBg }}
        >
          <span className="w-7 shrink-0 text-center font-bold" style={{ color: style.accent }}>
            {MEDALS[i] ?? i + 1}
          </span>
          <Avatar viewer={row} size={style.fontSize * 1.6} />
          <p className="min-w-0 flex-1 truncate font-semibold">
            <bdi>{row.displayName}</bdi>
          </p>
          {showValue && (
            <span className="shrink-0 font-bold tabular-nums" style={{ color: style.accent }}>
              {row.value.toLocaleString("en-US")}
              {suffix}
            </span>
          )}
        </motion.div>
      ))}
    </Panel>
  );
}

export function TopGiftersWidget({
  settings,
  socket,
}: {
  settings: OverlayWidgetSettings | null;
  socket: Socket | null;
}) {
  const [rows, setRows] = useState<WidgetRankRow[]>([]);
  useSnapshotEvent(socket, (s) => setRows(s.totals.topGifters));
  useSocketEvent<WidgetTotals>(socket, WidgetSocketEvents.Totals, (t) => setRows(t.topGifters));
  return <RankList settings={settings} rows={rows} showValue={bool(settings, "showCoins", true)} />;
}

export function TopLikersWidget({
  settings,
  socket,
}: {
  settings: OverlayWidgetSettings | null;
  socket: Socket | null;
}) {
  const [rows, setRows] = useState<WidgetRankRow[]>([]);
  useSnapshotEvent(socket, (s) => setRows(s.totals.topLikers));
  useSocketEvent<WidgetTotals>(socket, WidgetSocketEvents.Totals, (t) => setRows(t.topLikers));
  return <RankList settings={settings} rows={rows} />;
}

// --- Cumulative ranking (reads the persisted leaderboard, not session tallies) ---------

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const RANKING_REFRESH_MS = 30_000;

export function RankingWidget({
  settings,
  overlayToken,
}: {
  settings: OverlayWidgetSettings | null;
  overlayToken: string;
}) {
  const [rows, setRows] = useState<WidgetRankRow[]>([]);

  useEffect(() => {
    // Previews have no session to read standings for, so they show made-up ones. Everything
    // else on this widget is the real component.
    if (overlayToken === PREVIEW_TOKEN) {
      setRows([
        { handle: "sara_92", displayName: "سارة", avatarUrl: null, value: 1840 },
        { handle: "youssef", displayName: "Youssef", avatarUrl: null, value: 1520 },
        { handle: "noor", displayName: "نور", avatarUrl: null, value: 990 },
        { handle: "omar_dev", displayName: "عمر", avatarUrl: null, value: 640 },
        { handle: "lina", displayName: "Lina", avatarUrl: null, value: 410 },
        { handle: "khaled", displayName: "خالد", avatarUrl: null, value: 275 },
      ]);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${API_URL}/leaderboard/public/${overlayToken}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setRows(data.rows ?? []);
      } catch {
        // Keep whatever is on screen — an overlay that blanks on a transient fetch error is
        // worse than one showing slightly stale standings.
      }
    }

    void load();
    // Cumulative standings move slowly; polling beats a socket channel nothing else needs.
    const id = window.setInterval(load, RANKING_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [overlayToken]);

  return <RankList settings={settings} rows={rows} />;
}
