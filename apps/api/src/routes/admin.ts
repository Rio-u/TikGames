import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { GAME_TYPES, type GameType } from "@tikgames/shared-types";
import { Router, type NextFunction, type Response } from "express";
import multer from "multer";
import { asyncHandler } from "../lib/asyncHandler.js";
import { notifyDiscord } from "../lib/discordWebhook.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth, type AuthedRequest } from "../middleware/auth.js";

// Local disk storage — consistent with this project's single-instance, local-first setup (same
// tradeoff already accepted for the in-memory game-engine registry). Move to object storage if
// this ever needs to run across more than one API instance.
export const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
const TRIVIA_BACKGROUNDS_DIR = path.join(UPLOAD_ROOT, "trivia-backgrounds");
const MUSIC_TRACKS_DIR = path.join(UPLOAD_ROOT, "musical-chairs-music");
const SPEED_WORD_BACKGROUNDS_DIR = path.join(UPLOAD_ROOT, "speed-word-backgrounds");
fs.mkdirSync(TRIVIA_BACKGROUNDS_DIR, { recursive: true });
fs.mkdirSync(MUSIC_TRACKS_DIR, { recursive: true });
fs.mkdirSync(SPEED_WORD_BACKGROUNDS_DIR, { recursive: true });

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 20;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TRIVIA_BACKGROUNDS_DIR),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED_MIME_TO_EXT[file.mimetype] ?? ""}`),
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in ALLOWED_MIME_TO_EXT),
});

const uploadSpeedWordImages = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, SPEED_WORD_BACKGROUNDS_DIR),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED_MIME_TO_EXT[file.mimetype] ?? ""}`),
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in ALLOWED_MIME_TO_EXT),
});

const ALLOWED_AUDIO_MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
};
const MAX_AUDIO_FILE_BYTES = 10 * 1024 * 1024;

const uploadAudio = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, MUSIC_TRACKS_DIR),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED_AUDIO_MIME_TO_EXT[file.mimetype] ?? ""}`),
  }),
  limits: { fileSize: MAX_AUDIO_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in ALLOWED_AUDIO_MIME_TO_EXT),
});

const router = Router();
router.use(requireAuth, requireAdmin);

async function logAdminAction(
  adminUserId: string,
  action: string,
  targetUserId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await prisma.adminActionLog
    .create({ data: { adminUserId, action, targetUserId, metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined } })
    .catch((err) => console.error("[api] failed to log admin action:", err));

  // Discord mirror is entirely best-effort and opt-in (env var) — skip the extra lookup when
  // nobody's listening.
  if (!process.env.DISCORD_ADMIN_LOG_WEBHOOK_URL) return;
  const admin = await prisma.user.findUnique({ where: { id: adminUserId }, select: { displayName: true, username: true } }).catch(() => null);
  const lines = [`🛠️ **${action}**`, `الأدمن: ${admin?.displayName ?? "?"} (@${admin?.username ?? adminUserId})`];
  if (targetUserId) lines.push(`الهدف: ${targetUserId}`);
  if (metadata) lines.push(`\`\`\`json\n${JSON.stringify(metadata)}\n\`\`\``);
  notifyDiscord(lines.join("\n"));
}

// --- Trivia background image pool (platform-wide, admin-curated) ------------------

router.get(
  "/trivia-images",
  asyncHandler(async (_req, res) => {
    const images = await prisma.triviaBackgroundImage.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ images });
  }),
);

router.post(
  "/trivia-images",
  upload.array("images", MAX_FILES),
  asyncHandler(async (req: AuthedRequest, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "لازم ترفع صورة واحدة على الأقل (jpg/png/webp/gif، أقل من 5 ميجا للصورة)" });
      return;
    }
    const base = `${req.protocol}://${req.get("host")}`;
    const images = await Promise.all(
      files.map((f) =>
        prisma.triviaBackgroundImage.create({
          data: { url: `${base}/uploads/trivia-backgrounds/${f.filename}`, uploadedById: req.userId! },
        }),
      ),
    );
    await logAdminAction(req.userId!, "TRIVIA_IMAGES_UPLOADED", undefined, { count: images.length });
    res.status(201).json({ images });
  }),
);

