@echo off
setlocal

set "ROOT=%~dp0"
if not exist "%ROOT%.logs" mkdir "%ROOT%.logs"

rem The database is Supabase (Postgres) now — cloud, no local DB to start. Make sure
rem DATABASE_URL is set in appspi\.env and packages\database\.env before running.
echo [tikgames] Starting API, tiktok-connector, dashboard, and overlay in the background...
start /min "" /D "%ROOT%" cmd /c "pnpm --filter @tikgames/api dev > .logs\api.log 2>&1"
start /min "" /D "%ROOT%" cmd /c "pnpm --filter @tikgames/tiktok-connector dev > .logs\connector.log 2>&1"
start /min "" /D "%ROOT%" cmd /c "pnpm --filter @tikgames/dashboard dev > .logs\dashboard.log 2>&1"
start /min "" /D "%ROOT%" cmd /c "pnpm --filter @tikgames/overlay dev > .logs\overlay.log 2>&1"

echo [tikgames] Waiting a few seconds for everything to boot...
timeout /t 6 /nobreak >nul

echo.
echo ================================================
echo   TikGames is running
echo ================================================
echo   Dashboard : http://localhost:5173
echo   Overlay   : http://localhost:5174
echo   API       : http://localhost:4000/health
echo ================================================
echo   Logs:  %ROOT%.logs\  (api.log, connector.log, dashboard.log, overlay.log)
echo   Stop:  stop.bat
echo ================================================
