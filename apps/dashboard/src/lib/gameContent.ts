import type { GameDefinition } from "../data/games";
import type { GameContentEntry } from "./liveApi";

/** Effective (admin override ?? hardcoded default) name/description/image — pure, no fetching.
 *  emoji/gradient/route are never overridden (out of scope), always from the hardcoded definition. */
export function mergeGameContent(game: GameDefinition, override: GameContentEntry | undefined): GameDefinition {
  if (!override) return game;
  return {
    ...game,
    nameAr: override.nameAr ?? game.nameAr,
    descriptionAr: override.descriptionAr ?? game.descriptionAr,
    imageUrl: override.imageUrl ?? game.imageUrl,
  };
}
