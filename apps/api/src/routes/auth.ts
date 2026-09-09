import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../lib/asyncHandler.js";
import { exchangeDiscordCode, fetchDiscordProfile, getDiscordAuthorizeUrl } from "../lib/discordOAuth.js";
import {
  REFRESH_TOKEN_TTL_MS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type UserRole,
} from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { exchangeTikTokCode, fetchTikTokProfile, getTikTokAuthorizeUrl } from "../lib/tiktokOAuth.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();
const TRIAL_DAYS = 3;
// The one browser-facing URL OAuth callbacks redirect back to — deliberately its own env var,
// not derived from CORS_ORIGIN. CORS_ORIGIN is now a comma-separated allowlist (dashboard +
// overlay, see index.ts), and blindly reusing it here as a single redirect target produced a
// literal "http://localhost:5173,http://localhost:5174/auth/callback?..." URL — an unparseable
// Location header the browser reports as ERR_INVALID_REDIRECT.
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "http://localhost:5173";
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// Brute-force protection: caps guesses per IP regardless of which account is targeted. Applied
// to /login (credential guessing) and /register (automated account creation).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "محاولات دخول كتير من الجهاز ده — استنى شوية وجرب تاني" },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "محاولات تسجيل كتير من الجهاز ده — استنى شوية وجرب تاني" },
});
// Guards against someone with a stolen (but valid) access token brute-forcing the current
// password via this endpoint — same shape as loginLimiter, just keyed to an already-auth'd route.
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "محاولات كتير — استنى شوية وجرب تاني" },
});

// In-memory, single-instance stores for the OAuth handshake (TikTok + Discord share these).
// `pendingStates` guards against CSRF (issued at /<provider>/start, consumed at .../callback).
// When issued from an authenticated "link this account" action, the entry also carries
// `linkUserId` so the callback can tell "log me in" apart from "attach this to my existing
// account" — that's the only signal distinguishing the two, since the OAuth redirect itself
// can't carry an Authorization header.
// `pendingExchanges` hands the browser a short-lived one-time code instead of putting real JWTs
// in a redirect URL / browser history — the frontend swaps it immediately via
// POST /auth/oauth/exchange. Move both to Redis before running more than one API instance.
const pendingStates = new Map<string, { linkUserId?: string }>();
const pendingExchanges = new Map<
  string,
  { user: ReturnType<typeof toPublicUser>; accessToken: string; refreshToken: string; expiresAt: number }
>();

