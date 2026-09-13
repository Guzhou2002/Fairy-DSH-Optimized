# Fairy-DSH 隔离验证脚本
#
# 在临时 DSH_HOME 里搭一套完全独立的 profile 并启动，验证插件能否正常加载。
# 全程不接触你现有的 $DSH_HOME\profiles\web。
#
#   .\verify-isolated.ps1                          默认验证 dsh-fairy-visual
#   .\verify-isolated.ps1 -Plugins visual,voice    一起验证语音插件
#   .\verify-isolated.ps1 -Port 3181               指定端口
#   .\verify-isolated.ps1 -Keep                    保留临时目录与截图便于排查
#   .\verify-isolated.ps1 -Yes                     跳过确认
#
# 直接双击本目录里的 verify.cmd 也能用。
[CmdletBinding()]
param(
  # 不传时（双击运行时）会给出按数字键的菜单
  [string[]]$Plugins = @(),
  [int]$Port = 3180,
  [switch]$Keep,
  [string]$ChromePath,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 可验证的插件（与 install.ps1 的 key 一致）
$Catalog = [ordered]@{
  visual  = @{ name = 'dsh-fairy-visual';  dir = 'fairy-visual\dsh-fairy-visual' }
  balance = @{ name = 'dsh-balance-meter'; dir = 'balance-meter\dsh-balance-meter' }
  startup = @{ name = 'dsh-fairy-startup'; dir = 'fairy-startup\dsh-fairy-startup' }
  voice   = @{ name = 'dsh-fairy-voice';   dir = 'fairy-voice\dsh-fairy-voice' }
  dock    = @{ name = 'dsh-browser-dock';  dir = 'browser-dock\dsh-browser-dock' }
}
$Plugins = @($Plugins | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })

$script:Interactive = $true
try { $script:Interactive = -not [Console]::IsInputRedirected -and [Environment]::UserInteractive } catch { $script:Interactive = $false }
if ($Yes) { $script:Interactive = $false }

# 读一个按键（不回显，自己回显）；非交互环境返回 $null
function Read-OneKey([string]$ValidChars) {
  try {
    while ($true) {
      $k = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
      if ($k.VirtualKeyCode -eq 27) { Write-Host ''; return 'ESC' }
      if ($k.VirtualKeyCode -eq 13) { Write-Host ''; return 'ENTER' }
      $c = [string]$k.Character
      if ($c -and $c.Length -eq 1 -and $ValidChars.Contains($c)) { Write-Host $c -NoNewline; return $c }
    }
  } catch {
    return $null
  }
}

# 不传 -Plugins 时给出菜单
if ($Plugins.Count -eq 0) {
  if ($script:Interactive) {
    Write-Host ""
    Write-Host "  Fairy-DSH 隔离验证" -ForegroundColor Magenta
    Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  请选择要验证的内容（按数字键）：" -ForegroundColor White
    Write-Host "    1) 只验证核心 UI          dsh-fairy-visual"
    Write-Host "    2) 验证 UI + 语音朗读      dsh-fairy-visual, dsh-fairy-voice"
    Write-Host "    3) 全部 5 个插件"
    Write-Host "    0) 退出"
    Write-Host ""
    Write-Host "  你的选择: " -NoNewline -ForegroundColor Yellow
    $k = Read-OneKey '0123'
    if ($null -eq $k -or $k -eq '0' -or $k -eq 'ESC') {
      Write-Host ""
      Write-Host "  已取消。" -ForegroundColor Yellow
      Write-Host ""
      try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { }
      exit 0
    }
    switch ($k) {
      '1' { $Plugins = @('visual') }
      '2' { $Plugins = @('visual', 'voice') }
      '3' { $Plugins = @($Catalog.Keys) }
    }
    Write-Host ""
  } else {
    $Plugins = @('visual')
  }
}

