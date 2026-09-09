import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

/** The calling streamer's own viewer rankings — never another streamer's, per the whole point
 *  of this feature (independent tallies per streamer, CLAUDE.md). */
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const rankings = await prisma.viewerRanking.findMany({
      where: { streamerId: req.userId! },
      orderBy: { totalScore: "desc" },
      take: 100,
    });
    res.json({ rankings });
  }),
);

/**
 * The RANKING overlay widget's read. Authenticated by the live session's overlay token, exactly
 * like the overlay socket namespace — the widget has no login of its own.
 *
 * Returns only what a public-facing stream overlay is meant to put on screen: display name,
 * avatar, score. No handle-to-account mapping, no ids, no counts of anything private.
 */
router.get(
  "/public/:overlayToken",
  asyncHandler(async (req, res) => {
    const session = await prisma.liveSession.findUnique({
      where: { overlayToken: req.params.overlayToken ?? "" },
      select: { userId: true },
    });
    if (!session) {
      res.status(404).json({ error: "invalid overlay token" });
      return;
    }

    const rankings = await prisma.viewerRanking.findMany({
      where: { streamerId: session.userId },
      orderBy: { totalScore: "desc" },
      take: 25,
      select: { viewerHandle: true, displayName: true, avatarUrl: true, totalScore: true },
    });

    res.json({
      rows: rankings.map((r) => ({
        handle: r.viewerHandle,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        value: r.totalScore,
      })),
    });
  }),
);

export default router;
