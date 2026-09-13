# Fairy-DSH 打包脚本
#
# 把 5 个插件包打成 tgz，供 `dsh plugin --profile <名> add <文件>` 安装。
# 产出的 tgz 可直接上传到 GitHub Release，或直接发给群友。
#
#   .\pack.ps1                     打包全部，输出到 release\
#   .\pack.ps1 -OutDir D:\out      指定输出目录
#   .\pack.ps1 -SkipChecks         跳过自检（不推荐）
#
# 输出文件名一律【不带版本号】（dsh-fairy-visual.tgz 这种），直接就能上传 GitHub Release ——
# README / install.cmd 用的是 .../releases/latest/download/dsh-fairy-visual.tgz 这种永久地址，
# 而 latest/download 的文件名是照字面取的：带版本号则下次发版就 404。
# 各包的实际版本号会在打包结果表里列出来。
#
# 与旧的 build-release.ps1 的区别：
#   · 不再打 zip，不再预装 node_modules —— 依赖由 pnpm 在安装时自动补齐
#   · 不再需要 install.ps1 —— 官方 `dsh plugin add` 一条命令即可
#   · 理论依据见 docs\安装机制实测.md
[CmdletBinding()]
param(
  [string]$OutDir,
  [switch]$SkipChecks,
  # 兼容保留：0.3.0 起输出文件名一律不带版本号，此开关已无实际效果
  [switch]$ReleaseNames
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
  $ver  = (Get-Content (Join-Path $dir 'package.json') -Raw | ConvertFrom-Json).version
  Write-Host "     pack -> $name  (v$ver)" -ForegroundColor DarkGray
  Push-Location $dir
  try {
    $out = & pnpm pack --pack-destination $OutDir 2>&1
    if ($LASTEXITCODE -ne 0) { throw "pnpm pack 失败：$name`n$($out -join "`n")" }
  } finally { Pop-Location }

  # pnpm pack 天生产出「包名-版本.tgz」，这里统一定名成【不带版本号】的。
  # 原因：README / install.cmd 用的是 releases/latest/download/<包名>.tgz 这种永久地址，
  # 而 latest/download 的文件名是【照字面取】的 —— 带版本号则下次发版就 404。
  # 定名而不是复制，是为了不在输出目录里留一份内容相同、名字不同的副本（看着乱）。
  $produced = Get-ChildItem $OutDir -Filter "$name-*.tgz" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $produced) { throw "未找到产出物：$name" }
  $final = Join-Path $OutDir "$name.tgz"
  Move-Item -LiteralPath $produced.FullName -Destination $final -Force

  # 校验：tgz 里绝不能含 node_modules（那会让包变大且污染分发）
  $listing = & tar -tzf $final 2>$null
  if ($listing -match '/node_modules/') {
    Err "$name : 产出物里含 node_modules，已删除该文件"
    Remove-Item -LiteralPath $final -Force
    throw "打包结果不干净。"
  }

  $results += [PSCustomObject]@{
    '包名'   = $name
    '版本'   = $ver
    '文件'   = "$name.tgz"
    '字节'   = (Get-Item -LiteralPath $final).Length
    'SHA256' = (Get-FileHash -LiteralPath $final -Algorithm SHA256).Hash
  }
}

# install.cmd / install_full.cmd 也放进输出目录：群友在 Release 页只会看到一堆 tgz，不知道怎么办。
# 它们的永久地址 releases/latest/download/<文件名> 同样不带版本号，可长期引用。
# 两个都要传：README 里两个入口都给了链接，少传一个那个链接就会 404。
$installerFiles = @()
foreach ($f in @('install.cmd', 'install_full.cmd')) {
  $src = Join-Path $root $f
  if (Test-Path -LiteralPath $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $OutDir $f) -Force
    $installerFiles += $f
  } else {
    Warn "没找到 $f，输出目录里将没有它"
  }
}

# ---------- 汇总 ----------
$sums = Join-Path $OutDir 'SHA256SUMS.txt'
$sumLines = @($results | ForEach-Object { "$($_.SHA256)  $($_.文件)" })
foreach ($f in $installerFiles) {
  $sumLines += "$((Get-FileHash -LiteralPath (Join-Path $OutDir $f) -Algorithm SHA256).Hash)  $f"
}
$sumLines | Set-Content $sums -Encoding ascii

$total = ($results | Measure-Object -Property 字节 -Sum).Sum
$local = ($results | ForEach-Object { Join-Path $OutDir $_.文件 }) -join ' '

Write-Host ""
Write-Host "  打包完成" -ForegroundColor Magenta
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
# 用 Write-Host 手写表格而不是 Format-Table —— 后者一旦有人把本脚本的输出接进管道
# （例如 .\pack.ps1 | tee log.txt）就会抛 "FormatEntryData is not valid" 中断。
Write-Host ("    {0,-20} {1,-8} {2,10}" -f '包名', '版本', '字节') -ForegroundColor DarkGray
foreach ($r in $results) {
  Write-Host ("    {0,-20} {1,-8} {2,10}" -f $r.包名, $r.版本, "$([math]::Round($r.字节 / 1KB, 1)) KB") -ForegroundColor Gray
}
Ok "合计 $([math]::Round($total / 1KB, 1)) KB"
Ok "校验值已写入 $sums"
Write-Host ""
Write-Host "  本机安装测试：" -ForegroundColor White
Write-Host "    dsh plugin --profile web add $local" -ForegroundColor DarkGray
Write-Host ""
$fileCount = $results.Count + @($installerFiles).Count
Write-Host "  上传 GitHub Release —— 就这 $fileCount 个文件（都在 $OutDir）：" -ForegroundColor White
Write-Host "    install.cmd          （双击就能装，装 3 个安全插件）" -ForegroundColor DarkGray
Write-Host "    install_full.cmd     （完整版 5 个，装前会先讲风险并要确认）" -ForegroundColor DarkGray
foreach ($r in $results) { Write-Host "    $($r.文件)" -ForegroundColor DarkGray }
Write-Host ""
Write-Host "  传完后的永久地址（README 里用的就是这些，把 <用户名>/<仓库> 换掉）：" -ForegroundColor White
foreach ($r in $results) {
  Write-Host "    https://github.com/<用户名>/<仓库>/releases/latest/download/$($r.文件)" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "  ⚠️ 附件名必须原样用这些（不带版本号）。latest/download 的文件名是照字面取的，" -ForegroundColor Yellow
Write-Host "     带版本号的话提交当天有效，下次发版就 404。" -ForegroundColor Yellow
Write-Host ""
