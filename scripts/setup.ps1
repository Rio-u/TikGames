<#
  TikGames — تثبيت وتشغيل كامل من الصفر على ويندوز.

  بيتنده من setup.bat (اللي بيظبط ترميز الكونسول). قاعدة البيانات بقت Supabase (Postgres)
  على السحابة — مفيش داتا بيز محلية تتثبت أو تتشغّل خالص، بس محتاج DATABASE_URL يبقى مظبوط.

  بيعمل بالترتيب: يتأكد من Node و pnpm (وينزّلهم بـ winget لو ناقصين) ثم pnpm install ثم
  ينسخ ملفات .env ثم يتأكد إن DATABASE_URL متظبط على Supabase ثم prisma db push ثم seed
  (الحسابات + الخلفيات) ثم يشغّل الأربع خدمات ثم يفتح المتصفح.

  كل خطوة idempotent: لو حاجة متظبطة أصلاً بيعدّيها، فتشغيله تاني مفيهوش ضرر.
#>

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root ".logs"
$StepNum = 0

function Write-Step([string]$Message) {
    $script:StepNum++
    Write-Host ""
    Write-Host "[$script:StepNum/9] $Message" -ForegroundColor Cyan
}
function Write-Ok([string]$Message)   { Write-Host "      [تمام] $Message" -ForegroundColor Green }
function Write-Info([string]$Message) { Write-Host "      $Message" -ForegroundColor Gray }
function Write-Warn([string]$Message) { Write-Host "      [تنبيه] $Message" -ForegroundColor Yellow }