router.delete(
  "/trivia-images/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const image = await prisma.triviaBackgroundImage.findUnique({ where: { id: req.params.id } });
    if (!image) {
      res.status(404).json({ error: "الصورة مش موجودة" });
      return;
    }
    await prisma.triviaBackgroundImage.delete({ where: { id: image.id } });
    fs.unlink(path.join(TRIVIA_BACKGROUNDS_DIR, path.basename(image.url)), () => {});
    await logAdminAction(req.userId!, "TRIVIA_IMAGE_DELETED", undefined, { imageId: image.id });
    res.json({ ok: true });
  }),
);

// --- Speed Word background image pool (platform-wide, admin-curated) --------------

router.get(
  "/speed-word-images",
  asyncHandler(async (_req, res) => {
    const images = await prisma.speedWordBackgroundImage.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ images });
  }),
);

router.post(
  "/speed-word-images",
  uploadSpeedWordImages.array("images", MAX_FILES),
  asyncHandler(async (req: AuthedRequest, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "لازم ترفع صورة واحدة على الأقل (jpg/png/webp/gif، أقل من 5 ميجا للصورة)" });
      return;
    }
    const base = `${req.protocol}://${req.get("host")}`;
    const images = await Promise.all(
      files.map((f) =>
        prisma.speedWordBackgroundImage.create({
          data: { url: `${base}/uploads/speed-word-backgrounds/${f.filename}`, uploadedById: req.userId! },
        }),
      ),
    );
    await logAdminAction(req.userId!, "SPEED_WORD_IMAGES_UPLOADED", undefined, { count: images.length });
    res.status(201).json({ images });
  }),
);

router.delete(
  "/speed-word-images/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const image = await prisma.speedWordBackgroundImage.findUnique({ where: { id: req.params.id } });
    if (!image) {
      res.status(404).json({ error: "الصورة مش موجودة" });
      return;
    }
    await prisma.speedWordBackgroundImage.delete({ where: { id: image.id } });
    fs.unlink(path.join(SPEED_WORD_BACKGROUNDS_DIR, path.basename(image.url)), () => {});
    await logAdminAction(req.userId!, "SPEED_WORD_IMAGE_DELETED", undefined, { imageId: image.id });
    res.json({ ok: true });
  }),
);

// --- Musical Chairs music pool (platform-wide, admin-curated) ---------------------

router.get(
  "/music-tracks",
  asyncHandler(async (_req, res) => {
    const tracks = await prisma.musicalChairsTrack.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ tracks });
  }),
);

router.post(
  "/music-tracks",
  uploadAudio.array("tracks", MAX_FILES),
  asyncHandler(async (req: AuthedRequest, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "لازم ترفع ملف صوت واحد على الأقل (mp3/ogg/wav/m4a، أقل من 10 ميجا للملف)" });
      return;
    }
    const base = `${req.protocol}://${req.get("host")}`;
    const tracks = await Promise.all(
      files.map((f) =>
        prisma.musicalChairsTrack.create({
          data: { url: `${base}/uploads/musical-chairs-music/${f.filename}`, uploadedById: req.userId! },
        }),
      ),
    );
    await logAdminAction(req.userId!, "MUSIC_TRACKS_UPLOADED", undefined, { count: tracks.length });
    res.status(201).json({ tracks });
  }),
);

router.delete(
  "/music-tracks/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const track = await prisma.musicalChairsTrack.findUnique({ where: { id: req.params.id } });
    if (!track) {
      res.status(404).json({ error: "الملف مش موجود" });
      return;
    }
    await prisma.musicalChairsTrack.delete({ where: { id: track.id } });
    fs.unlink(path.join(MUSIC_TRACKS_DIR, path.basename(track.url)), () => {});
    await logAdminAction(req.userId!, "MUSIC_TRACK_DELETED", undefined, { trackId: track.id });
    res.json({ ok: true });
  }),
);

// --- Game toggles (platform-wide per-game kill switch) -----------------------------

router.get(
  "/game-toggles",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.gameToggle.findMany();
    const enabledByType = new Map(rows.map((r) => [r.gameType, r.enabled]));
    const toggles = GAME_TYPES.map((gameType) => ({
      gameType,
      enabled: enabledByType.get(gameType) ?? true,
    }));
    res.json({ toggles });
  }),
);

