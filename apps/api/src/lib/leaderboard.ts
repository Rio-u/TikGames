import { Prisma } from "@tikgames/database";
import { prisma } from "./prisma.js";

/**
 * Adds `deltaScore` to a viewer's running total against one specific streamer — permanent,
 * independent per (streamer, viewer) pair (CLAUDE.md: rankings never merge across streamers).
 *
 * Concurrency-safe without relying on upsert semantics: two near-simultaneous scores for the
 * same never-before-seen viewer could both observe "no row yet" and both attempt `create`, and
 * the second would hit the real `@@unique([streamerId, viewerHandle])` constraint as a P2002
 * error. So: update-first (the common case once a row exists — `{ increment }` compiles to an
 * atomic `col = col + delta`), create-on-not-found, and retry-as-update if that create loses the
 * race.
 */
export async function incrementViewerRanking(
  streamerId: string,
  viewerHandle: string,
  displayName: string,
  avatarUrl: string | null,
  deltaScore: number,
  countsAsNewSession: boolean,
): Promise<void> {
  const key = { streamerId_viewerHandle: { streamerId, viewerHandle } };
  const updateData = {
    totalScore: { increment: deltaScore },
    gamesPlayed: countsAsNewSession ? { increment: 1 } : undefined,
    displayName,
    avatarUrl,
    lastPlayedAt: new Date(),
  };

  try {
    await prisma.viewerRanking.update({ where: key, data: updateData });
    return;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2025") {
      console.error("[api] failed to update viewer ranking:", err);
      return;
    }
    // P2025 = no row yet for this (streamer, viewer) pair — first time this viewer scored here.
  }

  try {
    await prisma.viewerRanking.create({
      data: {
        streamerId,
        viewerHandle,
        displayName,
        avatarUrl,
        totalScore: deltaScore,
        gamesPlayed: countsAsNewSession ? 1 : 0,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Lost the create race to a concurrent call — the row exists now, retry as an update.
      await prisma.viewerRanking
        .update({ where: key, data: updateData })
        .catch((e) => console.error("[api] failed to update viewer ranking after create race:", e));
      return;
    }
    console.error("[api] failed to create viewer ranking:", err);
  }
}
