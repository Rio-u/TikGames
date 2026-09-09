import {
  LiveSocketEvents,
  WidgetSocketEvents,
  type WidgetGiftPayload,
  type WidgetRankRow,
  type WidgetSnapshot,
} from "@tikgames/shared-types";
import type { Socket } from "socket.io-client";

/**
 * A stand-in for the overlay socket that emits believable made-up activity.
 *
 * This is what powers every preview, so the gallery and the customise dialog work with no live
 * session at all — a streamer can pick colours and sizes at 3am with nothing running. It
 * deliberately implements only `on`/`off`/`emit`, which is the entire surface the widgets touch,
 * so no widget needs a demo branch: they cannot tell the difference, which also means the
 * preview is a real test of the widget rather than a separate mock rendering.
 *
 * Nothing here ever runs on a real overlay URL — see useWidget: the demo socket is created only
 * for the reserved `preview` token.
 */

const NAMES = [
  { handle: "sara_92", displayName: "سارة" },
  { handle: "youssef", displayName: "Youssef" },
  { handle: "noor", displayName: "نور" },
  { handle: "omar_dev", displayName: "عمر" },
  { handle: "lina", displayName: "Lina" },
];

const GIFTS = [
  { name: "وردة", image: "/jar/gifts/rose.webp", coins: 1 },
  { name: "قلب", image: "/jar/gifts/heart.webp", coins: 1 },
  { name: "دونات", image: "/jar/gifts/doughnut.webp", coins: 30 },
  { name: "آيس كريم", image: "/jar/gifts/ice-cream.webp", coins: 1 },
  { name: "كيك", image: "/jar/gifts/cake.webp", coins: 1 },
  { name: "عطر", image: "/jar/gifts/perfume.webp", coins: 20 },
  { name: "فينجر هارت", image: "/jar/gifts/finger-heart.webp", coins: 5 },
];

const MESSAGES = [
  "يلا نلعب 🔥",
  "أنا أنا أنا",
  "الإجابة 2",
  "تحياتي من مصر ❤️",
  "شغّل اللعبة تاني",
  "برافو 👏",
];

type Handler = (payload: unknown) => void;

export interface DemoSocket {
  on(event: string, fn: Handler): void;
  off(event: string, fn: Handler): void;
  emit(event: string, payload?: unknown): void;
  stop(): void;
}

function pick<T>(list: T[], i: number): T {
  return list[i % list.length]!;
}

export function createDemoSocket(): DemoSocket {
  const handlers = new Map<string, Set<Handler>>();
  const timers: number[] = [];

  let step = 0;
  let totalCoins = 0;
  let totalLikes = 0;
  let jarCoins = 0;
  const recentGifts: WidgetGiftPayload[] = [];
  const coinsByHandle = new Map<string, number>();
  const likesByHandle = new Map<string, number>();

  function fire(event: string, payload: unknown) {
    for (const fn of handlers.get(event) ?? []) fn(payload);
  }

  function ranks(source: Map<string, number>): WidgetRankRow[] {
    return [...source.entries()]
      .map(([handle, value]) => {
        const who = NAMES.find((n) => n.handle === handle)!;
        return { handle, displayName: who.displayName, avatarUrl: null, value };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }

  function totals() {
    return {
      topGifters: ranks(coinsByHandle),
      topLikers: ranks(likesByHandle),
      totalCoins,
      totalLikes,
      jarCoins,
    };
  }

  function snapshot(): WidgetSnapshot {
    return {
      totals: totals(),
      recentGifts: [...recentGifts],
      lastFollower: { viewer: { ...pick(NAMES, 1), avatarUrl: null }, at: new Date().toISOString() },
      // A timer that is always mid-countdown, so the widget shows digits rather than nothing.
      timer: {
        endsAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        label: "باقي على الجولة",
        running: true,
      },
    };
  }

  function sendGift() {
    const who = pick(NAMES, step);
    const gift = pick(GIFTS, step * 3 + 1);
    const repeatCount = 1 + (step % 3);
    const payload: WidgetGiftPayload = {
      viewer: { ...who, avatarUrl: null },
      giftName: gift.name,
      imageUrl: gift.image,
      coins: gift.coins,
      repeatCount,
      totalCoins: Math.max(5, gift.coins * repeatCount * 4),
      at: new Date().toISOString(),
    };

    totalCoins += payload.totalCoins;
    jarCoins += payload.totalCoins;
    coinsByHandle.set(who.handle, (coinsByHandle.get(who.handle) ?? 0) + payload.totalCoins);
    recentGifts.unshift(payload);
    recentGifts.length = Math.min(recentGifts.length, 12);

    fire(WidgetSocketEvents.Gift, payload);
    fire(WidgetSocketEvents.Totals, totals());
  }

  function sendLike() {
    const who = pick(NAMES, step + 2);
    const count = 8 + (step % 5) * 4;
    totalLikes += count;
    likesByHandle.set(who.handle, (likesByHandle.get(who.handle) ?? 0) + count);
    fire(WidgetSocketEvents.Like, { viewer: { ...who, avatarUrl: null }, count, at: new Date().toISOString() });
    fire(WidgetSocketEvents.Totals, totals());
  }

  // A first snapshot on the next tick — subscribers attach during this same render pass, and
  // firing synchronously here would land before any of them exist.
  timers.push(
    window.setTimeout(() => {
      // Seed some history so leaderboards and the jar aren't empty on the very first frame.
      for (let i = 0; i < 6; i += 1) {
        step += 1;
        sendGift();
        sendLike();
      }
      fire(WidgetSocketEvents.Snapshot, snapshot());
      fire(LiveSocketEvents.RoomStats, {
        liveSessionId: "preview",
        viewerCount: 1240,
        followerCount: 18400,
        avatarUrl: null,
        displayName: null,
      });
      fire(WidgetSocketEvents.Timer, snapshot().timer);
    }, 60),
  );

  timers.push(
    window.setInterval(() => {
      step += 1;
      sendGift();
    }, 3200),
  );

  timers.push(
    window.setInterval(() => {
      step += 1;
      sendLike();
    }, 1700),
  );

  timers.push(
    window.setInterval(() => {
      step += 1;
      fire(LiveSocketEvents.ChatComment, {
        viewer: { ...pick(NAMES, step), avatarUrl: null },
        text: pick(MESSAGES, step),
        at: new Date().toISOString(),
      });
    }, 1400),
  );

  timers.push(
    window.setInterval(() => {
      step += 1;
      fire(WidgetSocketEvents.Follow, {
        viewer: { ...pick(NAMES, step + 1), avatarUrl: null },
        at: new Date().toISOString(),
      });
    }, 6500),
  );

  timers.push(
    window.setInterval(() => {
      fire(LiveSocketEvents.RoomStats, {
        liveSessionId: "preview",
        viewerCount: 1180 + Math.round(Math.sin(step / 3) * 120),
        followerCount: 18400,
        avatarUrl: null,
        displayName: null,
      });
    }, 2500),
  );

  return {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
      // Late subscribers still need the snapshot; replay it for them immediately.
      if (event === WidgetSocketEvents.Snapshot) fn(snapshot());
    },
    off(event, fn) {
      handlers.get(event)?.delete(fn);
    },
    emit() {
      // Preview is one-way: widgets never send.
    },
    stop() {
      for (const t of timers) {
        window.clearTimeout(t);
        window.clearInterval(t);
      }
      handlers.clear();
    },
  };
}

/** The widgets are typed against socket.io's Socket but only ever use on/off. */
export function asSocket(demo: DemoSocket): Socket {
  return demo as unknown as Socket;
}
