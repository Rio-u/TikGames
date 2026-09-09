import {
  LiveSocketEvents,
  OVERLAY_WIDGET_CATALOG,
  getOverlayWidget,
  overlayWidgetDefaults,
  type LiveEvent,
  type OverlayWidgetDefinition,
  type OverlayWidgetSettings,
} from "@tikgames/shared-types";
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { handleLiveEvent } from "../realtime/commentIngestion.js";
import { resetJar, setTimer, snapshotFor } from "../realtime/liveStats.js";
import { broadcastToLive } from "../realtime/registry.js";

const router = Router();

const ACTIVE_STATUSES = ["PENDING", "CONNECTING", "LIVE", "ERROR"] as const;

/**
 * Validates a settings object against the widget's own field list. Unknown keys are dropped and
 * out-of-range numbers are clamped rather than rejected — this is cosmetic configuration, and a
 * 400 over a colour picker sending `#ABC` instead of `#AABBCC` helps nobody. Anything that fails
 * to coerce falls back to the field's default, so the stored object is always renderable.
 */
function sanitizeSettings(def: OverlayWidgetDefinition, raw: unknown): OverlayWidgetSettings {
  const input = (raw ?? {}) as Record<string, unknown>;
  const out: OverlayWidgetSettings = {};

  for (const field of def.fields) {
    const value = input[field.key];
    if (value === undefined || value === null) {
      out[field.key] = field.default;
      continue;
    }

    switch (field.type) {
      case "NUMBER": {
        const n = Number(value);
        if (!Number.isFinite(n)) {
          out[field.key] = field.default;
          break;
        }
        const min = field.min ?? Number.NEGATIVE_INFINITY;
        const max = field.max ?? Number.POSITIVE_INFINITY;
        out[field.key] = Math.min(max, Math.max(min, Math.round(n)));
        break;
      }
      case "TOGGLE":
        out[field.key] = value === true || value === "true";
        break;
      case "COLOR": {
        const s = String(value).trim();
        out[field.key] = /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : field.default;
        break;
      }
      case "SELECT": {
        const s = String(value);
        const allowed = (field.options ?? []).some((o) => o.value === s);
        out[field.key] = allowed ? s : field.default;
        break;
      }
      case "TEXT":
      default:
        // Cap length so a pasted essay can't become a 2MB overlay URL or blow up the layout.
        out[field.key] = String(value).slice(0, 300);
        break;
    }
  }

  return out;
}

async function resolveSettings(userId: string): Promise<Record<string, OverlayWidgetSettings>> {
  const rows = await prisma.overlayWidgetConfig.findMany({ where: { userId } });
  const stored = new Map(rows.map((r) => [r.widgetId, r.settings as OverlayWidgetSettings]));

  const out: Record<string, OverlayWidgetSettings> = {};
  for (const def of OVERLAY_WIDGET_CATALOG) {
    out[def.id] = { ...overlayWidgetDefaults(def), ...(stored.get(def.id) ?? {}) };
  }
  return out;
}

// --- Catalog + settings ------------------------------------------------------------

/** Public catalog. The overlay app fetches this too (it has no session of its own). */
router.get("/widgets", (_req, res) => {
  res.json({ widgets: OVERLAY_WIDGET_CATALOG });
});

/** The streamer's gallery: every widget, its resolved settings, and its ready-to-paste OBS URL. */
router.get(
  "/widgets/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const [settings, session] = await Promise.all([
      resolveSettings(userId),
      prisma.liveSession.findFirst({
        where: { userId, status: { in: [...ACTIVE_STATUSES] } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      widgets: OVERLAY_WIDGET_CATALOG,
      settings,
      // The token is the whole capability — no live, no URL to hand out.
      overlayToken: session?.overlayToken ?? null,
      liveSessionId: session?.id ?? null,
    });
  }),
);

router.put(
  "/widgets/:widgetId",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const def = getOverlayWidget(req.params.widgetId ?? "");
    if (!def) {
      res.status(404).json({ error: "الودجت دي مش موجودة" });
      return;
    }

    const settings = sanitizeSettings(def, req.body?.settings);
    await prisma.overlayWidgetConfig.upsert({
      where: { userId_widgetId: { userId: req.userId!, widgetId: def.id } },
      create: { userId: req.userId!, widgetId: def.id, settings },
      update: { settings },
    });

    res.json({ widgetId: def.id, settings });
  }),
);

router.delete(
  "/widgets/:widgetId",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const def = getOverlayWidget(req.params.widgetId ?? "");
    if (!def) {
      res.status(404).json({ error: "الودجت دي مش موجودة" });
      return;
    }
    await prisma.overlayWidgetConfig
      .delete({ where: { userId_widgetId: { userId: req.userId!, widgetId: def.id } } })
      .catch(() => undefined); // Already at defaults — resetting twice isn't an error.
    res.json({ widgetId: def.id, settings: overlayWidgetDefaults(def) });
  }),
);

// --- Public read for the overlay itself ---------------------------------------------

