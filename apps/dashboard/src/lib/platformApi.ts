import type { ProductAccess, ProductDefinition } from "@tikgames/shared-types";
import { authedFetch, parseJsonOrThrow } from "./apiClient";

export type { ProductAccess, ProductDefinition };

/** Public catalog — no session needed. Used by the marketing pages. */
export async function getPublicProducts(): Promise<{ products: ProductDefinition[] }> {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/products`,
  );
  return parseJsonOrThrow(res);
}

/** The signed-in creator's catalog, with server-decided `unlocked` flags. */
export async function getMyProducts(): Promise<{ products: ProductAccess[] }> {
  const res = await authedFetch("/products/me");
  return parseJsonOrThrow(res);
}

export interface AnalyticsTotals {
  liveSessions: number;
  completedLiveSessions: number;
  totalLiveMinutes: number;
  averageLiveMinutes: number;
  gamesStarted: number;
  gamesFinished: number;
  uniqueViewers: number;
  totalViewerScore: number;
  totalViewerGamesPlayed: number;
}

export interface AnalyticsRecentSession {
  id: string;
  channelUsername: string;
  status: "PENDING" | "CONNECTING" | "LIVE" | "ENDED" | "ERROR";
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  durationMinutes: number | null;
  gamesPlayed: number;
  participants: number;
}

export interface AnalyticsSummary {
  totals: AnalyticsTotals;
  gamesByType: { gameType: string; count: number }[];
  recentSessions: AnalyticsRecentSession[];
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const res = await authedFetch("/analytics/summary");
  return parseJsonOrThrow(res);
}
