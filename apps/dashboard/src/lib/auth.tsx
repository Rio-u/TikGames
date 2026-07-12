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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, username: string) => Promise<void>;
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
let refreshInFlight: Promise<string | null> | null = null;

/** Rotates the access/refresh pair. Returns the new access token, or null if the refresh token
 * itself is no longer valid (the session is genuinely over), clearing the stored session either way. */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const run = async () => {
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefresh) return null;
    try {
      const tokens = await refreshRequest(storedRefresh);
      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      return tokens.accessToken;
    } catch {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      return null;
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

  function persistSession(data: { user: AuthUser } & AuthTokens) {
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    setUser(data.user);
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

      const newToken = await refreshAccessToken();
      if (!newToken) {
        if (!cancelled) clearSession();
        return;
      }

      try {
        const data = await meRequest(newToken);
        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) clearSession();
      }
    }

    restoreSession().finally(() => {
      if (!cancelled) setLoading(false);
    });

    const interval = window.setInterval(async () => {
      if (!localStorage.getItem(REFRESH_TOKEN_KEY)) return;
      const newToken = await refreshAccessToken();
      if (!newToken && !cancelled) clearSession();
    }, SILENT_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  async function login(email: string, password: string) {
    persistSession(await loginRequest({ email, password }));
  }

  async function register(email: string, password: string, displayName: string, username: string) {
    persistSession(await registerRequest({ email, password, displayName, username }));
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
    const newToken = await refreshAccessToken();
    if (!newToken) return;
    try {
      const data = await meRequest(newToken);
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
