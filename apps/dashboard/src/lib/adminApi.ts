import { authedFetch, parseJsonOrThrow } from "./apiClient";

export interface TriviaImage {
  id: string;
  url: string;
  uploadedById: string;
  createdAt: string;
}

export interface MusicTrack {
  id: string;
  url: string;
  uploadedById: string;
  createdAt: string;
}

export interface SpeedWordImage {
  id: string;
  url: string;
  uploadedById: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: "STREAMER" | "ADMIN";
  createdAt: string;
  subscription: {
    status: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED";
    trialEndsAt: string;
    currentPeriodEnd: string | null;
  } | null;
}

export interface AdminAlert {
  id: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  source: string;
  liveSessionId: string | null;
  message: string;
  detail: unknown;
  createdAt: string;
  resolvedAt: string | null;
  resolvedById: string | null;
}

export interface GameToggle {
  gameType: string;
  enabled: boolean;
}

export interface AdminLogEntry {
  id: string;
  action: string;
  adminUserId: string;
  adminUser: { displayName: string; username: string } | null;
  targetUserId: string | null;
  targetUser: { displayName: string; username: string } | null;
  metadata: unknown;
  createdAt: string;
}

export interface AdminAnalytics {
  users: { total: number; new7d: number };
  subscriptions: { status: string; count: number }[];
  liveSessions: { total: number; live: number };
  gameSessions: {
    total: number;
    last7d: number;
    byType: { gameType: string; count: number }[];
    byStatus: { status: string; count: number }[];
  };
  alerts: { open: number; criticalOpen: number };
  adminActions: { total: number };
}

// --- Trivia background image pool --------------------------------------------------

export async function adminListTriviaImages() {
  const res = await authedFetch("/admin/trivia-images");
  return parseJsonOrThrow(res) as Promise<{ images: TriviaImage[] }>;
}

export async function adminUploadTriviaImages(files: File[]) {
  const formData = new FormData();
  for (const file of files) formData.append("images", file);
  const res = await authedFetch("/admin/trivia-images", { method: "POST", body: formData });
  return parseJsonOrThrow(res) as Promise<{ images: TriviaImage[] }>;
}

export async function adminDeleteTriviaImage(id: string) {
  const res = await authedFetch(`/admin/trivia-images/${id}`, { method: "DELETE" });
  return parseJsonOrThrow(res) as Promise<{ ok: true }>;
}

// --- Speed Word background image pool ---------------------------------------------------

export async function adminListSpeedWordImages() {
  const res = await authedFetch("/admin/speed-word-images");
  return parseJsonOrThrow(res) as Promise<{ images: SpeedWordImage[] }>;
}

export async function adminUploadSpeedWordImages(files: File[]) {
  const formData = new FormData();
  for (const file of files) formData.append("images", file);
  const res = await authedFetch("/admin/speed-word-images", { method: "POST", body: formData });
  return parseJsonOrThrow(res) as Promise<{ images: SpeedWordImage[] }>;
}

export async function adminDeleteSpeedWordImage(id: string) {
  const res = await authedFetch(`/admin/speed-word-images/${id}`, { method: "DELETE" });
  return parseJsonOrThrow(res) as Promise<{ ok: true }>;
}

// --- Musical Chairs music pool ---------------------------------------------------------

export async function adminListMusicTracks() {
  const res = await authedFetch("/admin/music-tracks");
  return parseJsonOrThrow(res) as Promise<{ tracks: MusicTrack[] }>;
}

export async function adminUploadMusicTracks(files: File[]) {
  const formData = new FormData();
  for (const file of files) formData.append("tracks", file);
  const res = await authedFetch("/admin/music-tracks", { method: "POST", body: formData });
  return parseJsonOrThrow(res) as Promise<{ tracks: MusicTrack[] }>;
}

export async function adminDeleteMusicTrack(id: string) {
  const res = await authedFetch(`/admin/music-tracks/${id}`, { method: "DELETE" });
  return parseJsonOrThrow(res) as Promise<{ ok: true }>;
}

// --- Users ---------------------------------------------------------------------------

export async function adminListUsers() {
  const res = await authedFetch("/admin/users");
  return parseJsonOrThrow(res) as Promise<{ users: AdminUser[] }>;
}

