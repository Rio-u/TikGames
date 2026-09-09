import {
  WidgetSocketEvents,
  type LiveFollowEvent,
  type LiveGiftEvent,
  type LiveLikeEvent,
  type WidgetFollowPayload,
  type WidgetGiftPayload,
  type WidgetLikePayload,
  type WidgetRankRow,
  type WidgetSnapshot,
  type WidgetTimerState,
  type WidgetTotals,
} from "@tikgames/shared-types";
import { broadcastToLive } from "./registry.js";

/**
 * Per-live-session aggregation for the overlay widgets (top gifters, gift feed, goals, likes).
 *
 * In-memory and per-session on purpose — same tradeoff already taken by `activeEngines`: this is
 * transient stream data, it resets when the live ends, and persisting a row per gift tick would
 * write thousands of rows a stream for numbers nobody reads afterwards. Cumulative, cross-stream
 * standing already has a home: the `ViewerRanking` table behind the RANKING widget.
 *
 * Move to Redis at the same time `activeEngines` moves — both die on a second API instance.
 */

const RECENT_GIFTS_KEPT = 25;
/** A stream that runs for hours with thousands of unique gifters would otherwise grow unbounded.
 *  Only the top slice is ever displayed, so trimming the tail costs nothing visible. */
const MAX_TRACKED_VIEWERS = 500;

interface ViewerTally {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  coins: number;
  likes: number;
}

interface SessionStats {
  viewers: Map<string, ViewerTally>;
  recentGifts: WidgetGiftPayload[];
  lastFollower: WidgetFollowPayload | null;
  totalCoins: number;
  totalLikes: number;
  /** Same gifts as totalCoins, counted separately so "empty the jar" is its own action. */
  jarCoins: number;
  timer: WidgetTimerState;
  /** Cleared whenever the timer is replaced so an old countdown can't fire over a new one. */
  timerHandle: NodeJS.Timeout | null;
}

const sessions = new Map<string, SessionStats>();

function emptyTimer(): WidgetTimerState {
  return { endsAt: null, label: "", running: false };
}

function getSession(liveSessionId: string): SessionStats {
  let stats = sessions.get(liveSessionId);
  if (!stats) {
    stats = {
      viewers: new Map(),
      recentGifts: [],
      lastFollower: null,
      totalCoins: 0,
      totalLikes: 0,
      jarCoins: 0,
      timer: emptyTimer(),
      timerHandle: null,
    };
    sessions.set(liveSessionId, stats);
  }
  return stats;
}

function tallyFor(
  stats: SessionStats,
  viewer: { handle: string; displayName: string; avatarUrl: string | null },
): ViewerTally {
  let tally = stats.viewers.get(viewer.handle);
  if (!tally) {
    tally = {
      handle: viewer.handle,
      displayName: viewer.displayName,
      avatarUrl: viewer.avatarUrl,
      coins: 0,
      likes: 0,
    };
    stats.viewers.set(viewer.handle, tally);
  } else {
    // Refresh identity — TikTok sometimes sends a bare handle first and the full profile later.
    tally.displayName = viewer.displayName || tally.displayName;
    tally.avatarUrl = viewer.avatarUrl ?? tally.avatarUrl;
  }
  return tally;
}

function trimViewers(stats: SessionStats): void {
  if (stats.viewers.size <= MAX_TRACKED_VIEWERS) return;
  const ranked = [...stats.viewers.values()].sort(
    (a, b) => b.coins + b.likes / 1000 - (a.coins + a.likes / 1000),
  );
  stats.viewers = new Map(ranked.slice(0, MAX_TRACKED_VIEWERS).map((v) => [v.handle, v]));
}

function rank(stats: SessionStats, key: "coins" | "likes"): WidgetRankRow[] {
  return [...stats.viewers.values()]
    .filter((v) => v[key] > 0)
    .sort((a, b) => b[key] - a[key])
    .slice(0, 20)
    .map((v) => ({
      handle: v.handle,
      displayName: v.displayName,
      avatarUrl: v.avatarUrl,
      value: v[key],
    }));
}

function totalsOf(stats: SessionStats): WidgetTotals {
  return {
    topGifters: rank(stats, "coins"),
    topLikers: rank(stats, "likes"),
    totalCoins: stats.totalCoins,
    totalLikes: stats.totalLikes,
    jarCoins: stats.jarCoins,
  };
}