function Fail([string]$Message) {
    Write-Host ""
    Write-Host "  [فشل] $Message" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# winget بيكتب الـ PATH الجديد في الريجستري بس العملية الشغالة دلوقتي عمرها ما هتشوفه —
# لازم نعيد قراءته بنفسنا بعد كل تثبيت، وإلا التثبيت ينجح والأمر بعده يقول "مش موجود".
function Sync-Path {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ";"
}

function Test-Cmd([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Winget([string]$Id, [string]$Label) {
    Write-Info "بنزّل $Label عن طريق winget... (ممكن ياخد شوية)"
    # --silent عشان ما يقفش على واجهة رسومية، و accept-* عشان ما يستناش موافقة تفاعلية.
    & winget install --id $Id --exact --source winget --silent --accept-package-agreements --accept-source-agreements | Out-Null
    # winget بيرجّع أكواد نجاح كتير (0، و -1978335189 = متثبت أصلاً). ما نعتمدش عليه —
    # نتحقق من الأداة نفسها بعد ما نعيد قراءة الـ PATH.
    Sync-Path
}

Write-Host ""
Write-Host "  ==================================================" -ForegroundColor Magenta
Write-Host "     TikGames — تثبيت وتشغيل كامل" -ForegroundColor Magenta
Write-Host "  ==================================================" -ForegroundColor Magenta
Write-Host "     المجلد: $Root" -ForegroundColor DarkGray

# ---------------------------------------------------------------- 1. winget
Write-Step "بنتأكد إن winget موجود (ده اللي بينزّل باقي البرامج)"
if (-not (Test-Cmd "winget")) {
    Fail @"
winget مش موجود على الجهاز ده.
   نزّل "App Installer" من متجر مايكروسوفت وبعدين شغّل setup.bat تاني:
   https://apps.microsoft.com/detail/9nblggh4nns1

   أو نزّل Node.js LTS بإيدك وبعدين شغّل setup.bat تاني:
     Node.js LTS  ->  https://nodejs.org
"@
}
Write-Ok "winget موجود"

# ---------------------------------------------------------------- 2. Node.js
Write-Step "بنتأكد من Node.js (لازم إصدار 20 أو أحدث)"
$nodeOk = $false
if (Test-Cmd "node") {
    $nodeVersion = (& node -v) -replace "^v", ""
    $nodeMajor = [int]($nodeVersion -split "\.")[0]
    if ($nodeMajor -ge 20) {
        Write-Ok "Node.js v$nodeVersion"
        $nodeOk = $true
    } else {
        Write-Warn "Node.js v$nodeVersion قديم — محتاجين 20 أو أحدث"
    }
}
if (-not $nodeOk) {
    Invoke-Winget "OpenJS.NodeJS.LTS" "Node.js LTS"
    if (-not (Test-Cmd "node")) {
        Fail "Node.js اتنزّل بس لسه مش ظاهر. اقفل الشباك ده وافتح setup.bat تاني — غالباً هيشتغل."
    }
    $nodeVersion = (& node -v) -replace "^v", ""
    if ([int]($nodeVersion -split "\.")[0] -lt 20) { Fail "Node.js v$nodeVersion — محتاجين 20 أو أحدث." }
    Write-Ok "Node.js v$nodeVersion"
}

# ---------------------------------------------------------------- 3. pnpm
Write-Step "بنتأكد من pnpm (مدير الحزم بتاع المشروع)"
if (Test-Cmd "pnpm") {
    Write-Ok "pnpm v$(& pnpm -v)"
} else {
    Write-Info "بنثبّت pnpm..."
    & npm install -g pnpm@10.33.0 2>&1 | Out-Null
    Sync-Path
    if (-not (Test-Cmd "pnpm")) {
        # npm بيحط الحزم العامة في مسار مش دايماً بيبقى في الـ PATH لحد ما الجلسة تترستارت.
        $npmGlobal = Join-Path $env:APPDATA "npm"
        if (Test-Path (Join-Path $npmGlobal "pnpm.cmd")) {
            $env:Path = "$npmGlobal;$env:Path"
        }
    }
    if (-not (Test-Cmd "pnpm")) { Fail "تثبيت pnpm فشل. جرّب تشغّل بإيدك: npm install -g pnpm@10.33.0" }
    Write-Ok "pnpm v$(& pnpm -v)"
}

# ---------------------------------------------------------------- 4. الحزم
Write-Step "بنثبّت حزم المشروع (pnpm install) — أطول خطوة، استنى"
# الأوامر الجاية بتعدّي على cmd عن قصد: PowerShell 5.1 بيلفّ أي سطر بيطلع على stderr من
# برنامج خارجي في NativeCommandError أحمر مخيف، حتى لو البرنامج نجح — و prisma بيكتب
# "Environment variables loaded from .env" على stderr في كل مرة. الـ 2>&1 جوه cmd بيدمج
# المسارين قبل ما PowerShell يشوفهم، فالمستخدم يشوف الكلام عادي مش error.

Push-Location $Root
try {
    & cmd /c "pnpm install 2>&1"
    if ($LASTEXITCODE -ne 0) { Fail "pnpm install فشل. شوف الرسالة اللي فوق." }
} finally { Pop-Location }
Write-Ok "الحزم اتثبتت"

# ---------------------------------------------------------------- 5. ملفات .env
Write-Step "بنجهّز ملفات .env"
$envDirs = @(
    "apps\api",
    "apps\dashboard",
    "apps\overlay",
    "apps\tiktok-connector",
    "packages\database"
)
$copied = 0
foreach ($rel in $envDirs) {
    $target = Join-Path $Root "$rel\.env"
    $sample = Join-Path $Root "$rel\.env.example"
    if (Test-Path $target) { continue }
    if (-not (Test-Path $sample)) { Fail "ناقص $rel\.env.example — النسخة اللي عندك من المشروع مش كاملة." }
    Copy-Item $sample $target
    $copied++
}
if ($copied -gt 0) { Write-Ok "اتنسخ $copied ملف .env من .env.example" }
else { Write-Ok "ملفات .env موجودة أصلاً — سبناها زي ما هي" }

# ---------------------------------------------------------------- 6. DATABASE_URL
Write-Step "بنتأكد إن DATABASE_URL متظبط على Supabase"
# مفيش داتا بيز محلية — الاتنين (التطوير والنشر) بيستعملوا نفس مشروع Supabase على السحابة.
# لازم DATABASE_URL يبقى فيه رابط الاتصال الحقيقي، مش الـ placeholder اللي جاي مع .env.example.
$dbEnvFiles = @(
    (Join-Path $Root "packages\database\.env"),
    (Join-Path $Root "apps\api\.env")
)
$dbUrl = $null
foreach ($f in $dbEnvFiles) {
    if (-not (Test-Path $f)) { continue }
    $line = Get-Content $f | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if ($line) {
        $dbUrl = ($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"')
        break
    }
}
$placeholder = ($null -eq $dbUrl) -or ($dbUrl -eq "") -or ($dbUrl -match '\[PASSWORD\]') -or ($dbUrl -match '\[PROJECT-REF\]')
if ($placeholder) {
    Fail @"
DATABASE_URL لسه مش متظبط.
   قاعدة البيانات دلوقتي Supabase (Postgres) على السحابة — مفيش حاجة تتثبت محلياً.
   افتح مشروعك على https://supabase.com  ->  Project  ->  Connect  ->  ORM / Prisma
   وانسخ رابط الـ "Direct connection" (بورت 5432) وحطّه في الملفين دول:
     packages\database\.env
     apps\api\.env
   بالشكل ده:
     DATABASE_URL="postgresql://postgres:كلمة-السر@db.xxxx.supabase.co:5432/postgres"
   وبعدين شغّل setup.bat تاني.
"@
}
Write-Ok "DATABASE_URL متظبط"

# ---------------------------------------------------------------- 7. قاعدة البيانات
Write-Step "بنجهّز قاعدة البيانات (prisma db push)"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Push-Location $Root
try {
    & cmd /c "pnpm db:push 2>&1"
    if ($LASTEXITCODE -ne 0) { Fail "prisma db push فشل. اتأكد إن DATABASE_URL بتاع Supabase صح ونت شغال." }
} finally { Pop-Location }
Write-Ok "قاعدة البيانات متطابقة مع الـ schema"

# ---------------------------------------------------------------- 8. الحسابات والخلفيات
Write-Step "بنعمل الحسابات ونزرع خلفيات الألعاب"
Push-Location (Join-Path $Root "apps\api")
try {
    & cmd /c "node seed.mjs 2>&1"
    if ($LASTEXITCODE -ne 0) { Fail "الـ seed فشل." }
} finally { Pop-Location }

# ---------------------------------------------------------------- 9. تشغيل
Write-Step "بنشغّل الخدمات الأربعة"
function Start-Bg([string]$Filter, [string]$LogName) {
    Start-Process -FilePath "cmd.exe" -WindowStyle Hidden -WorkingDirectory $Root -ArgumentList "/c pnpm --filter $Filter dev > `".logs\$LogName.log`" 2>&1"
}

# لو فيه نسخة قديمة لسه ماسكة البورتات، vite و express هيقعوا بـ EADDRINUSE. نقفلهم الأول.
$busy = Get-NetTCPConnection -LocalPort 4000, 5173, 5174 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($p in $busy) {
    Write-Info "بنقفل نسخة قديمة شغالة (PID $p)"
    Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
}
if ($busy) { Start-Sleep -Seconds 2 }

Start-Bg "@tikgames/api" "api"
Start-Bg "@tikgames/tiktok-connector" "connector"
Start-Bg "@tikgames/dashboard" "dashboard"
Start-Bg "@tikgames/overlay" "overlay"

Write-Info "بنستنى الخدمات تقوم..."
$apiUp = $false
foreach ($i in 1..90) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:4000/health" -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) { $apiUp = $true; break }
    } catch { }
}
if (-not $apiUp) { Fail "الـ API ما ردّش. شوف .logs\api.log" }
Write-Ok "الـ API شغال"

$webUp = $false
foreach ($i in 1..90) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5173/" -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) { $webUp = $true; break }
    } catch { }
    Start-Sleep -Seconds 1
}
if (-not $webUp) { Fail "الداشبورد ما ردّش. شوف .logs\dashboard.log" }
Write-Ok "الداشبورد شغال"

Write-Host ""
Write-Host "  ==================================================" -ForegroundColor Green
Write-Host "     TikGames شغال" -ForegroundColor Green
Write-Host "  ==================================================" -ForegroundColor Green
Write-Host "     الداشبورد : http://localhost:5173" -ForegroundColor White
Write-Host "     الأوفرلاي  : http://localhost:5174   (للـ OBS)" -ForegroundColor White
Write-Host "     الـ API    : http://localhost:4000/health" -ForegroundColor White
Write-Host ""
Write-Host "     تسجيل الدخول بالإيميل (مش باليوزرنيم):" -ForegroundColor White
Write-Host "       حسابك   : nfnf@tikgames.local  / 123456789" -ForegroundColor Yellow
Write-Host "       الأدمن   : d7@tikgames.local    / 123456789   ->  /d7admind7" -ForegroundColor Yellow
Write-Host ""
Write-Host "     الاتنين اشتراكهم دائم — مفيش حد للألعاب." -ForegroundColor DarkGray
Write-Host "     عايز تلعب من غير تيك توك حقيقي؟ ابدأ لايف بأي اسم قناة،" -ForegroundColor DarkGray
Write-Host "     وبعدين افتح /live/simulate وابعت كومنتات وهمية." -ForegroundColor DarkGray
Write-Host ""
Write-Host "     اللوجات : .logs\    |    للإيقاف : stop.bat" -ForegroundColor DarkGray
Write-Host "  ==================================================" -ForegroundColor Green
Write-Host ""

Start-Process "http://localhost:5173"
