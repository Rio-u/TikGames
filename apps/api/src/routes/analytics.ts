import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

const RECENT_SESSIONS_LIMIT = 8;

/**
 * Everything here is counted from this creator's own rows. There is no sampling, no estimation
 * and no seeded demo data: a brand-new account gets zeros, and the dashboard is expected to
 * render an empty state for that rather than invent numbers.
 */
router.get(
  "/summary",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.userId!;

    const liveSessions = await prisma.liveSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        channelUsername: true,
        status: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
      },
    });

    const liveSessionIds = liveSessions.map((s) => s.id);

    // The game rows come back in one query and get folded per live session in memory (rather than
    // a relation include). Fine at this scale (a creator's own history); revisit if it ever pages.
    const gameSessions = liveSessionIds.length
      ? await prisma.gameSession.findMany({
          where: { liveSessionId: { in: liveSessionIds } },
          select: {
            id: true,
            liveSessionId: true,
            gameType: true,
            status: true,
            startedAt: true,
            endedAt: true,
            createdAt: true,
          },
        })
      : [];

    const participantCounts = gameSessions.length
      ? await prisma.gameSessionParticipant.groupBy({
          by: ["gameSessionId"],
          where: { gameSessionId: { in: gameSessions.map((g) => g.id) } },
          _count: { _all: true },
        })
      : [];

    const participantsBySession = new Map(
      participantCounts.map((p) => [p.gameSessionId, p._count._all]),
    );

    const gamesByLiveSession = new Map<string, typeof gameSessions>();
    for (const game of gameSessions) {
      const bucket = gamesByLiveSession.get(game.liveSessionId) ?? [];
      bucket.push(game);
      gamesByLiveSession.set(game.liveSessionId, bucket);
    }

    // Only sessions that actually started and ended contribute airtime — a live still running (or
    // one that errored before starting) would otherwise either be counted as zero or as "now
    // minus creation", both of which quietly distort the average.
    let totalLiveMs = 0;
    let completedLiveSessions = 0;
    for (const session of liveSessions) {
      if (!session.startedAt || !session.endedAt) continue;
      totalLiveMs += session.endedAt.getTime() - session.startedAt.getTime();
      completedLiveSessions += 1;
    }

    const gamesByType = new Map<string, number>();
    for (const game of gameSessions) {
      gamesByType.set(game.gameType, (gamesByType.get(game.gameType) ?? 0) + 1);
    }

    const viewerAggregate = await prisma.viewerRanking.aggregate({
      where: { streamerId: userId },
      _count: { _all: true },
      _sum: { totalScore: true, gamesPlayed: true },
    });

    res.json({
      totals: {
        liveSessions: liveSessions.length,
        completedLiveSessions,
        totalLiveMinutes: Math.round(totalLiveMs / 60000),
        averageLiveMinutes:
          completedLiveSessions > 0 ? Math.round(totalLiveMs / 60000 / completedLiveSessions) : 0,
        gamesStarted: gameSessions.length,
        // GameSessionStatus is PENDING | ACTIVE | PAUSED | ENDED — a game that ran to its own
        // FINISHED phase is persisted as ENDED here, so ENDED is what "finished" means.
        gamesFinished: gameSessions.filter((g) => g.status === "ENDED").length,
        uniqueViewers: viewerAggregate._count._all,
        totalViewerScore: viewerAggregate._sum.totalScore ?? 0,
        totalViewerGamesPlayed: viewerAggregate._sum.gamesPlayed ?? 0,
      },
      gamesByType: [...gamesByType.entries()]
        .map(([gameType, count]) => ({ gameType, count }))
        .sort((a, b) => b.count - a.count),
      recentSessions: liveSessions.slice(0, RECENT_SESSIONS_LIMIT).map((session) => {
        const games = gamesByLiveSession.get(session.id) ?? [];
        return {
          id: session.id,
          channelUsername: session.channelUsername,
          status: session.status,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          createdAt: session.createdAt,
          durationMinutes:
            session.startedAt && session.endedAt
              ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 60000)
              : null,
          gamesPlayed: games.length,
          participants: games.reduce(
            (sum, game) => sum + (participantsBySession.get(game.id) ?? 0),
            0,
          ),
        };
      }),
    });
  }),
);

export default router;
