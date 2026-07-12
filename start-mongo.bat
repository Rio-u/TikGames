@echo off
setlocal

set "ROOT=%~dp0"
set "DATA_DIR=%ROOT%.mongodb-data"
set "PORT=27018"
set "REPL_SET=rs0"

rem Note: 27018 (not the default 27017) on purpose — this machine already runs MongoDB as a
rem Windows service on 27017 without a replica set. Using a separate port keeps this project's
rem MongoDB fully isolated from that system-wide instance instead of reconfiguring it.
set "MONGOSH=%ROOT%node_modules\.bin\mongosh.cmd"

where mongod >nul 2>nul
if not errorlevel 1 (
  set "MONGOD=mongod"
) else (
  set "MONGOD="
  for /d %%V in ("C:\Program Files\MongoDB\Server\*") do (
    if exist "%%V\bin\mongod.exe" set "MONGOD=%%V\bin\mongod.exe"
  )
)

if "%MONGOD%"=="" (
  echo [tikgames] mongod.exe not found. Install MongoDB Community Server:
  echo   https://www.mongodb.com/try/download/community
  exit /b 1
)

if not exist "%MONGOSH%" (
  echo [tikgames] mongosh not found at %MONGOSH%
  echo   Run "pnpm install" at the repo root first.
  exit /b 1
)

if not exist "%DATA_DIR%" (
  echo [tikgames] Creating data directory at %DATA_DIR%
  mkdir "%DATA_DIR%"
)

echo [tikgames] Checking if MongoDB is already running on port %PORT%...
call "%MONGOSH%" --quiet --port %PORT% --eval "db.runCommand({ ping: 1 })" >nul 2>nul
if not errorlevel 1 (
  echo [tikgames] MongoDB is already running on port %PORT%.
  goto :ensure_replset
)

if not exist "%ROOT%.logs" mkdir "%ROOT%.logs"

echo [tikgames] Starting MongoDB in the background (log: .logs\mongod.log)...
start /min "" "%MONGOD%" --dbpath "%DATA_DIR%" --port %PORT% --replSet %REPL_SET% --bind_ip 127.0.0.1 --logpath "%ROOT%.logs\mongod.log"

echo [tikgames] Waiting for mongod to accept connections...
set RETRIES=0
:wait_loop
call "%MONGOSH%" --quiet --port %PORT% --eval "db.runCommand({ ping: 1 })" >nul 2>nul
if not errorlevel 1 goto :ensure_replset
set /a RETRIES+=1
if %RETRIES% GEQ 30 (
  echo [tikgames] mongod did not become ready in time. Check .logs\mongod.log for errors.
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto :wait_loop

:ensure_replset
echo [tikgames] Ensuring single-node replica set is initialized...
call "%MONGOSH%" --quiet --port %PORT% --eval "try { rs.status(); print('[tikgames] Replica set already initialized.'); } catch (e) { rs.initiate(); print('[tikgames] Replica set initialized.'); }"

echo.
echo [tikgames] MongoDB is ready.
echo [tikgames] Connection string: mongodb://127.0.0.1:%PORT%/tikgames?replicaSet=%REPL_SET%
echo [tikgames] Data directory:    %DATA_DIR%
echo [tikgames] Running hidden in the background. Run stop.bat to stop it.
