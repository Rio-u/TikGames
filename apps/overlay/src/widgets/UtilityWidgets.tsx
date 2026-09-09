import {
  LiveSocketEvents,
  WidgetSocketEvents,
  type LiveRoomStats,
  type OverlayWidgetSettings,
  type WidgetFollowPayload,
  type WidgetTimerState,
} from "@tikgames/shared-types";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { num, str, useSnapshotEvent, useSocketEvent, widgetStyle } from "../lib/widget";

function Card({
  settings,
  children,
}: {
  settings: OverlayWidgetSettings | null;
  children: React.ReactNode;
}) {
  const style = widgetStyle(settings);
  return (
    <div
      dir="rtl"
      className="flex h-dvh w-full items-center justify-center p-3"
      style={{ fontFamily: style.fontFamily, color: style.textColor, fontSize: style.fontSize }}
    >
      {/* Accent as an inset child bar, not a border on the rounded box — a border there renders
          as a detached crescent at the edge (see the same fix in ListWidgets' Panel). */}
      <div
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: style.panelBg }}
      >
        <span className="h-[1.6em] w-1 shrink-0 rounded-full" style={{ background: style.accent }} />
        {children}
      </div>
    </div>
  );
}

// --- Viewer count ---------------------------------------------------------------------

export function ViewerCountWidget({
  settings,
  socket,
}: {
  settings: OverlayWidgetSettings | null;
  socket: Socket | null;
}) {
  const [stats, setStats] = useState<LiveRoomStats | null>(null);
  const style = widgetStyle(settings);
  const label = str(settings, "labelAr", "مشاهد");
  const showFollowers = settings?.showFollowers === true;

  useSocketEvent<LiveRoomStats>(socket, LiveSocketEvents.RoomStats, setStats);

  // Every field on LiveRoomStats can legitimately be null — TikTok's room payload is undocumented
  // and often partial. Hiding the widget beats printing a fabricated number on a live stream.
  if (stats?.viewerCount === null || stats?.viewerCount === undefined) {
    return <div className="h-dvh w-full" />;
  }

  return (
    <Card settings={settings}>
      <span style={{ fontSize: style.fontSize * 1.3 }}>👁</span>
      <span className="font-bold tabular-nums" style={{ fontSize: style.fontSize * 1.5, color: style.accent }}>
        {stats.viewerCount.toLocaleString("en-US")}
      </span>
      <span className="opacity-85">{label}</span>
      {showFollowers && stats.followerCount !== null && (
        <span className="mr-auto opacity-70" style={{ fontSize: style.fontSize * 0.85 }}>
          {stats.followerCount.toLocaleString("en-US")} متابع
        </span>
      )}
    </Card>
  );
}

// --- Last follower ----------------------------------------------------------------------

