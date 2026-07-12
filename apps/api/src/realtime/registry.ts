import { InternalSocketEvents, type WatchStartCommand, type WatchStopCommand } from "@tikgames/shared-types";
import type { Server, Socket } from "socket.io";
import type { CapitalsEngine } from "../games/capitals.js";
import type { FlagsEngine } from "../games/flags.js";
import type { GuessNumberEngine } from "../games/guessNumber.js";
import type { LogosEngine } from "../games/logos.js";
import type { MusicalChairsEngine } from "../games/musicalChairs.js";
import type { SpeedWordEngine } from "../games/speedWord.js";
import type { SpinWheelEngine } from "../games/spinWheel.js";
import type { TriviaEngine } from "../games/trivia.js";
import type { WouldYouRatherEngine } from "../games/wouldYouRather.js";

export type AnyGameEngine =
  | MusicalChairsEngine
  | TriviaEngine
  | GuessNumberEngine
  | SpinWheelEngine
  | WouldYouRatherEngine
  | FlagsEngine
  | CapitalsEngine
  | LogosEngine
  | SpeedWordEngine;

// In-memory, single-instance state. Fine at our current scale (matches the same pattern already
// used for OAuth pendingStates/pendingExchanges in routes/auth.ts) — move to Redis before running
// more than one API instance.
export const activeEngines = new Map<string, AnyGameEngine>(); // gameSessionId -> engine
export const liveSessionToGameSession = new Map<string, string>(); // liveSessionId -> gameSessionId

let ioInstance: Server | null = null;
let connectorSocket: Socket | null = null;

export function setIoInstance(io: Server): void {
  ioInstance = io;
}

export function setConnectorSocket(socket: Socket | null): void {
  connectorSocket = socket;
}

/**
 * Clears the active connector reference only if `socket` is still the active one — a stale
 * disconnect (an older connector instance dying after a newer one already took over) must not
 * clobber the healthy socket. That exact clobbering is what made `/live/start` 503 with
 * "الخدمة مش شغالة" while a perfectly good connector was connected: the old instance's
 * disconnect fired after the new instance had registered, and nulled it out.
 * `fallback` (another still-connected /internal socket, if any) takes over immediately so a
 * brief two-instance overlap degrades gracefully instead of going dark.
 */
export function releaseConnectorSocket(socket: Socket, fallback: Socket | null): void {
  if (connectorSocket === socket) connectorSocket = fallback;
}

export function isConnectorOnline(): boolean {
  return connectorSocket !== null && connectorSocket.connected;
}

export function requestWatch(cmd: WatchStartCommand): boolean {
  if (!connectorSocket) return false;
  connectorSocket.emit(InternalSocketEvents.WatchStart, cmd);
  return true;
}

export function requestUnwatch(cmd: WatchStopCommand): void {
  connectorSocket?.emit(InternalSocketEvents.WatchStop, cmd);
}

export function liveRoom(liveSessionId: string): string {
  return `live:${liveSessionId}`;
}

export function broadcastToLive(liveSessionId: string, event: string, payload: unknown): void {
  if (!ioInstance) return;
  const room = liveRoom(liveSessionId);
  // Rooms are scoped per-namespace in Socket.io — sockets join this room under /overlay and
  // /dashboard specifically, not the default "/" namespace, so both must be targeted explicitly.
  ioInstance.of("/overlay").to(room).emit(event, payload);
  ioInstance.of("/dashboard").to(room).emit(event, payload);
}
