# Fairy-DSH 打包脚本
#
# 把 5 个插件包打成 tgz，供 `dsh plugin --profile <名> add <文件>` 安装。
# 产出的 tgz 可直接上传到 GitHub Release，或直接发给群友。
#
#   .\pack.ps1                     打包全部，输出到 release\
#   .\pack.ps1 -OutDir D:\out      指定输出目录
#   .\pack.ps1 -SkipChecks         跳过自检（不推荐）
#
# 与旧的 build-release.ps1 的区别：
#   · 不再打 zip，不再预装 node_modules —— 依赖由 pnpm 在安装时自动补齐
#   · 不再需要 install.ps1 —— 官方 `dsh plugin add` 一条命令即可
#   · 理论依据见 docs\安装机制实测.md
[CmdletBinding()]
param(
  [string]$OutDir,
  [switch]$SkipChecks
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $OutDir) { $OutDir = Join-Path $root 'release' }

# 5 个插件包（顺序即输出顺序）
$Catalog = [ordered]@{
  visual  = @{ name = 'dsh-fairy-visual';  dir = 'fairy-visual\dsh-fairy-visual' }
  voice   = @{ name = 'dsh-fairy-voice';   dir = 'fairy-voice\dsh-fairy-voice' }
  balance = @{ name = 'dsh-balance-meter'; dir = 'balance-meter\dsh-balance-meter' }
  startup = @{ name = 'dsh-fairy-startup'; dir = 'fairy-startup\dsh-fairy-startup' }
  dock    = @{ name = 'dsh-browser-dock';  dir = 'browser-dock\dsh-browser-dock' }
}

function Step([string]$t) { Write-Host "-> $t" -ForegroundColor Cyan }
function Ok([string]$t)   { Write-Host "   $t" -ForegroundColor Green }
function Warn([string]$t) { Write-Host "   $t" -ForegroundColor Yellow }
function Err([string]$t)  { Write-Host "   $t" -ForegroundColor Red }

# ---------- 环境 ----------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "未找到 node。" }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "未找到 pnpm。" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Write-Host ""
Write-Host "  Fairy-DSH 打包" -ForegroundColor Magenta
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
Write-Host "  仓库根 : $root"
Write-Host "  输出到 : $OutDir"
Write-Host ""

# ---------- 自检：每个包是否具备「可独立安装」条件 ----------
if (-not $SkipChecks) {
  Step "[1/2] 自检各包是否可独立安装"
  $bad = @()
  foreach ($key in $Catalog.Keys) {
    $name = $Catalog[$key].name
    $dir  = Join-Path $root $Catalog[$key].dir
    $manifest = Join-Path $dir 'package.json'
    if (-not (Test-Path $manifest)) { $bad += "$name : 缺少 package.json"; continue }
    $j = Get-Content $manifest -Raw | ConvertFrom-Json

    if (-not $j.dsh.bundle.patch) { $bad += "$name : package.json 未声明 dsh.bundle.patch" }
    if (-not (Test-Path (Join-Path $dir 'cordis.patch.yml'))) { $bad += "$name : 缺少 cordis.patch.yml" }
    if (-not (Test-Path (Join-Path $dir 'vendor')))           { $bad += "$name : 缺少 vendor\（fairy-contracts 未内联）" }
    if ($j.dependencies.'dsh-fairy-contracts')                { $bad += "$name : 仍依赖 dsh-fairy-contracts（应已内联）" }
  }
  if ($bad.Count -gt 0) {
    Err "以下包不具备可独立安装条件，已中止："
    foreach ($b in $bad) { Err "  · $b" }
    throw "自检未通过。"
  }
  Ok "$($Catalog.Count) 个包全部就绪（vendor 已内联 / cordis.patch.yml 齐全 / 已声明 dsh.bundle.patch）"
} else {
  Warn "[1/2] 已跳过自检（-SkipChecks）"
}

# ---------- 打包 ----------
Step "[2/2] 打包"
$results = @()
foreach ($key in $Catalog.Keys) {
  $name = $Catalog[$key].name
  $dir  = Join-Path $root $Catalog[$key].dir
  Write-Host "     pack -> $name" -ForegroundColor DarkGray
  Push-Location $dir
  try {
    $out = & pnpm pack --pack-destination $OutDir 2>&1
    if ($LASTEXITCODE -ne 0) { throw "pnpm pack 失败：$name`n$($out -join "`n")" }
  } finally { Pop-Location }

  $tgz = Get-ChildItem $OutDir -Filter "$name-*.tgz" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $tgz) { throw "未找到产出物：$name" }

  # 校验：tgz 里绝不能含 node_modules（那会让包变大且污染分发）
  $listing = & tar -tzf $tgz.FullName 2>$null
  if ($listing -match '/node_modules/') {
    Err "$name : 产出物里含 node_modules，已删除该文件"
    Remove-Item $tgz.FullName -Force
    throw "打包结果不干净。"
  }

  $results += [PSCustomObject]@{
    '包名'   = $name
    '文件'   = $tgz.Name
    '字节'   = $tgz.Length
    'SHA256' = (Get-FileHash $tgz.FullName -Algorithm SHA256).Hash
  }
}

# ---------- 汇总 ----------
$sums = Join-Path $OutDir 'SHA256SUMS.txt'
$results | ForEach-Object { "$($_.SHA256)  $($_.文件)" } | Set-Content $sums -Encoding ascii

$total = ($results | Measure-Object -Property 字节 -Sum).Sum
$local = ($results | ForEach-Object { Join-Path $OutDir $_.文件 }) -join ' '

Write-Host ""
Write-Host "  打包完成" -ForegroundColor Magenta
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
$results | Select-Object '包名', '文件', '字节' | Format-Table -AutoSize
Ok "合计 $([math]::Round($total / 1KB, 1)) KB"
Ok "校验值已写入 $sums"
Write-Host ""
Write-Host "  本机安装测试：" -ForegroundColor White
Write-Host "    dsh plugin --profile web add $local" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  分发：把这 5 个 .tgz 上传到 GitHub Release，群友用 URL 一行装完。" -ForegroundColor Gray
Write-Host ""
