import { authedFetch, parseJsonOrThrow } from "./apiClient";

export interface ViewerRankingEntry {
  id: string;
  viewerHandle: string;
  displayName: string;
  avatarUrl: string | null;
  totalScore: number;
  gamesPlayed: number;
  lastPlayedAt: string;
}

export async function getLeaderboard() {
  const res = await authedFetch("/leaderboard");
  return parseJsonOrThrow(res) as Promise<{ rankings: ViewerRankingEntry[] }>;
}
