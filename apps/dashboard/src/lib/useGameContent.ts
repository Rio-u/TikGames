import { useEffect, useState } from "react";
import { getGameContent, type GameContentEntry } from "./liveApi";

/** Fetches admin-set game content overrides once on mount — see getGameContent + mergeGameContent. */
export function useGameContent() {
  const [content, setContent] = useState<Map<string, GameContentEntry>>(new Map());

  useEffect(() => {
    getGameContent()
      .then((data) => setContent(new Map(data.content.map((c) => [c.gameType, c]))))
      .catch(() => {});
  }, []);

  return content;
}