function cleanupExpiredExchanges() {
  const now = Date.now();
  for (const [code, entry] of pendingExchanges) {
    if (entry.expiresAt < now) pendingExchanges.delete(code);
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Issues a fresh CSRF state for an OAuth handshake, optionally tagged as a "link to this
 *  already-logged-in user" request. Expires on its own after 5 minutes either way. */
function issueOAuthState(linkUserId?: string): string {
  const state = randomBytes(16).toString("hex");
  pendingStates.set(state, linkUserId ? { linkUserId } : {});
  setTimeout(() => pendingStates.delete(state), 5 * 60 * 1000);
  return state;
}

async function issueTokens(userId: string, role: UserRole) {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = signRefreshToken({ sub: userId });
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return { accessToken, refreshToken };
}

/** Derives a unique, ASCII `username` from an OAuth profile field (Discord handle, TikTok name, ...). */
async function generateUniqueUsername(base: string): Promise<string> {
  const slug = base.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 16) || "user";
  let candidate = slug;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const existing = await prisma.user.findUnique({ where: { username: candidate } });
    if (!existing) return candidate;
    candidate = `${slug}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return `${slug}${randomBytes(4).toString("hex")}`;
}

function effectiveSubscriptionStatus(status: string, trialEndsAt: Date): string {
  if (status === "TRIAL" && trialEndsAt.getTime() < Date.now()) {
    return "EXPIRED";
  }
  return status;
}

/** Registration-method kill switch — fail-open (missing row = enabled), same precedent as
 *  GameToggle. Only ever called on the *new account* path, never for an existing user logging
 *  back in via a method that's since been disabled. */
async function isAuthMethodEnabled(method: "EMAIL_PASSWORD" | "TIKTOK" | "DISCORD"): Promise<boolean> {
  const toggle = await prisma.authMethodToggle.findUnique({ where: { method } });
  return toggle?.enabled ?? true;
}

/** Snapshotted onto Subscription.trialGamesLimit at signup — see PlatformSettings' doc comment
 *  for why this is a one-time stamp, not a live-read value. */
async function getDefaultTrialGames(): Promise<number> {
  const settings = await prisma.platformSettings.findUnique({ where: { key: "platform" } });
  return settings?.defaultTrialGames ?? 3;
}

/** Unset TURNSTILE_SECRET_KEY = silent bypass (same precedent as DISCORD_ADMIN_LOG_WEBHOOK_URL) —
 *  local dev keeps working with no CAPTCHA keys; it only starts actually verifying once a real
 *  secret is configured. */
async function verifyTurnstileToken(token: unknown, remoteIp: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[api] Turnstile verification failed:", err);
    return false;
  }
}

function toPublicUser(user: {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  passwordHash?: string | null;
  subscription: {
    status: string;
    trialEndsAt: Date;
    currentPeriodEnd: Date | null;
    trialGamesLimit: number;
    trialGamesUsed: number;
  } | null;
  tikTokAccount?: unknown;
  discordAccount?: unknown;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    hasPassword: Boolean(user.passwordHash),
    tiktokConnected: Boolean(user.tikTokAccount),
    discordConnected: Boolean(user.discordAccount),
    subscription: user.subscription
      ? {
          status: effectiveSubscriptionStatus(user.subscription.status, user.subscription.trialEndsAt),
          trialEndsAt: user.subscription.trialEndsAt,
          currentPeriodEnd: user.subscription.currentPeriodEnd,
          trialGamesLimit: user.subscription.trialGamesLimit,
          trialGamesUsed: user.subscription.trialGamesUsed,
        }
      : null,
  };
}

const PROFILE_INCLUDE = { subscription: true, tikTokAccount: true, discordAccount: true } as const;

// Public — Login/Register pages call this to know which methods to show. Purely a UI hint; the
// real enforcement lives in each method's own route (see isAuthMethodEnabled call sites below).
router.get(
  "/methods",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.authMethodToggle.findMany();
    const enabledByMethod = new Map(rows.map((r) => [r.method, r.enabled]));
    res.json({
      emailPassword: enabledByMethod.get("EMAIL_PASSWORD") ?? true,
      tiktok: enabledByMethod.get("TIKTOK") ?? true,
      discord: enabledByMethod.get("DISCORD") ?? true,
    });
  }),
);

router.post(
  "/register",
  registerLimiter,
  asyncHandler(async (req, res) => {
    if (!(await isAuthMethodEnabled("EMAIL_PASSWORD"))) {
      res.status(403).json({ error: "التسجيل بالإيميل وكلمة السر متوقف مؤقتاً" });
      return;
    }

    const { email, password, displayName, username, turnstileToken } = req.body ?? {};
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof displayName !== "string" ||
      typeof username !== "string" ||
      !email.includes("@") ||
      !displayName.trim()
    ) {
      res.status(400).json({ error: "email, password, displayName, and username are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    if (!(await verifyTurnstileToken(turnstileToken, req.ip))) {
      res.status(400).json({ error: "فشل التحقق من إنك مش روبوت — حاول تاني" });
      return;
    }
    const normalizedUsername = username.toLowerCase().trim();
    if (!USERNAME_RE.test(normalizedUsername)) {
      res.status(400).json({
        error: "اليوزر لازم يكون 3-20 حرف، حروف إنجليزية وأرقام و _ بس",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const [existingEmail, existingUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email: normalizedEmail } }),
      prisma.user.findUnique({ where: { username: normalizedUsername } }),
    ]);
    if (existingEmail) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    if (existingUsername) {
      res.status(409).json({ error: "اليوزر ده مستخدم بالفعل" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const trialGamesLimit = await getDefaultTrialGames();

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash,
        displayName: displayName.trim(),
        subscription: {
          create: { status: "TRIAL", trialEndsAt, trialGamesLimit },
        },
      },
      include: PROFILE_INCLUDE,
    });

    const tokens = await issueTokens(user.id, user.role as UserRole);
    res.status(201).json({ user: toPublicUser(user), ...tokens });
  }),
);

router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: PROFILE_INCLUDE,
    });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const tokens = await issueTokens(user.id, user.role as UserRole);
    res.json({ user: toPublicUser(user), ...tokens });
  }),
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body ?? {};
    if (typeof refreshToken !== "string") {
      res.status(400).json({ error: "refreshToken is required" });
      return;
    }

    let payload: { sub: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      res.status(401).json({ error: "Refresh token no longer valid" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.status(401).json({ error: "User no longer exists" });
      return;
    }

    await prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });

    const tokens = await issueTokens(user.id, user.role as UserRole);
    res.json(tokens);
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: PROFILE_INCLUDE,
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user: toPublicUser(user) });
  }),
);

router.post(
  "/password",
  requireAuth,
  passwordChangeLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      res.status(400).json({ error: "الباسورد الجديد لازم يكون 8 حروف على الأقل" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Accounts created via OAuth only have no password yet — setting one for the first time
    // doesn't require proving a current one, since there isn't one to prove.
    if (user.passwordHash) {
      if (typeof currentPassword !== "string" || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        res.status(401).json({ error: "الباسورد الحالي غلط" });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.userId }, data: { passwordHash } });
    res.json({ ok: true });
  }),
);

// Redeems an admin-generated bonus-games code — the claim itself is an updateMany guarded on
// redeemedById: null (never a read-then-write, so two simultaneous redemption attempts on the same
// code can't both succeed), and claiming + crediting the games run inside one transaction below.
/**
 * Saves which 3D scenes this streamer picked. Deliberately forgiving about the ids: the registry
 * that owns them lives in the frontend package, so validating against a list here would mean
 * duplicating it and breaking every save the moment a design is added. An unknown id resolves to
 * the default design on read (see getCountdownDesign), which is the safe failure either way.
 */
router.put(
  "/design-prefs",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { countdownDesignId, victoryDesignId } = req.body ?? {};
    const clean = (v: unknown): string | null =>
      typeof v === "string" && v.length > 0 && v.length <= 64 ? v : null;

    await prisma.user.update({
      where: { id: req.userId! },
      data: { countdownDesignId: clean(countdownDesignId), victoryDesignId: clean(victoryDesignId) },
    });
    res.json({ ok: true });
  }),
);

router.post(
  "/redeem-code",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const codeRaw = req.body?.code;
    const code = typeof codeRaw === "string" ? codeRaw.trim().toUpperCase() : "";
    if (!code) {
      res.status(400).json({ error: "لازم تكتب الكود" });
      return;
    }

    // Claiming the code and crediting the games happen in one transaction — a crash between the
    // two must not leave a code marked "redeemed" with nobody actually credited. The updateMany's
    // redeemedById: null guard, evaluated inside the transaction, is what makes the claim itself
    // race-safe against a second simultaneous attempt on the same code.
    try {
      const result = await prisma.$transaction(async (tx) => {
        const claim = await tx.redemptionCode.updateMany({
          where: { code, redeemedById: null },
          data: { redeemedById: req.userId!, redeemedAt: new Date() },
        });
        if (claim.count === 0) throw new Error("ALREADY_REDEEMED");

        const redeemed = await tx.redemptionCode.findUniqueOrThrow({ where: { code } });
        const subscription = await tx.subscription.update({
          where: { userId: req.userId! },
          data: { trialGamesLimit: { increment: redeemed.gamesGranted } },
        });
        return { gamesGranted: redeemed.gamesGranted, trialGamesLimit: subscription.trialGamesLimit };
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      if (err instanceof Error && err.message === "ALREADY_REDEEMED") {
        res.status(400).json({ error: "الكود غلط أو مستخدم قبل كده" });
        return;
      }
      throw err;
    }
  }),
);

// --- Shared OAuth exchange ------------------------------------------------------
// Both /tiktok/callback and /discord/callback redirect here via the frontend with a one-time
// code instead of embedding JWTs directly in the redirect URL.

router.post("/oauth/exchange", (req, res) => {
  const { code } = req.body ?? {};
  if (typeof code !== "string") {
    res.status(400).json({ error: "code is required" });
    return;
  }

  const entry = pendingExchanges.get(code);
  if (!entry || entry.expiresAt < Date.now()) {
    res.status(400).json({ error: "الرابط ده منتهي، حاول تسجل الدخول تاني" });
    return;
  }
  pendingExchanges.delete(code);
  res.json({ user: entry.user, accessToken: entry.accessToken, refreshToken: entry.refreshToken });
});

async function redirectWithSession(res: import("express").Response, userId: string, role: UserRole) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: PROFILE_INCLUDE });
  if (!user) throw new Error("Could not load the account after OAuth sign-in");

  const tokens = await issueTokens(user.id, role);
  const exchangeCode = randomBytes(24).toString("hex");
  cleanupExpiredExchanges();
  pendingExchanges.set(exchangeCode, {
    user: toPublicUser(user),
    ...tokens,
    expiresAt: Date.now() + 60_000,
  });

  res.redirect(`${DASHBOARD_URL}/auth/callback?code=${exchangeCode}`);
}

// --- TikTok OAuth (Login Kit) -------------------------------------------------
// Requires a real TikTok Developer app: TIKTOK_OAUTH_CLIENT_KEY / _CLIENT_SECRET in .env.
// TikTok doesn't expose an email for the user, so OAuth-only accounts get a synthesized,
// non-contactable placeholder email (`<open_id>@tiktok.tikgames.local`) — passwordHash stays
// null, which already blocks them from the email/password /login route.

router.get(
  "/tiktok/start",
  asyncHandler(async (_req, res) => {
    if (!(await isAuthMethodEnabled("TIKTOK"))) {
      res.redirect(`${DASHBOARD_URL}/login?error=method_disabled`);
      return;
    }
    res.redirect(getTikTokAuthorizeUrl(issueOAuthState()));
  }),
);

// Authenticated: called via fetch (so the Bearer token rides along) from the account page,
// which then navigates the browser to the returned URL itself — a plain <a href> redirect can't
// carry an Authorization header, so this is the only way to smuggle "link to *this* user"
// through the OAuth round trip.
router.post(
  "/tiktok/link-start",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json({ url: getTikTokAuthorizeUrl(issueOAuthState(req.userId)) });
  }),
);

router.get(
  "/tiktok/callback",
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;

    if (error || typeof code !== "string" || typeof state !== "string" || !pendingStates.has(state)) {
      res.redirect(`${DASHBOARD_URL}/login?error=tiktok_auth_failed`);
      return;
    }
    const pending = pendingStates.get(state);
    pendingStates.delete(state);

    try {
      const tokenData = await exchangeTikTokCode(code);
      const profile = await fetchTikTokProfile(tokenData.access_token);
      const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      const existingAccount = await prisma.tikTokAccount.findFirst({
        where: { tiktokUserId: profile.open_id },
      });

      if (pending?.linkUserId) {
        const linkUserId = pending.linkUserId;
        if (existingAccount && existingAccount.userId !== linkUserId) {
          res.redirect(`${DASHBOARD_URL}/account?link_error=tiktok_taken`);
          return;
        }
        await prisma.tikTokAccount.upsert({
          where: { userId: linkUserId },
          update: {
            tiktokUserId: profile.open_id,
            username: profile.display_name,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt,
          },
          create: {
            userId: linkUserId,
            tiktokUserId: profile.open_id,
            username: profile.display_name,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt,
          },
        });
        res.redirect(`${DASHBOARD_URL}/account?linked=tiktok`);
        return;
      }

      let userId: string;
      if (existingAccount) {
        await prisma.tikTokAccount.update({
          where: { id: existingAccount.id },
          data: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
          },
        });
        // Keep the user's displayed identity in sync with their current TikTok profile.
        await prisma.user.update({
          where: { id: existingAccount.userId },
          data: { displayName: profile.display_name, avatarUrl: profile.avatar_url },
        });
        userId = existingAccount.userId;
      } else {
        // Defense in depth — /tiktok/start already gates this, but a cached/bookmarked start URL
        // from before the method was disabled could still land here mid-flow.
        if (!(await isAuthMethodEnabled("TIKTOK"))) {
          res.redirect(`${DASHBOARD_URL}/login?error=method_disabled`);
          return;
        }
        const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        const trialGamesLimit = await getDefaultTrialGames();
        const username = await generateUniqueUsername(profile.display_name);
        const newUser = await prisma.user.create({
          data: {
            email: `${profile.open_id}@tiktok.tikgames.local`,
            username,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
            subscription: { create: { status: "TRIAL", trialEndsAt, trialGamesLimit } },
            tikTokAccount: {
              create: {
                username: profile.display_name,
                tiktokUserId: profile.open_id,
                displayName: profile.display_name,
                avatarUrl: profile.avatar_url,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                tokenExpiresAt,
              },
            },
          },
        });
        userId = newUser.id;
      }

      await redirectWithSession(res, userId, "STREAMER");
    } catch (err) {
      console.error("[api] TikTok OAuth failed:", err);
      res.redirect(`${DASHBOARD_URL}/login?error=tiktok_auth_failed`);
    }
  }),
);

// --- Discord OAuth --------------------------------------------------------------
// Requires a real Discord app: DISCORD_OAUTH_CLIENT_ID / _CLIENT_SECRET in .env
// (https://discord.com/developers/applications — add a redirect matching
// DISCORD_OAUTH_REDIRECT_URI under OAuth2 > Redirects).

router.get(
  "/discord/start",
  asyncHandler(async (_req, res) => {
    if (!(await isAuthMethodEnabled("DISCORD"))) {
      res.redirect(`${DASHBOARD_URL}/login?error=method_disabled`);
      return;
    }
    res.redirect(getDiscordAuthorizeUrl(issueOAuthState()));
  }),
);

// See the matching comment on /tiktok/link-start — same reasoning, same mechanism.
router.post(
  "/discord/link-start",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json({ url: getDiscordAuthorizeUrl(issueOAuthState(req.userId)) });
  }),
);

router.get(
  "/discord/callback",
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;

    if (error || typeof code !== "string" || typeof state !== "string" || !pendingStates.has(state)) {
      res.redirect(`${DASHBOARD_URL}/login?error=discord_auth_failed`);
      return;
    }
    const pending = pendingStates.get(state);
    pendingStates.delete(state);

    try {
      const tokenData = await exchangeDiscordCode(code);
      const profile = await fetchDiscordProfile(tokenData.access_token);
      const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      const existingAccount = await prisma.discordAccount.findFirst({
        where: { discordUserId: profile.id },
      });

      if (pending?.linkUserId) {
        const linkUserId = pending.linkUserId;
        if (existingAccount && existingAccount.userId !== linkUserId) {
          res.redirect(`${DASHBOARD_URL}/account?link_error=discord_taken`);
          return;
        }
        await prisma.discordAccount.upsert({
          where: { userId: linkUserId },
          update: {
            discordUserId: profile.id,
            username: profile.username,
            avatarUrl: profile.avatar,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt,
          },
          create: {
            userId: linkUserId,
            discordUserId: profile.id,
            username: profile.username,
            avatarUrl: profile.avatar,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt,
          },
        });
        res.redirect(`${DASHBOARD_URL}/account?linked=discord`);
        return;
      }

      // Matched by discordUserId only — never by email. An OAuth-reported email isn't guaranteed
      // verified, and silently merging into a same-email account is surprising (a user expects
      // "Login with Discord" to show their Discord identity, not resurrect an unrelated account).
      // Linking an OAuth login to an existing account only happens via the authenticated
      // /discord/link-start path above, which stamps `linkUserId` onto the state.
      let userId: string;
      if (existingAccount) {
        await prisma.discordAccount.update({
          where: { id: existingAccount.id },
          data: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt,
            username: profile.username,
            avatarUrl: profile.avatar,
          },
        });
        // Keep the user's displayed identity in sync with their current Discord profile.
        await prisma.user.update({
          where: { id: existingAccount.userId },
          data: { displayName: profile.username, avatarUrl: profile.avatar },
        });
        userId = existingAccount.userId;
      } else {
        // Defense in depth — /discord/start already gates this, but a cached/bookmarked start URL
        // from before the method was disabled could still land here mid-flow.
        if (!(await isAuthMethodEnabled("DISCORD"))) {
          res.redirect(`${DASHBOARD_URL}/login?error=method_disabled`);
          return;
        }
        const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        const trialGamesLimit = await getDefaultTrialGames();
        const fallbackEmail = `${profile.id}@discord.tikgames.local`;
        // Discord's email isn't guaranteed unique to us — another account (e.g. an email/password
        // one) may already own it. We deliberately don't merge into that account (see note
        // above), so fall back to a synthesized email instead of colliding with the unique
        // constraint.
        let email = (profile.email ?? fallbackEmail).toLowerCase();
        if (profile.email && (await prisma.user.findUnique({ where: { email } }))) {
          email = fallbackEmail;
        }
        const username = await generateUniqueUsername(profile.username);
        const newUser = await prisma.user.create({
          data: {
            email,
            username,
            displayName: profile.username,
            avatarUrl: profile.avatar,
            subscription: { create: { status: "TRIAL", trialEndsAt, trialGamesLimit } },
            discordAccount: {
              create: {
                discordUserId: profile.id,
                username: profile.username,
                avatarUrl: profile.avatar,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                tokenExpiresAt,
              },
            },
          },
        });
        userId = newUser.id;
      }

      await redirectWithSession(res, userId, "STREAMER");
    } catch (err) {
      console.error("[api] Discord OAuth failed:", err);
      res.redirect(`${DASHBOARD_URL}/login?error=discord_auth_failed`);
    }
  }),
);

// --- Unlink connected accounts ---------------------------------------------------
// Both refuse if it would leave the account with neither a password nor any other linked login
// method — losing every way in isn't recoverable without support intervening by hand.

router.delete(
  "/discord/unlink",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: PROFILE_INCLUDE });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (!user.passwordHash && !user.tikTokAccount) {
      res.status(400).json({
        error: "لازم يكون عندك باسورد أو حساب TikTok مربوط قبل ما تشيل Discord، عشان متتقفلش برا حسابك",
      });
      return;
    }
    await prisma.discordAccount.deleteMany({ where: { userId: req.userId } });
    res.json({ ok: true });
  }),
);

router.delete(
  "/tiktok/unlink",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: PROFILE_INCLUDE });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (!user.passwordHash && !user.discordAccount) {
      res.status(400).json({
        error: "لازم يكون عندك باسورد أو حساب Discord مربوط قبل ما تشيل TikTok، عشان متتقفلش برا حسابك",
      });
      return;
    }
    await prisma.tikTokAccount.deleteMany({ where: { userId: req.userId } });
    res.json({ ok: true });
  }),
);

export default router;
