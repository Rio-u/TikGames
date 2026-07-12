import { EventEmitter } from "node:events";
import {
  ControlEvent,
  TikTokLiveConnection,
  UserOfflineError,
  WebcastEvent,
  type User,
} from "tiktok-live-connector";
import type {
  LiveAlert,
  LiveEvent,
  LiveRoomStats,
  LiveStatusUpdate,
  NormalizedViewer,
} from "@tikgames/shared-types";

interface WatchedStream {
  channelUsername: string;
  connection: TikTokLiveConnection;
}

function normalizeViewer(user: User | undefined): NormalizedViewer {
  return {
    handle: user?.displayId || user?.id || "unknown",
    displayName: user?.nickname || user?.displayId || "مشاهد",
    avatarUrl: user?.avatarThumb?.urlList?.[0] ?? null,
  };
}

function firstDefined<T>(...values: (T | null | undefined)[]): T | null {
  for (const v of values) if (v !== null && v !== undefined) return v;
  return null;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `connection.roomInfo` is typed `any` by the library on purpose — its real shape depends on
 * which of three internal fetch routes resolved at connect time (Euler-signed / unsigned
 * api-live / HTML-scrape fallback), with no discriminant exposed to tell them apart. Try every
 * known real shape defensively; never throw. "Couldn't find it" is a legitimate outcome — the
 * caller hides the stat, never fakes a number.
 */
function extractRoomProfile(roomInfo: unknown): { avatarUrl: string | null; followerCount: number | null } {
  try {
    const r = roomInfo as Record<string, any> | null | undefined;
    const data = r?.data;
    const user = data?.user ?? r?.liveRoomUserInfo?.user ?? data?.owner;

    const avatarUrl = firstDefined(
      toNonEmptyString(user?.avatar_url), // Euler-normalized (TikTokLiveUser.user)
      toNonEmptyString(user?.avatar_thumb?.url_list?.[0]), // raw unsigned webcast JSON
      toNonEmptyString(user?.avatarThumb?.urlList?.[0]), // protobuf-derived camelCase fallback
    );
    const followerCount = firstDefined(
      toFiniteNumber(user?.followers), // Euler-normalized
      toFiniteNumber(user?.follow_info?.follower_count), // raw unsigned webcast JSON
      toFiniteNumber(user?.followInfo?.followerCount), // protobuf-derived camelCase fallback
    );
    return { avatarUrl, followerCount };
  } catch {
    return { avatarUrl: null, followerCount: null };
  }
}

/**
 * Wraps the unofficial `tiktok-live-connector` library behind the LiveSourceConnector shape.
 * Emits: "event" (LiveEvent), "status" (LiveStatusUpdate), "alert" (LiveAlert — fail loudly,
 * never silently, per the original design requirement).
 */
export class TikTokLiveSource extends EventEmitter {
  // "Failed to retrieve Room ID from all sources" is a well-known transient failure of this
  // unofficial library — TikTok's HTML/API scrape routes get intermittently rate-limited/blocked
  // per-request, independent of whether the channel is actually live, and a retry moments later
  // routinely succeeds. UserOfflineError is the one exception (see below) — that's a real "not
  // live" answer, not a transient fetch failure, so it never gets retried.
  private static readonly CONNECT_ATTEMPTS = 3;
  private static readonly CONNECT_RETRY_DELAY_MS = 3000;

  private streams = new Map<string, WatchedStream>();
  // WebcastEvent.ROOM_USER only ever carries the viewer count, never profile data — this caches
  // the last-known avatar/follower/displayName per stream so a viewer-count tick doesn't blank
  // out the profile fields the client is already showing.
  private roomStatsCache = new Map<string, LiveRoomStats>();

  async watch(liveSessionId: string, channelUsername: string): Promise<void> {
    if (this.streams.has(liveSessionId)) {
      // Silent: this is one watch superseding another (retry / username edit on the same live
      // session, still-connecting or not), not a real disconnect — emitting "ENDED" here would
      // race the "CONNECTING" a few lines below back to the API and could land last, making the
      // DB (and therefore the client, on an unlucky refetch) briefly see "no live session" even
      // though a new attempt just started successfully.
      await this.unwatch(liveSessionId, { silent: true });
    }

    const signApiKey = process.env.EULER_STREAM_API_KEY || undefined;
    const connection = new TikTokLiveConnection(channelUsername, {
      signApiKey,
      fetchRoomInfoOnConnect: true,
    });

    // A newer watch()/unwatch() call for this same liveSessionId (retry, username edit, explicit
    // stop) replaces the map entry — that's the one and only signal this connection has been
    // superseded. Every listener below that would otherwise touch shared status/alert state must
    // check this first: disconnecting a superseded connection (see `unwatch`) still fires ITS
    // OWN lifecycle events (DISCONNECTED, STREAM_END) asynchronously, and without this guard
    // those would immediately stomp the newer attempt's just-emitted "CONNECTING" with a stale
    // "ERROR"/"ENDED" — which is exactly what made a username edit or retry look like it never
    // took effect no matter how many times it was tried.
    const isCurrent = () => this.streams.get(liveSessionId)?.connection === connection;

    connection.on(WebcastEvent.CHAT, (msg) => {
      this.emitEvent({
        type: "comment",
        liveSessionId,
        viewer: normalizeViewer(msg.user),
        text: msg.content ?? "",
        at: new Date().toISOString(),
      });
    });

    connection.on(WebcastEvent.GIFT, (msg) => {
      this.emitEvent({
        type: "gift",
        liveSessionId,
        viewer: normalizeViewer(msg.user),
        giftId: String(msg.giftId ?? ""),
        repeatCount: msg.repeatCount ?? 1,
        at: new Date().toISOString(),
      });
    });

    connection.on(WebcastEvent.LIKE, (msg) => {
      this.emitEvent({
        type: "like",
        liveSessionId,
        viewer: normalizeViewer(msg.user),
        count: msg.count ?? 1,
        at: new Date().toISOString(),
      });
    });

    connection.on(WebcastEvent.FOLLOW, (msg) => {
      this.emitEvent({
        type: "follow",
        liveSessionId,
        viewer: normalizeViewer(msg.user),
        at: new Date().toISOString(),
      });
    });

    // Never carries profile data, only ever patches the cached viewerCount field. `total`/
    // `totalUser` are NOT the current audience size — they're the cumulative count of everyone
    // who has ever dropped into the room since it started, which only ever grows and quickly
    // reaches into the thousands even for a small stream. `popularity` (falling back to the
    // formatted `popStr`) is the field that actually matches the live concurrent-viewer number
    // TikTok's own app shows next to the eye icon.
    connection.on(WebcastEvent.ROOM_USER, (msg: any) => {
      if (!isCurrent()) return;
      const viewerCount = firstDefined(toFiniteNumber(msg?.popularity), toFiniteNumber(msg?.popStr));
      if (viewerCount !== null) this.emitRoomStats(liveSessionId, { viewerCount });
    });

    connection.on(WebcastEvent.STREAM_END, () => {
      if (!isCurrent()) return;
      this.streams.delete(liveSessionId);
      this.roomStatsCache.delete(liveSessionId);
      this.emitStatus(liveSessionId, "ENDED", "اللايف خلص");
    });

    connection.on(ControlEvent.DISCONNECTED, (info) => {
      if (!isCurrent()) return;
      this.emitStatus(liveSessionId, "ERROR", `الاتصال اتقطع: ${info?.reason ?? "unknown"}`);
      this.emitAlert(
        liveSessionId,
        "WARNING",
        `Disconnected from @${channelUsername}: ${info?.reason ?? "unknown reason"}`,
      );
    });

    connection.on(ControlEvent.ERROR, (err) => {
      if (!isCurrent()) return;
      const message = err instanceof Error ? err.message : String(err);
      this.emitAlert(liveSessionId, "CRITICAL", `TikTok connector error for @${channelUsername}: ${message}`, err);
    });

    this.streams.set(liveSessionId, { channelUsername, connection });
    this.emitStatus(liveSessionId, "CONNECTING");

    let lastErr: unknown;
    for (let attempt = 1; attempt <= TikTokLiveSource.CONNECT_ATTEMPTS; attempt++) {
      if (!isCurrent()) return;

      try {
        await connection.connect();
        if (!isCurrent()) return;
        this.emitStatus(liveSessionId, "LIVE");
        const { avatarUrl, followerCount } = extractRoomProfile(connection.roomInfo);
        this.emitRoomStats(liveSessionId, { avatarUrl, followerCount, displayName: channelUsername });
        return;
      } catch (err) {
        lastErr = err;
        if (!isCurrent()) return;
        if (err instanceof UserOfflineError) break; // genuinely not live — retrying won't help
        if (attempt < TikTokLiveSource.CONNECT_ATTEMPTS) {
          this.emitAlert(
            liveSessionId,
            "WARNING",
            `محاولة الاتصال ${attempt} فشلت لـ @${channelUsername}، بيعيد المحاولة...`,
            { channelUsername, attempt, error: err instanceof Error ? err.message : String(err) },
          );
          await sleep(TikTokLiveSource.CONNECT_RETRY_DELAY_MS);
        }
      }
    }

    if (!isCurrent()) return;
    this.streams.delete(liveSessionId);
    const message =
      lastErr instanceof UserOfflineError
        ? `@${channelUsername} مش لايف دلوقتي`
        : lastErr instanceof Error
          ? lastErr.message
          : String(lastErr);
    this.emitStatus(liveSessionId, "ERROR", message);
    this.emitAlert(liveSessionId, "CRITICAL", `فشل الاتصال بلايف @${channelUsername}: ${message}`, {
      channelUsername,
      error: message,
    });
    throw lastErr;
  }

  async unwatch(liveSessionId: string, opts: { silent?: boolean } = {}): Promise<void> {
    const stream = this.streams.get(liveSessionId);
    if (!stream) return;
    this.streams.delete(liveSessionId);
    this.roomStatsCache.delete(liveSessionId);
    try {
      await stream.connection.disconnect();
    } catch {
      // Already gone — nothing to clean up.
    }
    if (!opts.silent) this.emitStatus(liveSessionId, "ENDED");
  }

  private emitEvent(event: LiveEvent) {
    this.emit("event", event);
  }

  private emitStatus(liveSessionId: string, status: LiveStatusUpdate["status"], message?: string) {
    this.emit("status", { liveSessionId, status, message } satisfies LiveStatusUpdate);
  }

  private emitAlert(liveSessionId: string, severity: LiveAlert["severity"], message: string, detail?: unknown) {
    this.emit("alert", { liveSessionId, severity, message, detail } satisfies LiveAlert);
  }

  private emitRoomStats(liveSessionId: string, patch: Partial<Omit<LiveRoomStats, "liveSessionId">>) {
    const prev = this.roomStatsCache.get(liveSessionId) ?? {
      liveSessionId,
      viewerCount: null,
      followerCount: null,
      avatarUrl: null,
      displayName: null,
    };
    const next: LiveRoomStats = { ...prev, ...patch };
    this.roomStatsCache.set(liveSessionId, next);
    this.emit("roomStats", next);
  }
}