router.post(
  "/game-toggles/:gameType",
  asyncHandler(async (req: AuthedRequest, res) => {
    const gameType = req.params.gameType as GameType;
    if (!GAME_TYPES.includes(gameType)) {
      res.status(400).json({ error: "نوع اللعبة مش معروف" });
      return;
    }
    if (typeof req.body?.enabled !== "boolean") {
      res.status(400).json({ error: "enabled لازم يكون true أو false" });
      return;
    }
    const { enabled } = req.body;

    const toggle = await prisma.gameToggle.upsert({
      where: { gameType },
      update: { enabled, updatedById: req.userId! },
      create: { gameType, enabled, updatedById: req.userId! },
    });
    await logAdminAction(req.userId!, enabled ? "GAME_ENABLED" : "GAME_DISABLED", undefined, { gameType });
    res.json({ toggle });
  }),
);

// --- Dashboard homepage (hero title + up to 3 spotlighted games) ------------------

router.get(
  "/homepage",
  asyncHandler(async (_req, res) => {
    const settings = await prisma.homepageSettings.findUnique({ where: { key: "homepage" } });
    res.json({
      heroTitle: settings?.heroTitle ?? null,
      featuredGameTypes: settings?.featuredGameTypes ?? [],
    });
  }),
);

router.put(
  "/homepage",
  asyncHandler(async (req: AuthedRequest, res) => {
    const heroTitleRaw = req.body?.heroTitle;
    const heroTitle = typeof heroTitleRaw === "string" && heroTitleRaw.trim() ? heroTitleRaw.trim().slice(0, 120) : null;

    const featuredRaw = req.body?.featuredGameTypes;
    if (!Array.isArray(featuredRaw) || featuredRaw.length > 3 || !featuredRaw.every((g) => GAME_TYPES.includes(g))) {
      res.status(400).json({ error: "الألعاب المميزة لازم تكون 3 على الأكتر ومن الألعاب المعروفة" });
      return;
    }
    const featuredGameTypes = featuredRaw as GameType[];

    const settings = await prisma.homepageSettings.upsert({
      where: { key: "homepage" },
      update: { heroTitle, featuredGameTypes, updatedById: req.userId! },
      create: { key: "homepage", heroTitle, featuredGameTypes, updatedById: req.userId! },
    });
    await logAdminAction(req.userId!, "HOMEPAGE_SETTINGS_UPDATED", undefined, {
      heroTitle,
      featuredGameTypes,
    });
    res.json({ heroTitle: settings.heroTitle, featuredGameTypes: settings.featuredGameTypes });
  }),
);

// --- Game content (admin-editable library-card + control-page text/image, per GameType) -------

const GAME_COVERS_DIR = path.join(UPLOAD_ROOT, "game-covers");
fs.mkdirSync(GAME_COVERS_DIR, { recursive: true });

// Higher than the shared trivia-images MAX_FILE_BYTES on purpose — a cover photo picked straight
// from a phone's camera roll routinely runs 5-10MB unresized, and admins have no reason to know
// (or care) about a backend size limit before picking a file.
const GAME_COVER_MAX_FILE_BYTES = 10 * 1024 * 1024;

