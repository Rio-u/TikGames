import { io, type Socket } from "socket.io-client";
import { ACCESS_TOKEN_KEY } from "./auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/**
 * `auth` as a callback (not a static object) so every reconnect attempt re-reads the current
 * token from storage — a plain object would freeze in the token captured at the first connect,
 * and a dev-server restart or network blip would then retry forever with a token that's since
 * been rotated by the silent-refresh flow.
 */
export function connectDashboardSocket(): Socket {
  return io(`${API_URL}/dashboard`, {
    auth: (cb) => cb({ accessToken: localStorage.getItem(ACCESS_TOKEN_KEY) }),
  });
}

export function connectOverlaySocket(overlayToken: string): Socket {
  return io(`${API_URL}/overlay`, { auth: { overlayToken } });
}