// --- Subscriptions ---------------------------------------------------------------------

export async function adminActivateSubscription(userId: string, days = 30) {
  const res = await authedFetch(`/admin/users/${userId}/subscription/activate`, {
    method: "POST",
    body: JSON.stringify({ days }),
  });
  return parseJsonOrThrow(res);
}

export async function adminSuspendSubscription(userId: string) {
  const res = await authedFetch(`/admin/users/${userId}/subscription/suspend`, { method: "POST" });
  return parseJsonOrThrow(res);
}

// --- Alerts -------------------------------------------------------------------------

export async function adminListAlerts(status?: AdminAlert["status"]) {
  const res = await authedFetch(`/admin/alerts${status ? `?status=${status}` : ""}`);
  return parseJsonOrThrow(res) as Promise<{ alerts: AdminAlert[] }>;
}

export async function adminResolveAlert(id: string) {
  const res = await authedFetch(`/admin/alerts/${id}/resolve`, { method: "POST" });
  return parseJsonOrThrow(res);
}

// --- Game toggles ---------------------------------------------------------------------

export async function adminListGameToggles() {
  const res = await authedFetch("/admin/game-toggles");
  return parseJsonOrThrow(res) as Promise<{ toggles: GameToggle[] }>;
}

export async function adminSetGameToggle(gameType: string, enabled: boolean) {
  const res = await authedFetch(`/admin/game-toggles/${gameType}`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
  return parseJsonOrThrow(res) as Promise<{ toggle: GameToggle }>;
}

// --- Dashboard homepage (hero title + up to 3 spotlighted games) ----------------------

export interface AdminHomepageSettings {
  heroTitle: string | null;
  featuredGameTypes: string[];
}

export async function adminGetHomepageSettings() {
  const res = await authedFetch("/admin/homepage");
  return parseJsonOrThrow(res) as Promise<AdminHomepageSettings>;
}

export async function adminUpdateHomepageSettings(heroTitle: string, featuredGameTypes: string[]) {
  const res = await authedFetch("/admin/homepage", {
    method: "PUT",
    body: JSON.stringify({ heroTitle, featuredGameTypes }),
  });
  return parseJsonOrThrow(res) as Promise<AdminHomepageSettings>;
}

// --- Game content (admin-editable library-card + control-page text/image) -------------

export interface AdminGameContentEntry {
  gameType: string;
  nameAr: string | null;
  descriptionAr: string | null;
  bioAr: string | null;
  rulesAr: string | null;
  imageUrl: string | null;
  updatedAt: string | null;
}

export async function adminListGameContent() {
  const res = await authedFetch("/admin/game-content");
  return parseJsonOrThrow(res) as Promise<{ content: AdminGameContentEntry[] }>;
}

export async function adminUpdateGameContent(
  gameType: string,
  fields: { nameAr: string; descriptionAr: string; bioAr: string; rulesAr: string },
) {
  const res = await authedFetch(`/admin/game-content/${gameType}`, { method: "PUT", body: JSON.stringify(fields) });
  return parseJsonOrThrow(res) as Promise<{ content: AdminGameContentEntry }>;
}

export async function adminUploadGameContentImage(gameType: string, file: File) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await authedFetch(`/admin/game-content/${gameType}/image`, { method: "POST", body: formData });
  return parseJsonOrThrow(res) as Promise<{ content: AdminGameContentEntry }>;
}

export async function adminClearGameContentImage(gameType: string) {
  const res = await authedFetch(`/admin/game-content/${gameType}/image`, { method: "DELETE" });
  return parseJsonOrThrow(res) as Promise<{ content: AdminGameContentEntry | null }>;
}

// --- Admin action log -----------------------------------------------------------------

export async function adminListLogs() {
  const res = await authedFetch("/admin/logs");
  return parseJsonOrThrow(res) as Promise<{ logs: AdminLogEntry[] }>;
}

// --- Analytics -------------------------------------------------------------------------

export async function adminGetAnalytics() {
  const res = await authedFetch("/admin/analytics");
  return parseJsonOrThrow(res) as Promise<AdminAnalytics>;
}
