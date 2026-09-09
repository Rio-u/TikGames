import { LiveSocketEvents, type LiveEvent } from "@tikgames/shared-types";
import { recordFollow, recordGift, recordLike } from "./liveStats.js";
import { activeEngines, broadcastToLive, liveSessionToGameSession } from "./registry.js";

/**
 * Single entry point for a normalized live event, whether it came from the real
 * tiktok-connector service or from the /live/:id/simulate-comment test endpoint — both paths
 * run through the exact same game-engine wiring.
 */
export async function handleLiveEvent(event: LiveEvent): Promise<void> {
  if (event.type === "comment") {
    broadcastToLive(event.liveSessionId, LiveSocketEvents.ChatComment, {
      viewer: event.viewer,
      text: event.text,
      at: event.at,
    });

    const gameSessionId = liveSessionToGameSession.get(event.liveSessionId);
    if (gameSessionId) {
      const engine = activeEngines.get(gameSessionId);
      engine?.handleComment(event.viewer.handle, event.viewer.displayName, event.viewer.avatarUrl, event.text);
    }
    return;
  }

  // Gift/like/follow feed the overlay widgets (top gifters, gift feed, goals, effects). No game
  // consumes them yet; a future game that wants them hooks in right here, alongside these calls
  // rather than instead of them — the widgets must keep working whatever game is running.
  if (event.type === "gift") {
    recordGift(event);
    return;
  }
  if (event.type === "like") {
    recordLike(event);
    return;
  }
  if (event.type === "follow") {
    recordFollow(event);
  }
}
