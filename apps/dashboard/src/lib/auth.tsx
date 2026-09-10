import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type AuthTokens,
  type AuthUser,
  loginRequest,
  meRequest,
  refreshRequest,
  registerRequest,
} from "./api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (
    email: string,
    password: string,
    displayName: string,
    username: string,
    turnstileToken?: string | null,
  ) => Promise<void>;
  loginWithTokens: (data: { user: AuthUser } & AuthTokens) => void;
  logout: () => void;
  /** Re-fetches /auth/me and updates the in-memory user — call after anything that changes the
   *  profile server-side (linking/unlinking an account, ...) without a full page reload. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const ACCESS_TOKEN_KEY = "tikgames_access_token";
export const REFRESH_TOKEN_KEY = "tikgames_refresh_token";
// The access token expires every 15 minutes server-side. Refresh well before that so an open
// tab never gets logged out just for sitting idle — only an actually-expired refresh token
// (30 days) ends the session.
const SILENT_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

// Module-level (not per-component) so every caller shares one in-flight refresh — the background
// interval here AND on-demand 401 retries from other API modules (liveApi.ts, ...). Refresh
// tokens rotate on use, so two concurrent refreshes would race the same token through two
// rotations and one of them would fail; de-duping here is what prevents that.
let refreshInFlight: Promise<RefreshResult> | null = null;

/**
 * Outcome of a refresh attempt. `sessionOver` is the important field: it separates "the server
 * says this session is finished" from "we could not reach the server", which must not log anyone
 * out.
 */
export interface RefreshResult {
  ok: boolean;
  token?: string;
  sessionOver?: boolean;
}

/** A thrown error that means the credentials themselves were rejected, rather than the request
 *  failing to complete. parseJsonOrThrow puts the status in the message for exactly this. */
function isAuthRejection(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /401|403/.test(message) || /refresh token/i.test(message);
}

/** Rotates the access/refresh pair. Clears the stored session only when the server rejects it. */
export function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;

  const run = async (): Promise<RefreshResult> => {
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefresh) return { ok: false, sessionOver: true };
    try {
      const tokens = await refreshRequest(storedRefresh);
      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      return { ok: true, token: tokens.accessToken };
    } catch (err) {
      // The distinction that matters, and the bug this fixes: only a server that actually
      // *rejected* the token ends the session. Anything else — the wifi dropping, the laptop
      // waking from sleep, the API restarting mid-deploy — used to land in this same catch and
      // wipe the stored session, which is why a streamer sitting on the dashboard for half an
      // hour would find themselves logged out for no reason they could see.
      if (isAuthRejection(err)) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        return { ok: false, sessionOver: true };
      }
      return { ok: false, sessionOver: false };
    }
  };

  refreshInFlight = run().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  function persistSession(data: { user: AuthUser } & AuthTokens): AuthUser {
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    setUser(data.user);
    return data.user;
  }

  function clearSession() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setUser(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!token) return;

      try {
        const data = await meRequest(token);
        if (!cancelled) setUser(data.user);
        return;
      } catch {
        // Access token expired — fall through to a silent refresh before giving up.
      }

      const result = await refreshAccessToken();
      if (!result.ok) {
        // Only a genuine rejection ends the session; a network failure leaves it alone so the
        // next interval tick, or the next thing the user clicks, can retry.
        if (result.sessionOver && !cancelled) clearSession();
        return;
      }

      try {
        const data = await meRequest(result.token!);
        if (!cancelled) setUser(data.user);
      } catch (err) {
        if (isAuthRejection(err) && !cancelled) clearSession();
      }
    }

    restoreSession().finally(() => {
      if (!cancelled) setLoading(false);
    });

    const silentRefresh = async () => {
      if (!localStorage.getItem(REFRESH_TOKEN_KEY)) return;
      const result = await refreshAccessToken();
      if (!result.ok && result.sessionOver && !cancelled) clearSession();
    };

    const interval = window.setInterval(silentRefresh, SILENT_REFRESH_INTERVAL_MS);

    // Browsers throttle timers in background tabs and stop them entirely while the machine is
    // asleep, so the interval alone cannot be trusted to have run. Refreshing on the way back
    // catches up immediately instead of letting the next click race an expired token.
    const onWake = () => {
      if (document.visibilityState === "visible") void silentRefresh();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, []);

  async function login(email: string, password: string): Promise<AuthUser> {
    return persistSession(await loginRequest({ email, password }));
  }

  async function register(
    email: string,
    password: string,
    displayName: string,
    username: string,
    turnstileToken?: string | null,
  ) {
    persistSession(await registerRequest({ email, password, displayName, username, turnstileToken }));
  }

  function loginWithTokens(data: { user: AuthUser } & AuthTokens) {
    persistSession(data);
  }

  function logout() {
    clearSession();
  }

  async function refreshUser() {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return;
    try {
      const data = await meRequest(token);
      setUser(data.user);
      return;
    } catch {
      // access token may have just expired — try one silent refresh before giving up.
    }
    const refreshed = await refreshAccessToken();
    if (!refreshed.ok) return;
    try {
      const data = await meRequest(refreshed.token!);
      setUser(data.user);
    } catch {
      // leave the existing user state as-is; the next 401 elsewhere will sort out logout.
    }
  }

  const value = useMemo(
    () => ({ user, loading, login, register, loginWithTokens, logout, refreshUser }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
