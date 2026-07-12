import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { handleLiveEvent } from "../realtime/commentIngestion.js";
import { isConnectorOnline, requestUnwatch, requestWatch } from "../realtime/registry.js";

const router = Router();
// ERROR counts as "current" on purpose: a failed TikTok connection shouldn't make the live
// vanish from /live/current (which blanked the game control pages with "start a live first"
// even though one was just started). An errored live stays visible with its error state, can
// be retried via /live/start (same row, so the OBS overlayToken stays stable), stopped, and
// still works fully with the simulate page. Only ENDED is terminal.
const ACTIVE_STATUSES = ["PENDING", "CONNECTING", "LIVE", "ERROR"] as const;

router.post(
  "/start",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { channelUsername } = req.body ?? {};
    if (typeof channelUsername !== "string" || !channelUsername.trim()) {
      res.status(400).json({ error: "channelUsername is required" });
      return;
    }
    if (!isConnectorOnline()) {
      res.status(503).json({ error: "خدمة الاتصال بـ TikTok مش شغالة دلوقتي، حاول تاني كمان شوية" });
      return;
    }

    const normalizedUsername = channelUsername.trim().replace(/^@/, "");
    const userId = req.userId!;

    let session = await prisma.liveSession.findFirst({
      where: { userId, status: { in: [...ACTIVE_STATUSES] } },
    });

    session = session
      ? await prisma.liveSession.update({
          where: { id: session.id },
          data: { channelUsername: normalizedUsername, status: "CONNECTING" },
        })
      : await prisma.liveSession.create({
          data: { userId, channelUsername: normalizedUsername, status: "CONNECTING" },
        });

    requestWatch({ liveSessionId: session.id, channelUsername: normalizedUsername });

    res.json({
      liveSessionId: session.id,
      overlayToken: session.overlayToken,
      channelUsername: session.channelUsername,
      status: session.status,
    });
  }),
);

router.post(
  "/stop",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const session = await prisma.liveSession.findFirst({
      where: { userId: req.userId!, status: { in: [...ACTIVE_STATUSES] } },
    });
    if (!session) {
      res.status(404).json({ error: "مفيش لايف شغال دلوقتي" });
      return;
    }

    requestUnwatch({ liveSessionId: session.id });
    await prisma.liveSession.update({
      where: { id: session.id },
      data: { status: "ENDED", endedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

router.get(
  "/current",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const session = await prisma.liveSession.findFirst({
      where: { userId: req.userId!, status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ liveSession: session });
  }),
);

router.post(
  "/:liveSessionId/simulate-comment",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { liveSessionId } = req.params;
    const { viewerHandle, displayName, text } = req.body ?? {};
    if (typeof viewerHandle !== "string" || typeof text !== "string" || !viewerHandle.trim() || !text.trim()) {
      res.status(400).json({ error: "viewerHandle and text are required" });
      return;
    }

    const session = await prisma.liveSession.findUnique({ where: { id: liveSessionId } });
    if (!session || session.userId !== req.userId) {
      res.status(404).json({ error: "Live session not found" });
      return;
    }

    await handleLiveEvent({
      type: "comment",
      liveSessionId,
      viewer: {
        handle: viewerHandle.trim(),
        displayName:
          typeof displayName === "string" && displayName.trim() ? displayName.trim() : viewerHandle.trim(),
        avatarUrl: null,
      },
      text: text.trim(),
      at: new Date().toISOString(),
    });

    res.json({ ok: true });
  }),
);

export default router;
