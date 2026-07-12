import { LiveSocketEvents, type LiveEvent } from "@tikgames/shared-types";
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
  }
  // gift/like/follow events aren't consumed by any game yet — future games hook in here.
}
