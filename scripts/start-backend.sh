#!/usr/bin/env bash
# Launches the api (foreground) and the tiktok-connector (background, auto-restarting) in one
# container. See Dockerfile.backend for why they're co-located.
set -eu

# The connector connects to the api's internal socket channel. In this single container that's
# just localhost on whatever port the host assigned the api ($PORT, injected by Render/Railway).
export API_INTERNAL_URL="http://127.0.0.1:${PORT:-4000}"

echo "[launcher] api will listen on :${PORT:-4000}; connector -> ${API_INTERNAL_URL}"

# Connector in the background with a crash-restart loop. If it dies (bad Euler key, TikTok blip)
# the api must keep serving — the connector reconnects to the internal channel on its own, and the
# api re-issues watch commands for any active session on every connector (re)connect.
(
  while true; do
    echo "[launcher] starting tiktok-connector"
    (cd /repo/apps/tiktok-connector && pnpm start) || \
      echo "[launcher] connector exited with $? — restarting in 3s"
    sleep 3
  done
) &

# api in the foreground. If it exits, this script exits and the host restarts the whole container.
cd /repo/apps/api
exec pnpm start
