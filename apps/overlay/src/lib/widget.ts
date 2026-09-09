import { WidgetSocketEvents, type OverlayWidgetSettings, type WidgetSnapshot } from "@tikgames/shared-types";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { asSocket, createDemoSocket } from "./demoSocket";
import { connectOverlaySocket } from "./socket";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/**
 * Last snapshot seen per socket.
 *
 * The server emits `widget:snapshot` the moment the overlay socket connects, but the widget
 * component that wants it doesn't mount until the settings fetch resolves — two independent
 * races on every page load. When the socket wins, the snapshot fires with no listener attached
 * and is gone: the widget then sits empty until the next real gift, which is precisely the
 * "added mid-stream and looks broken" case the snapshot exists to prevent.
 *
 * So the listener is attached at socket-creation time (before any widget renders) and the
 * payload parked here; `useSnapshotEvent` replays it to whoever subscribes later. A WeakMap so a
 * disconnected socket's entry can be collected with it.
 */
const snapshotBuffer = new WeakMap<Socket, WidgetSnapshot>();

/**
 * Everything a widget page needs: its resolved settings (defaults + the streamer's overrides)
 * and a live socket scoped to the overlay token.
 *
 * A widget is a passive browser source. It never writes, never authenticates as a user, and must
 * render *something* sane before data arrives — OBS shows whatever is on screen, including the
 * blank half-second while a fetch is in flight.
 */
/**
 * Reserved token that means "this is a preview, not a real overlay".
 *
 * A preview needs neither a live session nor a saved config: settings ride in the URL and the
 * data is generated locally. That's what lets the gallery show every widget in motion, and the
 * customise dialog update as sliders move, without the streamer having to go live first.
 */
export const PREVIEW_TOKEN = "preview";

/** Preview settings travel as a JSON query param so the dialog can preview unsaved edits. */
function settingsFromUrl(): OverlayWidgetSettings {
  try {
    const raw = new URLSearchParams(window.location.search).get("s");
    return raw ? (JSON.parse(raw) as OverlayWidgetSettings) : {};
  } catch {
    return {};
  }
}

export function useWidget(overlayToken: string | undefined, widgetId: string) {
  const [settings, setSettings] = useState<OverlayWidgetSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const isPreview = overlayToken === PREVIEW_TOKEN;

  useEffect(() => {
    if (!overlayToken) return;

    if (isPreview) {
      setSettings(settingsFromUrl());
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/overlays/public/${overlayToken}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!cancelled) setSettings(data.settings?.[widgetId] ?? {});
      } catch {
        if (!cancelled) setError("رابط الأوفرلاي مش صحيح");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [overlayToken, widgetId, isPreview]);

  useEffect(() => {
    if (!overlayToken) return;

    if (isPreview) {
      const demo = createDemoSocket();
      const s = asSocket(demo);
      s.on(WidgetSocketEvents.Snapshot, (snap: WidgetSnapshot) => snapshotBuffer.set(s, snap));
      setSocket(s);
      return () => demo.stop();
    }

    const s = connectOverlaySocket(overlayToken);
    // Attached here, not in the widget: this must be listening before the first render, and it
    // must survive reconnects (the server re-sends a snapshot on every connect).
    s.on(WidgetSocketEvents.Snapshot, (snap: WidgetSnapshot) => snapshotBuffer.set(s, snap));
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [overlayToken, isPreview]);

  return { settings, socket, error };
}

/**
 * Subscribes to snapshots *and* immediately replays the one that already arrived, if any.
 * Every widget that seeds itself from accumulated state should use this instead of
 * `useSocketEvent(socket, WidgetSocketEvents.Snapshot, ...)`.
 */
export function useSnapshotEvent(socket: Socket | null, handler: (snap: WidgetSnapshot) => void): void {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!socket) return;

    const buffered = snapshotBuffer.get(socket);
    if (buffered) ref.current(buffered);

    const fn = (snap: WidgetSnapshot) => ref.current(snap);
    socket.on(WidgetSocketEvents.Snapshot, fn);
    return () => {
      socket.off(WidgetSocketEvents.Snapshot, fn);
    };
  }, [socket]);
}

/** Subscribes to one socket event for the lifetime of the component. The handler is kept in a ref
 *  so a closure over changing state doesn't force a resubscribe on every render — a resubscribe
 *  loop here drops events silently, which on an overlay looks like "it just stopped working". */
export function useSocketEvent<T>(
  socket: Socket | null,
  event: string,
  handler: (payload: T) => void,
): void {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!socket) return;
    const fn = (payload: T) => ref.current(payload);
    socket.on(event, fn);
    return () => {
      socket.off(event, fn);
    };
  }, [socket, event]);
}

const FONT_STACKS: Record<string, string> = {
  cairo: '"Cairo", "Segoe UI", sans-serif',
  tajawal: '"Tajawal", "Cairo", "Segoe UI", sans-serif',
  system: 'system-ui, "Segoe UI", sans-serif',
};

/** Turns the generic settings object into inline styles. Kept in one place so every widget reads
 *  the same keys the same way — `accent` always means accent, in all twelve. */
export function widgetStyle(settings: OverlayWidgetSettings | null): {
  accent: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  panelBg: string;
} {
  const s = settings ?? {};
  const opacity = Math.min(100, Math.max(0, Number(s.bgOpacity ?? 35))) / 100;
  return {
    accent: String(s.accent ?? "#a855f7"),
    textColor: String(s.textColor ?? "#ffffff"),
    fontFamily: FONT_STACKS[String(s.font ?? "cairo")] ?? FONT_STACKS.cairo!,
    fontSize: Number(s.fontSize ?? 18),
    panelBg: `rgba(8, 5, 18, ${opacity})`,
  };
}

export function num(settings: OverlayWidgetSettings | null, key: string, fallback: number): number {
  const v = Number((settings ?? {})[key]);
  return Number.isFinite(v) ? v : fallback;
}

export function bool(settings: OverlayWidgetSettings | null, key: string, fallback: boolean): boolean {
  const v = (settings ?? {})[key];
  return typeof v === "boolean" ? v : fallback;
}

export function str(settings: OverlayWidgetSettings | null, key: string, fallback: string): string {
  const v = (settings ?? {})[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}
