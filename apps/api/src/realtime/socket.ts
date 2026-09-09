import {
  INTERNAL_NAMESPACE,
  InternalSocketEvents,
  LiveSocketEvents,
  WidgetSocketEvents,
  type LiveAlert,
  type LiveEvent,
  type LiveRoomStats,
  type LiveStatusUpdate,
} from "@tikgames/shared-types";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { notifyDiscord } from "../lib/discordWebhook.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { handleLiveEvent } from "./commentIngestion.js";
import { clearLiveStats, snapshotFor } from "./liveStats.js";
import {
  activeEngines,
  broadcastToLive,
  liveRoom,
  liveSessionToGameSession,
  releaseConnectorSocket,
  requestWatch,
  setConnectorSocket,
  setIoInstance,
} from "./registry.js";

/**
 * A (re)connecting connector instance starts with empty in-memory state — any session the DB
 * still thinks is pending/connecting/live lost its real TikTok connection when the previous
 * connector instance died (tsx-watch restart, crash, redeploy), and nothing else ever
 * re-establishes it: the streamer just sees a stale "لايف" that silently stopped delivering
 * comments. So on every connector connect, ask it to watch those sessions again.
 * ERROR sessions are deliberately excluded — those retry only when the streamer explicitly asks
 * (the retry button / re-saving the username), not on every reconnect, so a genuinely broken
 * channel doesn't hammer TikTok forever.
 */
async function rewatchActiveSessions(): Promise<void> {
  try {
    const sessions = await prisma.liveSession.findMany({
      where: { status: { in: ["PENDING", "CONNECTING", "LIVE"] } },
    });
    for (const s of sessions) {
      console.log(`[api] re-watching @${s.channelUsername} (session ${s.id}) after connector connect`);
      requestWatch({ liveSessionId: s.id, channelUsername: s.channelUsername });
    }
  } catch (err) {
    console.error("[api] failed to re-watch active sessions:", err);
  }
}

// Comma-separated — see index.ts's identical CORS_ORIGINS for why a single origin here silently
// blocks the overlay's (a different port) socket connection while the dashboard keeps working.
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const CONNECTOR_INTERNAL_SECRET = process.env.CONNECTOR_INTERNAL_SECRET ?? "dev-internal-secret-change-me";