if ($Plugins -contains 'all') { $Plugins = @($Catalog.Keys) }
$unknown = @($Plugins | Where-Object { -not $Catalog.Contains($_) })
if ($unknown.Count -gt 0) { throw "未知插件：$($unknown -join ', ')（可用：$($Catalog.Keys -join ' / ') / all）" }
$Plugins = @($Catalog.Keys | Where-Object { $Plugins -contains $_ })
# voice 的输入区控制器依赖 fairy-visual 的 HDD 模式，自动带上
if (($Plugins -contains 'voice') -and ($Plugins -notcontains 'visual')) { $Plugins = @('visual') + $Plugins }

function Wait-AnyKey([string]$Message) {
  if (-not $script:Interactive) { return }
  Write-Host ""
  Write-Host $Message -ForegroundColor DarkGray
  try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { }
}
function Step([string]$Text) { Write-Host "-> $Text" -ForegroundColor Cyan }
function Ok([string]$Text) { Write-Host "   $Text" -ForegroundColor Green }
function Warn([string]$Text) { Write-Host "   $Text" -ForegroundColor Yellow }

# ---------- 自动定位 Chrome / Edge ----------
function Find-Chrome {
  param([string]$Explicit)
  if ($Explicit -and (Test-Path -LiteralPath $Explicit)) { return $Explicit }
  if ($env:CHROME_PATH -and (Test-Path -LiteralPath $env:CHROME_PATH)) { return $env:CHROME_PATH }
  $cands = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  )
  foreach ($c in $cands) { if ($c -and (Test-Path -LiteralPath $c)) { return $c } }
  foreach ($k in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe',
                 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe',
                 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe') {
    try {
      $v = (Get-ItemProperty -Path $k -ErrorAction Stop).'(default)'
      if ($v -and (Test-Path -LiteralPath $v)) { return $v }
    } catch { }
  }
  return $null
}

$chrome = Find-Chrome $ChromePath
if (-not $chrome) { throw "找不到 Chrome 或 Edge，请用 -ChromePath 指定，或设置 CHROME_PATH 环境变量。" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "未找到 node。" }

$probe = Join-Path $root 'tools\dom-probe.mjs'
if (-not (Test-Path $probe)) { throw "缺少探针脚本：$probe" }
foreach ($key in $Plugins) {
  $dir = Join-Path $root $Catalog[$key].dir
  if (-not (Test-Path (Join-Path $dir 'package.json'))) { throw "缺少插件包：$dir" }
}

# ---------- 准备临时环境 ----------
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$work = Join-Path $env:TEMP "fairy-verify-$stamp"
$isoHome = Join-Path $work 'home'
$profileName = 'fairyverify'
$profileDir = Join-Path $isoHome "profiles\$profileName"
$bootLog = Join-Path $work 'boot.log'

Write-Host ""
Write-Host "  Fairy-DSH 隔离验证" -ForegroundColor Magenta
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
Write-Host "  临时 DSH_HOME : $isoHome"
Write-Host "  验证插件      : $(($Plugins | ForEach-Object { $Catalog[$_].name }) -join ', ')"
Write-Host "  浏览器        : $chrome"
Write-Host "  端口          : $Port"
Write-Host ""
Write-Host "  该脚本不会修改你的 profile，结束后自动清理临时目录。" -ForegroundColor DarkGray
Write-Host ""
if (-not $Yes) {
  Write-Host "  按任意键开始验证，Ctrl+C 取消 ..." -ForegroundColor Yellow
  try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { }
  Write-Host ""
}

