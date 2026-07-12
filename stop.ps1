Write-Host "[tikgames] Stopping TikGames services..."

$ports = 4000, 5173, 5174, 27018
$procIds = Get-NetTCPConnection -LocalPort $ports -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

foreach ($procId in $procIds) {
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}

# Port-based lookup misses a process that's alive but no longer actually listening
# (observed with tsx watch after a crash/reload) — also match by command line as a fallback.
$patterns = "tiktok-connector", "apps\api", "apps\dashboard", "apps\overlay"
Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='mongod.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
        $cmd = $_.CommandLine
        $cmd -and ($patterns | Where-Object { $cmd -like "*$_*" })
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Write-Host "[tikgames] Stopped."
