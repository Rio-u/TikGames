import { useCallback, useEffect, useState } from "react";
import { getCurrentLive, type LiveSession } from "./liveApi";

/**
 * Fetches the streamer's current live session once on mount. This only owns the initial fetch —
 * pages that also want real-time status updates should listen for "live:status" on their own
 * socket connection and call the returned setter themselves. `refetch` re-runs the same fetch on
 * demand (e.g. a manual refresh button) without needing its own socket wiring.
 */
export function useLiveSession() {
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [loadingLiveSession, setLoadingLiveSession] = useState(true);

  const refetch = useCallback(() => {
    setLoadingLiveSession(true);
    return getCurrentLive()
      .then((data) => setLiveSession(data.liveSession))
      .catch(() => {})
      .finally(() => setLoadingLiveSession(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { liveSession, setLiveSession, loadingLiveSession, refetch };
}