$code = 1
try {
  # 1) 最小 profile：官方 base + web-app。
  #    [fix] 这里【不再】手写 insert 补丁：每个插件包自带 dsh.bundle.patch，
  #    下面第 3 步的 `dsh plugin add` 会把包名写进 package.json 的 dsh.profile.bundles，
  #    loader 会自动展开它。再手写一遍 insert 会撞 duplicate loader entry id: <插件名>，
  #    隔离实例直接起不来（这正是 v0.3.3 之前本脚本失效的原因）。
  New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
  @'
{
  "name": "dsh-profile-fairyverify",
  "private": true,
  "dependencies": {},
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"] } }
}
'@ | Set-Content (Join-Path $profileDir 'package.json') -Encoding ascii
  '[]' | Set-Content (Join-Path $profileDir 'cordis.yml') -Encoding ascii
  '[]' | Set-Content (Join-Path $profileDir 'cordis.patch.yml') -Encoding ascii

  # 2) 依赖（发布包不带 node_modules，这里按需补齐）
  $needDeps = @($Plugins | Where-Object { -not (Test-Path (Join-Path (Join-Path $root $Catalog[$_].dir) 'node_modules')) })
  if ($needDeps.Count -gt 0) {
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "插件缺少 node_modules 且未找到 pnpm，请先执行 pnpm install。" }
    Step "[1/5] 安装插件依赖（需要网络）"
    foreach ($key in $needDeps) {
      Push-Location (Join-Path $root $Catalog[$key].dir)
      try {
        & pnpm install --prod --ignore-scripts | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "pnpm install 失败：$key" }
      } finally { Pop-Location }
    }
    Ok "依赖就绪"
  } else {
    Step "[1/5] 插件依赖已就绪"
  }

  # 3) 链入并打开 HDD 开关（voice 的输入区控制器依赖它）
  Step "[2/5] 建立隔离 profile"
  $env:DSH_HOME = $isoHome
  $links = @($Plugins | ForEach-Object { "link:$(Join-Path $root $Catalog[$_].dir)" })
  & dsh plugin --profile $profileName add @links | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "dsh plugin add 失败" }
  @'
fairy-visual:
  enabled: true
  theme: dark
'@ | Set-Content (Join-Path $isoHome 'settings.yaml') -Encoding ascii
  Ok "profile 就绪（$($Plugins.Count) 个插件）"

  # 4) 启动隔离实例
  Step "[3/5] 启动隔离实例（端口 $Port）"
  $cmdLine = "set DSH_HOME=$isoHome&& dsh --profile $profileName --no-open --port $Port > `"$bootLog`" 2>&1"
  $proc = Start-Process -FilePath 'cmd.exe' -PassThru -WindowStyle Hidden -ArgumentList @('/c', $cmdLine)

  try {
    $url = $null
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Milliseconds 750
      if (Test-Path $bootLog) {
        $m = Select-String -Path $bootLog -Pattern 'dsh web: (http://\S+)' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($m) { $url = $m.Matches[0].Groups[1].Value; break }
      }
    }
    if (-not $url) { throw "实例未在 45 秒内就绪，日志：`n$(Get-Content $bootLog -Raw -ErrorAction SilentlyContinue)" }
    Ok "已就绪：$url"

    $hostLog = @(Get-Content $bootLog -ErrorAction SilentlyContinue | Where-Object { $_ -match 'DSH_FAIRY_LOG' })
    if ($hostLog.Count -gt 0) {
      Write-Host "   宿主侧日志：" -ForegroundColor DarkGray
      $hostLog | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkGray }
    }

    # 5) 无头浏览器探针
    Step "[4/5] 运行 DOM 探针"
    $env:CHROME_PATH = $chrome
    $shot = Join-Path $work 'ui.png'
    & node $probe $url --shot $shot
    $probeExit = $LASTEXITCODE
    Step "[5/5] 结果"
    Ok "探针退出码：$probeExit"
    if ($probeExit -eq 0) { Ok "截图：$shot" } else { Warn "截图：$shot" }
    if ($Keep) { Ok "临时目录已保留：$work" }
    # 归一化：任何非 0（含 -1）都按失败处理
    if ($probeExit -eq 0) { $code = 0 } else { $code = 1 }
  }
  finally {
    if ($proc -and -not $proc.HasExited) { & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null }
    $stale = @(Get-Process node -ErrorAction SilentlyContinue |
      Where-Object { $_.Id -ne $PID -and $_.StartTime -gt (Get-Date).AddMinutes(-15) } |
      Where-Object { @(Get-NetTCPConnection -State Listen -OwningProcess $_.Id -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq $Port }).Count -gt 0 })
    foreach ($p in $stale) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  }
}
catch {
  Write-Host ""
  Write-Host "  [失败] $($_.Exception.Message)" -ForegroundColor Red
  $code = 1
}
finally {
  if (-not $Keep -and (Test-Path $work)) { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
}

Write-Host ""
Wait-AnyKey "按任意键退出 ..."
exit $code
