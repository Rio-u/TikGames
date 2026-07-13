import { authedFetch } from "./apiClient";

export interface SubscriptionInfo {
  status: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED";
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  trialGamesLimit: number;
  trialGamesUsed: number;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: "STREAMER" | "ADMIN";
  hasPassword: boolean;
  tiktokConnected: boolean;
  discordConnected: boolean;
  subscription: SubscriptionInfo | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function parseJsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data;
}

export async function registerRequest(input: {
  email: string;
  password: string;
  displayName: string;
  username: string;
  turnstileToken?: string | null;
}): Promise<{ user: AuthUser } & AuthTokens> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res);
}

export async function loginRequest(input: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser } & AuthTokens> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res);
}

export async function meRequest(accessToken: string): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function refreshRequest(refreshToken: string): Promise<AuthTokens> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  return parseJsonOrThrow(res);
}

export function tiktokAuthUrl(): string {
  return `${API_URL}/auth/tiktok/start`;
}

export function discordAuthUrl(): string {
  return `${API_URL}/auth/discord/start`;
}

export async function exchangeOAuthCode(code: string): Promise<{ user: AuthUser } & AuthTokens> {
  const res = await fetch(`${API_URL}/auth/oauth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return parseJsonOrThrow(res);
}

export interface AuthMethods {
  emailPassword: boolean;
  tiktok: boolean;
  discord: boolean;
}

/** Public — Login/Register pages call this to know which methods to show. A UI hint only; the
 *  real enforcement lives server-side in each method's own route. */
export async function getAuthMethods(): Promise<AuthMethods> {
  const res = await fetch(`${API_URL}/auth/methods`);
  return parseJsonOrThrow(res);
}

// --- Account management (all require an existing session) -------------------------

export async function redeemCode(code: string): Promise<{ ok: true; gamesGranted: number; trialGamesLimit: number }> {
  const res = await authedFetch("/auth/redeem-code", { method: "POST", body: JSON.stringify({ code }) });
  return parseJsonOrThrow(res);
}

export async function changePasswordRequest(input: { currentPassword?: string; newPassword: string }): Promise<{ ok: true }> {
  const res = await authedFetch("/auth/password", { method: "POST", body: JSON.stringify(input) });
  return parseJsonOrThrow(res);
}

/** Returns the provider's authorize URL; the caller navigates the browser there itself
 *  (`window.location.href = url`) since this fetch — not the redirect — is what carries auth. */
export async function startDiscordLink(): Promise<{ url: string }> {
  const res = await authedFetch("/auth/discord/link-start", { method: "POST" });
  return parseJsonOrThrow(res);
}

export async function startTikTokLink(): Promise<{ url: string }> {
  const res = await authedFetch("/auth/tiktok/link-start", { method: "POST" });
  return parseJsonOrThrow(res);
}

export async function unlinkDiscord(): Promise<{ ok: true }> {
  const res = await authedFetch("/auth/discord/unlink", { method: "DELETE" });
  return parseJsonOrThrow(res);
}

export async function unlinkTikTok(): Promise<{ ok: true }> {
  const res = await authedFetch("/auth/tiktok/unlink", { method: "DELETE" });
  return parseJsonOrThrow(res);
}