function broadcastTotals(liveSessionId: string, stats: SessionStats): void {
  broadcastToLive(liveSessionId, WidgetSocketEvents.Totals, totalsOf(stats));
}

export function snapshotFor(liveSessionId: string): WidgetSnapshot {
  const stats = getSession(liveSessionId);
  return {
    totals: totalsOf(stats),
    recentGifts: stats.recentGifts,
    lastFollower: stats.lastFollower,
    timer: stats.timer,
  };
}

export function recordGift(event: LiveGiftEvent): void {
  const stats = getSession(event.liveSessionId);
  const totalCoins = event.coins * Math.max(1, event.repeatCount);

  const payload: WidgetGiftPayload = {
    viewer: event.viewer,
    giftName: event.giftName,
    imageUrl: event.imageUrl,
    coins: event.coins,
    repeatCount: event.repeatCount,
    totalCoins,
    at: event.at,
  };

  // The animation widgets (cannon) fire on every tick so a held streak looks alive; only a
  // finished streak is allowed to move any number. See LiveGiftEvent.isStreakFinished.
  broadcastToLive(event.liveSessionId, WidgetSocketEvents.Gift, payload);
  if (!event.isStreakFinished) return;

  const tally = tallyFor(stats, event.viewer);
  tally.coins += totalCoins;
  stats.totalCoins += totalCoins;
  stats.jarCoins += totalCoins;
  stats.recentGifts = [payload, ...stats.recentGifts].slice(0, RECENT_GIFTS_KEPT);
  trimViewers(stats);
  broadcastTotals(event.liveSessionId, stats);
}

export function recordLike(event: LiveLikeEvent): void {
  const stats = getSession(event.liveSessionId);
  const count = Math.max(1, event.count);

  const tally = tallyFor(stats, event.viewer);
  tally.likes += count;
  stats.totalLikes += count;
  trimViewers(stats);

  const payload: WidgetLikePayload = { viewer: event.viewer, count, at: event.at };
  broadcastToLive(event.liveSessionId, WidgetSocketEvents.Like, payload);
  broadcastTotals(event.liveSessionId, stats);
}

export function recordFollow(event: LiveFollowEvent): void {
  const stats = getSession(event.liveSessionId);
  const payload: WidgetFollowPayload = { viewer: event.viewer, at: event.at };
  stats.lastFollower = payload;
  broadcastToLive(event.liveSessionId, WidgetSocketEvents.Follow, payload);
}

/** Empties the coin jar without touching any other tally — the gift goal, the gifter leaderboard
 *  and the gift feed all keep their numbers. Broadcasts so every open jar clears at once. */
export function resetJar(liveSessionId: string): void {
  const stats = getSession(liveSessionId);
  stats.jarCoins = 0;
  broadcastTotals(liveSessionId, stats);
}

// --- Timer widget ------------------------------------------------------------------

/** Starts (or replaces) the countdown. `seconds <= 0` stops it. Server-authoritative: the widget
 *  only ever counts down toward `endsAt`, it never keeps its own clock. */
export function setTimer(liveSessionId: string, seconds: number, label: string): WidgetTimerState {
  const stats = getSession(liveSessionId);
  if (stats.timerHandle) {
    clearTimeout(stats.timerHandle);
    stats.timerHandle = null;
  }

  if (seconds <= 0) {
    stats.timer = { endsAt: null, label, running: false };
  } else {
    const endsAt = new Date(Date.now() + seconds * 1000).toISOString();
    stats.timer = { endsAt, label, running: true };
    // One broadcast when it actually hits zero, so a widget that joined late still flips state
    // without polling.
    stats.timerHandle = setTimeout(() => {
      const current = sessions.get(liveSessionId);
      if (!current) return;
      current.timer = { endsAt, label, running: false };
      current.timerHandle = null;
      broadcastToLive(liveSessionId, WidgetSocketEvents.Timer, current.timer);
    }, seconds * 1000);
  }

  broadcastToLive(liveSessionId, WidgetSocketEvents.Timer, stats.timer);
  return stats.timer;
}

/** Called when a live ends — drops the session's stats and cancels any pending timer so a stale
 *  countdown can't fire into a room that no longer exists. */
export function clearLiveStats(liveSessionId: string): void {
  const stats = sessions.get(liveSessionId);
  if (stats?.timerHandle) clearTimeout(stats.timerHandle);
  sessions.delete(liveSessionId);
}