export function LastFollowerWidget({
  settings,
  socket,
}: {
  settings: OverlayWidgetSettings | null;
  socket: Socket | null;
}) {
  const [follower, setFollower] = useState<WidgetFollowPayload | null>(null);
  const style = widgetStyle(settings);
  const label = str(settings, "labelAr", "آخر متابع");
  const hideAfter = num(settings, "hideAfterSeconds", 0);

  useSnapshotEvent(socket, (snap) => setFollower(snap.lastFollower));
  useSocketEvent<WidgetFollowPayload>(socket, WidgetSocketEvents.Follow, (payload) => {
    setFollower(payload);
    if (hideAfter > 0) {
      window.setTimeout(
        () => setFollower((current) => (current?.at === payload.at ? null : current)),
        hideAfter * 1000,
      );
    }
  });

  return (
    <div className="h-dvh w-full">
      <AnimatePresence>
        {follower && (
          <motion.div
            key={follower.at}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="h-full"
          >
            <Card settings={settings}>
              {follower.viewer.avatarUrl ? (
                <img
                  src={follower.viewer.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="rounded-full object-cover"
                  style={{ width: style.fontSize * 2.2, height: style.fontSize * 2.2 }}
                />
              ) : (
                <span
                  className="grid place-items-center rounded-full bg-white/20 font-bold"
                  style={{ width: style.fontSize * 2.2, height: style.fontSize * 2.2 }}
                >
                  {follower.viewer.displayName.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0 leading-tight">
                <p className="opacity-75" style={{ fontSize: style.fontSize * 0.8 }}>
                  {label}
                </p>
                <p className="truncate font-bold">
                  <bdi>{follower.viewer.displayName}</bdi>
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Timer -------------------------------------------------------------------------------

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function TimerWidget({
  settings,
  socket,
}: {
  settings: OverlayWidgetSettings | null;
  socket: Socket | null;
}) {
  const [timer, setTimer] = useState<WidgetTimerState>({ endsAt: null, label: "", running: false });
  const [remaining, setRemaining] = useState(0);
  const style = widgetStyle(settings);
  const warnAt = num(settings, "warnAtSeconds", 10);
  const label = str(settings, "labelAr", "");

  useSnapshotEvent(socket, (snap) => setTimer(snap.timer));
  useSocketEvent<WidgetTimerState>(socket, WidgetSocketEvents.Timer, setTimer);

  // Ticks toward the server's `endsAt`, never counting on its own — same server-authoritative
  // rule every game's countdown follows, so a widget reloaded mid-timer resumes correctly.
  useEffect(() => {
    if (!timer.endsAt) {
      setRemaining(0);
      return;
    }
    const target = new Date(timer.endsAt).getTime();
    const tick = () => setRemaining(Math.max(0, (target - Date.now()) / 1000));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [timer.endsAt]);

  if (!timer.endsAt) return <div className="h-dvh w-full" />;

  const warning = remaining <= warnAt && remaining > 0;
  const shownLabel = label || timer.label;

  return (
    <div
      dir="rtl"
      className="flex h-dvh w-full items-center justify-center p-3"
      style={{ fontFamily: style.fontFamily, color: style.textColor }}
    >
      <div className="rounded-2xl px-6 py-3 text-center" style={{ background: style.panelBg }}>
        {shownLabel && (
          <p className="mb-1 opacity-80" style={{ fontSize: style.fontSize * 0.85 }}>
            {shownLabel}
          </p>
        )}
        <motion.p
          animate={warning ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={warning ? { duration: 1, repeat: Infinity } : undefined}
          className="font-bold tabular-nums"
          style={{ fontSize: style.fontSize * 2.4, color: warning ? "#f87171" : style.accent }}
        >
          {formatClock(remaining)}
        </motion.p>
      </div>
    </div>
  );
}

// --- Social rotator ------------------------------------------------------------------------

export function SocialRotatorWidget({ settings }: { settings: OverlayWidgetSettings | null }) {
  const raw = str(settings, "handles", "");
  const rotateSeconds = num(settings, "rotateSeconds", 6);
  const style = widgetStyle(settings);

  const entries = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [platform, ...rest] = part.split(":");
      const handle = rest.join(":").trim();
      return handle
        ? { platform: (platform ?? "").trim(), handle }
        : { platform: "", handle: (platform ?? "").trim() };
    });

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (entries.length <= 1) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % entries.length),
      rotateSeconds * 1000,
    );
    return () => window.clearInterval(id);
  }, [entries.length, rotateSeconds]);

  if (entries.length === 0) return <div className="h-dvh w-full" />;
  const current = entries[index % entries.length]!;

  return (
    <div className="h-dvh w-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${current.platform}-${current.handle}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.35 }}
          className="h-full"
        >
          <Card settings={settings}>
            {current.platform && (
              <span className="font-bold uppercase opacity-70" style={{ fontSize: style.fontSize * 0.75 }}>
                {current.platform}
              </span>
            )}
            <span className="font-bold" dir="ltr" style={{ color: style.accent }}>
              <bdi>{current.handle}</bdi>
            </span>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