export function setupSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: CORS_ORIGINS, credentials: true },
  });
  setIoInstance(io);

  // --- internal: tiktok-connector service -----------------------------------------
  const internal = io.of(INTERNAL_NAMESPACE);
  internal.use((socket, next) => {
    if (socket.handshake.auth?.secret === CONNECTOR_INTERNAL_SECRET) {
      next();
      return;
    }
    next(new Error("unauthorized"));
  });

  internal.on("connection", (socket) => {
    console.log("[api] tiktok-connector connected:", socket.id);
    setConnectorSocket(socket);
    rewatchActiveSessions();

    socket.on(InternalSocketEvents.LiveEvent, (event: LiveEvent) => {
      handleLiveEvent(event).catch((err) => console.error("[api] failed to handle live event:", err));
    });

    socket.on(InternalSocketEvents.LiveStatus, async (status: LiveStatusUpdate) => {
      try {
        await prisma.liveSession.update({
          where: { id: status.liveSessionId },
          data: {
            status: status.status,
            lastHeartbeatAt: new Date(),
            ...(status.status === "LIVE" ? { startedAt: new Date() } : {}),
            ...(status.status === "ENDED" ? { endedAt: new Date() } : {}),
          },
        });
      } catch (err) {
        console.error("[api] failed to persist live status:", err);
      }
      // An ended live's widget tallies are meaningless to the next stream, and a pending timer
      // firing into a dead room would be worse than meaningless.
      if (status.status === "ENDED") clearLiveStats(status.liveSessionId);
      broadcastToLive(status.liveSessionId, "live:status", status);
    });

    socket.on(InternalSocketEvents.LiveAlert, async (alert: LiveAlert) => {
      console.error("[api] CONNECTOR ALERT:", alert.severity, alert.message);
      try {
        await prisma.alert.create({
          data: {
            severity: alert.severity,
            status: "OPEN",
            source: "tiktok-connector",
            liveSessionId: alert.liveSessionId ?? undefined,
            message: alert.message,
            detail: alert.detail ? JSON.parse(JSON.stringify(alert.detail)) : undefined,
          },
        });
      } catch (err) {
        console.error("[api] failed to persist alert:", err);
      }
      if (alert.liveSessionId) {
        broadcastToLive(alert.liveSessionId, LiveSocketEvents.ConnectorAlert, alert);
      }
      if (alert.severity === "WARNING" || alert.severity === "CRITICAL") {
        const emoji = alert.severity === "CRITICAL" ? "🚨" : "⚠️";
        notifyDiscord(`${emoji} **${alert.severity}** (${alert.liveSessionId ?? "no session"})\n${alert.message}`);
      }
    });

    // Pure relay, no persistence — viewer count ticks every few seconds while live, unlike
    // LiveStatus above which writes to the DB on every event; a per-tick write here would hammer
    // it for the whole live duration for no benefit (this data is inherently transient).
    socket.on(InternalSocketEvents.LiveRoomStats, (stats: LiveRoomStats) => {
      broadcastToLive(stats.liveSessionId, LiveSocketEvents.RoomStats, stats);
    });

    socket.on("disconnect", () => {
      console.warn("[api] tiktok-connector disconnected:", socket.id);
      const fallback = [...internal.sockets.values()].find((s) => s.id !== socket.id && s.connected) ?? null;
      releaseConnectorSocket(socket, fallback);
    });
  });

  // --- overlay: public, scoped by the per-session overlay token --------------------
  const overlay = io.of("/overlay");
  overlay.use(async (socket, next) => {
    const token = socket.handshake.auth?.overlayToken;
    if (typeof token !== "string") {
      next(new Error("missing overlay token"));
      return;
    }
    const session = await prisma.liveSession.findUnique({ where: { overlayToken: token } });
    if (!session) {
      next(new Error("invalid overlay token"));
      return;
    }
    socket.data.liveSessionId = session.id;
    next();
  });

  overlay.on("connection", (socket) => {
    const liveSessionId = socket.data.liveSessionId as string;
    socket.join(liveRoom(liveSessionId));

    const gameSessionId = liveSessionToGameSession.get(liveSessionId);
    if (gameSessionId) {
      const engine = activeEngines.get(gameSessionId);
      if (engine) socket.emit(LiveSocketEvents.GameState, engine.getState());
    }

    // Widgets are added to OBS at arbitrary times, often long after the gifts they should be
    // showing already arrived. Without this snapshot a leaderboard added mid-stream starts empty
    // and stays empty until the next gift — which reads as broken.
    socket.emit(WidgetSocketEvents.Snapshot, snapshotFor(liveSessionId));
  });

  // --- dashboard: authenticated streamer monitoring ---------------------------------
  const dashboard = io.of("/dashboard");
  dashboard.use((socket, next) => {
    const token = socket.handshake.auth?.accessToken;
    if (typeof token !== "string") {
      next(new Error("missing access token"));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("invalid access token"));
    }
  });

  dashboard.on("connection", (socket) => {
    socket.on("join", async (liveSessionId: string) => {
      const session = await prisma.liveSession.findUnique({ where: { id: liveSessionId } });
      if (!session || session.userId !== socket.data.userId) return;

      socket.join(liveRoom(liveSessionId));
      socket.data.liveSessionId = liveSessionId;
      const gameSessionId = liveSessionToGameSession.get(liveSessionId);
      if (gameSessionId) {
        const engine = activeEngines.get(gameSessionId);
        if (engine) socket.emit(LiveSocketEvents.GameState, engine.getState());
      }
    });

    // Drawing's canvas strokes bypass the game:state pipeline entirely (no engine, no Mongo
    // write) — mouse-move-frequency updates would hammer the DB if routed through the normal
    // onChange/persist path every other game mutation uses. A raw relay is all this needs:
    // broadcastToLive already fans out to both /overlay and /dashboard rooms for any event name.
    // Only the socket that actually joined this room may push strokes into it.
    socket.on(LiveSocketEvents.DrawStroke, (payload: { liveSessionId?: string }) => {
      const liveSessionId = socket.data.liveSessionId as string | undefined;
      if (!liveSessionId || payload?.liveSessionId !== liveSessionId) return;
      broadcastToLive(liveSessionId, LiveSocketEvents.DrawStroke, payload);
    });
  });

  return io;
}
