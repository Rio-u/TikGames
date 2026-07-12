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

export default router;