const uploadGameCover = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, GAME_COVERS_DIR),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED_MIME_TO_EXT[file.mimetype] ?? ""}`),
  }),
  limits: { fileSize: GAME_COVER_MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in ALLOWED_MIME_TO_EXT),
});

/**
 * multer throws synchronously via `next(err)` from inside its own middleware — that bypasses
 * asyncHandler entirely (it only wraps the route handler after this), so an oversized/rejected
 * file was falling through to index.ts's last-resort error handler and coming back as a generic
 * "حصل خطأ في السيرفر" — indistinguishable from a real server fault, and easy to miss since it
 * gives the admin no idea their file was simply too big. Translate the two real multer failure
 * modes into the same clear, specific error shape every other route in this file already returns.
 */
function handleGameCoverUpload(req: AuthedRequest, res: Response, next: NextFunction) {
  uploadGameCover.single("image")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: `الصورة أكبر من الحد المسموح (${GAME_COVER_MAX_FILE_BYTES / (1024 * 1024)} ميجا) — قلل حجمها وحاول تاني` });
      return;
    }
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: "حصل خطأ في رفع الصورة، جرب صورة تانية" });
      return;
    }
    next(err);
  });
}

function trimOrNull(v: unknown, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

router.get(
  "/game-content",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.gameContent.findMany();
    const byType = new Map(rows.map((r) => [r.gameType, r]));
    const content = GAME_TYPES.map((gameType) => {
      const row = byType.get(gameType);
      return {
        gameType,
        nameAr: row?.nameAr ?? null,
        descriptionAr: row?.descriptionAr ?? null,
        bioAr: row?.bioAr ?? null,
        rulesAr: row?.rulesAr ?? null,
        imageUrl: row?.imageUrl ?? null,
        updatedAt: row?.updatedAt?.toISOString() ?? null,
      };
    });
    res.json({ content });
  }),
);

router.put(
  "/game-content/:gameType",
  asyncHandler(async (req: AuthedRequest, res) => {
    const gameType = req.params.gameType as GameType;
    if (!GAME_TYPES.includes(gameType)) {
      res.status(400).json({ error: "نوع اللعبة مش معروف" });
      return;
    }
    const nameAr = trimOrNull(req.body?.nameAr, 60);
    const descriptionAr = trimOrNull(req.body?.descriptionAr, 300);
    const bioAr = trimOrNull(req.body?.bioAr, 2000);
    const rulesAr = trimOrNull(req.body?.rulesAr, 2000);

    const content = await prisma.gameContent.upsert({
      where: { gameType },
      update: { nameAr, descriptionAr, bioAr, rulesAr, updatedById: req.userId! },
      create: { gameType, nameAr, descriptionAr, bioAr, rulesAr, updatedById: req.userId! },
    });
    await logAdminAction(req.userId!, "GAME_CONTENT_UPDATED", undefined, { gameType });
    res.json({ content });
  }),
);

router.post(
  "/game-content/:gameType/image",
  handleGameCoverUpload,
  asyncHandler(async (req: AuthedRequest, res) => {
    const gameType = req.params.gameType as GameType;
    if (!GAME_TYPES.includes(gameType)) {
      res.status(400).json({ error: "نوع اللعبة مش معروف" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "لازم ترفع صورة (jpg/png/webp/gif، أقل من 5 ميجا)" });
      return;
    }
    const previous = await prisma.gameContent.findUnique({ where: { gameType } });
    const base = `${req.protocol}://${req.get("host")}`;
    const imageUrl = `${base}/uploads/game-covers/${req.file.filename}`;
    const content = await prisma.gameContent.upsert({
      where: { gameType },
      update: { imageUrl, updatedById: req.userId! },
      create: { gameType, imageUrl, updatedById: req.userId! },
    });
    if (previous?.imageUrl) fs.unlink(path.join(GAME_COVERS_DIR, path.basename(previous.imageUrl)), () => {});
    await logAdminAction(req.userId!, "GAME_CONTENT_IMAGE_UPLOADED", undefined, { gameType });
    res.json({ content });
  }),
);

router.delete(
  "/game-content/:gameType/image",
  asyncHandler(async (req: AuthedRequest, res) => {
    const gameType = req.params.gameType as GameType;
    if (!GAME_TYPES.includes(gameType)) {
      res.status(400).json({ error: "نوع اللعبة مش معروف" });
      return;
    }
    const previous = await prisma.gameContent.findUnique({ where: { gameType } });
    if (!previous?.imageUrl) {
      res.json({ content: previous ?? null });
      return;
    }
    const content = await prisma.gameContent.update({ where: { gameType }, data: { imageUrl: null, updatedById: req.userId! } });
    fs.unlink(path.join(GAME_COVERS_DIR, path.basename(previous.imageUrl)), () => {});
    await logAdminAction(req.userId!, "GAME_CONTENT_IMAGE_CLEARED", undefined, { gameType });
    res.json({ content });
  }),
);

// --- Users --------------------------------------------------------------------------

router.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        createdAt: true,
        subscription: { select: { status: true, trialEndsAt: true, currentPeriodEnd: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users });
  }),
);

// --- Subscriptions --------------------------------------------------------------------

