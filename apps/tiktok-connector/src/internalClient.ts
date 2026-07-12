import {
  INTERNAL_NAMESPACE,
  InternalSocketEvents,
  type LiveAlert,
  type LiveEvent,
  type LiveRoomStats,
  type LiveStatusUpdate,
  type WatchStartCommand,
  type WatchStopCommand,
} from "@tikgames/shared-types";
import { io, type Socket } from "socket.io-client";
import { TikTokLiveSource } from "./tiktokLiveSource.js";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
const CONNECTOR_INTERNAL_SECRET = process.env.CONNECTOR_INTERNAL_SECRET ?? "dev-internal-secret-change-me";

export function startInternalClient(): Socket {
  const source = new TikTokLiveSource();

  const socket: Socket = io(`${API_INTERNAL_URL}${INTERNAL_NAMESPACE}`, {
    auth: { secret: CONNECTOR_INTERNAL_SECRET },
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    console.log("[tiktok-connector] connected to API internal channel");
  });

  socket.on("connect_error", (err) => {
    console.error("[tiktok-connector] failed to connect to API:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.warn("[tiktok-connector] disconnected from API:", reason);
  });

  socket.on(InternalSocketEvents.WatchStart, async (cmd: WatchStartCommand) => {
    console.log(`[tiktok-connector] watch:start @${cmd.channelUsername} (session ${cmd.liveSessionId})`);
    try {
      await source.watch(cmd.liveSessionId, cmd.channelUsername);
    } catch (err) {
      // Failure is already surfaced via the source's "status"/"alert" events below.
      console.error(
        `[tiktok-connector] watch failed for @${cmd.channelUsername}:`,
        err instanceof Error ? err.message : err,
      );
    }
  });

  socket.on(InternalSocketEvents.WatchStop, async (cmd: WatchStopCommand) => {
    console.log(`[tiktok-connector] watch:stop (session ${cmd.liveSessionId})`);
    await source.unwatch(cmd.liveSessionId);
  });

  source.on("event", (event: LiveEvent) => {
    socket.emit(InternalSocketEvents.LiveEvent, event);
  });

  source.on("status", (status: LiveStatusUpdate) => {
    console.log(`[tiktok-connector] status ${status.liveSessionId} -> ${status.status}${status.message ? ` (${status.message})` : ""}`);
    socket.emit(InternalSocketEvents.LiveStatus, status);
  });

  source.on("alert", (alert: LiveAlert) => {
    console.error(`[tiktok-connector] ALERT [${alert.severity}]:`, alert.message);
    socket.emit(InternalSocketEvents.LiveAlert, alert);
  });

  source.on("roomStats", (stats: LiveRoomStats) => {
    socket.emit(InternalSocketEvents.LiveRoomStats, stats);
  });

  return socket;
}