/**
 * The overlay page has no login — it authenticates with the session's overlay token, exactly
 * like the overlay socket namespace does. It gets settings and nothing else: no user id, no
 * email, no other session. Same minimum-capability rule as the game overlay.
 */
router.get(
  "/public/:overlayToken",
  asyncHandler(async (req, res) => {
    const session = await prisma.liveSession.findUnique({
      where: { overlayToken: req.params.overlayToken ?? "" },
      select: { id: true, userId: true, status: true },
    });
    if (!session) {
      res.status(404).json({ error: "invalid overlay token" });
      return;
    }

    res.json({
      settings: await resolveSettings(session.userId),
      liveSessionId: session.id,
      status: session.status,
    });
  }),
);

// --- Test + timer control ------------------------------------------------------------

/**
 * Builds the synthetic *live event* a widget's Test button should inject.
 *
 * Deliberately a real `LiveEvent` pushed through `handleLiveEvent`, not a hand-rolled socket
 * payload: the same rule the /live/simulate page follows for comments. A test that took its own
 * shortcut path would happily pass while the real gift → aggregate → broadcast chain was broken,
 * which is the one thing the button exists to catch.
 *
 * Consequence worth knowing: a test gift really does move that stream's gifter tallies, exactly
 * as a real one would. The viewer is named so nobody mistakes it for an actual supporter.
 */
function testEventFor(widgetId: string, liveSessionId: string): LiveEvent | null {
  const viewer = { handle: "tikgames_test", displayName: "مشاهد تجريبي", avatarUrl: null };
  const at = new Date().toISOString();

  switch (widgetId) {
    case "CHAT":
      return { type: "comment", liveSessionId, viewer, text: "تجربة من لوحة التحكم 👋", at };
    case "GIFT_FEED":
    case "GIFT_CANNON":
    case "GIFT_FIREWORK":
    case "GIFT_GOAL":
    case "COIN_JAR":
    case "TOP_GIFTERS":
      return {
        type: "gift",
        liveSessionId,
        viewer,
        giftId: "test",
        repeatCount: 1,
        giftName: "هدية تجريبية",
        coins: 10,
        imageUrl: null,
        isStreakFinished: true,
        at,
      };
    case "LIKE_FOUNTAIN":
    case "TOP_LIKERS":
      return { type: "like", liveSessionId, viewer, count: 15, at };
    case "LAST_FOLLOWER":
      return { type: "follow", liveSessionId, viewer, at };
    default:
      return null;
  }
}

router.post(
  "/test/:widgetId",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const def = getOverlayWidget(req.params.widgetId ?? "");
    if (!def || !def.testable) {
      res.status(400).json({ error: "الودجت دي مالهاش اختبار" });
      return;
    }

    const session = await prisma.liveSession.findFirst({
      where: { userId: req.userId!, status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });
    if (!session) {
      res.status(400).json({ error: "محتاج لايف شغال عشان تجرب الودجت" });
      return;
    }

    // Viewer count is room metadata, not a viewer action — it never flows through
    // handleLiveEvent even for real streams, so its test relays the same way the connector does.
    if (def.id === "VIEWER_COUNT") {
      broadcastToLive(session.id, LiveSocketEvents.RoomStats, {
        liveSessionId: session.id,
        viewerCount: 1234,
        followerCount: 5678,
        avatarUrl: null,
        displayName: null,
      });
      res.json({ ok: true });
      return;
    }

    const event = testEventFor(def.id, session.id);
    if (!event) {
      res.status(400).json({ error: "الودجت دي مالهاش اختبار" });
      return;
    }

    await handleLiveEvent(event);
    res.json({ ok: true });
  }),
);

router.post(
  "/reset/:widgetId",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const def = getOverlayWidget(req.params.widgetId ?? "");
    if (!def?.resettable) {
      res.status(400).json({ error: "الودجت دي مفيهاش تفريغ" });
      return;
    }

    const session = await prisma.liveSession.findFirst({
      where: { userId: req.userId!, status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });
    if (!session) {
      res.status(400).json({ error: "محتاج لايف شغال" });
      return;
    }

    if (def.id === "COIN_JAR") resetJar(session.id);
    res.json({ ok: true });
  }),
);

router.post(
  "/timer",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const seconds = Number(req.body?.seconds);
    const label = typeof req.body?.label === "string" ? req.body.label.slice(0, 60) : "";
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 24 * 3600) {
      res.status(400).json({ error: "المدة لازم تكون بين 0 و 86400 ثانية" });
      return;
    }

    const session = await prisma.liveSession.findFirst({
      where: { userId: req.userId!, status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });
    if (!session) {
      res.status(400).json({ error: "محتاج لايف شغال" });
      return;
    }

    res.json({ timer: setTimer(session.id, Math.round(seconds), label) });
  }),
);

/** Current widget data for the streamer's own dashboard preview. */
router.get(
  "/snapshot",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const session = await prisma.liveSession.findFirst({
      where: { userId: req.userId!, status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });
    if (!session) {
      res.json({ snapshot: null });
      return;
    }
    res.json({ snapshot: snapshotFor(session.id) });
  }),
);

export default router;