router.post(
  "/users/:userId/subscription/activate",
  asyncHandler(async (req: AuthedRequest, res) => {
    const targetUserId = req.params.userId;
    const daysRaw = Number(req.body?.days);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : 30;
    const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const subscription = await prisma.subscription
      .update({
        where: { userId: targetUserId },
        data: { status: "ACTIVE", activatedById: req.userId!, activatedAt: new Date(), currentPeriodEnd: periodEnd },
      })
      .catch(() => null);
    if (!subscription) {
      res.status(404).json({ error: "الاشتراك مش موجود" });
      return;
    }
    await logAdminAction(req.userId!, "SUBSCRIPTION_ACTIVATED", targetUserId, { days });
    res.json({ subscription });
  }),
);

router.post(
  "/users/:userId/subscription/suspend",
  asyncHandler(async (req: AuthedRequest, res) => {
    const targetUserId = req.params.userId;
    const subscription = await prisma.subscription
      .update({ where: { userId: targetUserId }, data: { status: "SUSPENDED" } })
      .catch(() => null);
    if (!subscription) {
      res.status(404).json({ error: "الاشتراك مش موجود" });
      return;
    }
    await logAdminAction(req.userId!, "SUBSCRIPTION_SUSPENDED", targetUserId);
    res.json({ subscription });
  }),
);

// --- Alerts -------------------------------------------------------------------------

router.get(
  "/alerts",
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const alerts = await prisma.alert.findMany({
      where: status === "OPEN" || status === "ACKNOWLEDGED" || status === "RESOLVED" ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ alerts });
  }),
);

router.post(
  "/alerts/:id/resolve",
  asyncHandler(async (req: AuthedRequest, res) => {
    const alert = await prisma.alert
      .update({
        where: { id: req.params.id },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: req.userId! },
      })
      .catch(() => null);
    if (!alert) {
      res.status(404).json({ error: "التنبيه مش موجود" });
      return;
    }
    await logAdminAction(req.userId!, "ALERT_RESOLVED", undefined, { alertId: alert.id });
    res.json({ alert });
  }),
);

// --- Admin action log -----------------------------------------------------------------

router.get(
  "/logs",
  asyncHandler(async (_req, res) => {
    const logs = await prisma.adminActionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { adminUser: { select: { displayName: true, username: true } } },
    });

    const targetIds = [...new Set(logs.map((l) => l.targetUserId).filter((id): id is string => !!id))];
    const targets = targetIds.length
      ? await prisma.user.findMany({ where: { id: { in: targetIds } }, select: { id: true, displayName: true, username: true } })
      : [];
    const targetsById = new Map(targets.map((t) => [t.id, t]));

    res.json({
      logs: logs.map((l) => ({
        ...l,
        targetUser: l.targetUserId ? (targetsById.get(l.targetUserId) ?? null) : null,
      })),
    });
  }),
);

// --- Analytics overview ----------------------------------------------------------------

router.get(
  "/analytics",
  asyncHandler(async (_req, res) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsers7d,
      subsByStatus,
      totalLiveSessions,
      currentlyLive,
      totalGameSessions,
      gameSessions7d,
      gameSessionsByType,
      gameSessionsByStatus,
      openAlerts,
      criticalOpenAlerts,
      totalAdminActions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.subscription.groupBy({ by: ["status"], _count: true }),
      prisma.liveSession.count(),
      prisma.liveSession.count({ where: { status: "LIVE" } }),
      prisma.gameSession.count(),
      prisma.gameSession.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.gameSession.groupBy({ by: ["gameType"], _count: true }),
      prisma.gameSession.groupBy({ by: ["status"], _count: true }),
      prisma.alert.count({ where: { status: "OPEN" } }),
      prisma.alert.count({ where: { status: "OPEN", severity: "CRITICAL" } }),
      prisma.adminActionLog.count(),
    ]);

    res.json({
      users: { total: totalUsers, new7d: newUsers7d },
      subscriptions: subsByStatus.map((s) => ({ status: s.status, count: s._count })),
      liveSessions: { total: totalLiveSessions, live: currentlyLive },
      gameSessions: {
        total: totalGameSessions,
        last7d: gameSessions7d,
        byType: gameSessionsByType.map((g) => ({ gameType: g.gameType, count: g._count })),
        byStatus: gameSessionsByStatus.map((g) => ({ status: g.status, count: g._count })),
      },
      alerts: { open: openAlerts, criticalOpen: criticalOpenAlerts },
      adminActions: { total: totalAdminActions },
    });
  }),
);

export default router;
