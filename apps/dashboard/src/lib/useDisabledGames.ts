import { useEffect, useState } from "react";
import { getDisabledGameTypes } from "./liveApi";

/** Fetches the admin-disabled game list once on mount — see getDisabledGameTypes. */
export function useDisabledGames() {
  const [disabledGames, setDisabledGames] = useState<Set<string>>(new Set());

  useEffect(() => {
    getDisabledGameTypes()
      .then((data) => setDisabledGames(new Set(data.disabled)))
      .catch(() => {});
  }, []);

  return disabledGames;
}
