# Fairy-DSH 发布打包脚本
#
# 生成可分发的 zip（默认不含 node_modules，安装时由 install.ps1 自动补齐依赖）。
#
#   .\build-release.ps1                      生成 ..\Fairy-DSH-v<版本>-一键安装版.zip
#   .\build-release.ps1 -Version 0.2.0       指定版本号
#   .\build-release.ps1 -IncludeDeps         生成自带依赖的离线自包含版
#   .\build-release.ps1 -OutDir D:\release   指定输出目录
#   .\build-release.ps1 -KeepStaging         保留暂存目录便于检查
[CmdletBinding()]
param(
  [string]$Version = '0.2.3',
  [string]$OutDir,
  [switch]$IncludeDeps,
  [switch]$KeepStaging
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $OutDir) { $OutDir = Join-Path $root 'release' }

$suffix = if ($IncludeDeps) { '-一键部署版-含依赖' } else { '-一键安装版' }
$zipName = "Fairy-DSH-v$Version$suffix.zip"
$staging = Join-Path $env:TEMP "fairy-release-$Version-$(Get-Date -Format 'HHmmss')"
$stageRoot = Join-Path $staging 'Fairy-DSH'

Write-Host ""
Write-Host "  Fairy-DSH 发布打包" -ForegroundColor Magenta
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
Write-Host "  版本      : v$Version$suffix"
Write-Host "  源目录    : $root"
Write-Host "  暂存目录  : $stageRoot"
Write-Host "  输出      : $(Join-Path $OutDir $zipName)"
if ($IncludeDeps) { Write-Host "  含依赖    : 是（离线自包含）" } else { Write-Host "  含依赖    : 否（安装时联网拉取）" }
Write-Host ""

# 不进入发布包的东西
$excludeDirs = @('_install-logs', 'dist', '.git', 'node_modules', 'snapshots', '_scrtest')
$excludePatterns = @('fairy-backup-*', '*.zip', '*.sha256', '*.log', '*.bak')

$script:copied = 0
$script:skipped = 0

function Copy-Tree([string]$From, [string]$To) {
  New-Item -ItemType Directory -Force -Path $To | Out-Null
  foreach ($item in Get-ChildItem -LiteralPath $From -Force) {
    if ($item.PSIsContainer) {
      if ($excludeDirs -contains $item.Name) { $script:skipped++; continue }
      Copy-Tree $item.FullName (Join-Path $To $item.Name)
    } else {
      $skip = $false
      foreach ($p in $excludePatterns) { if ($item.Name -like $p) { $skip = $true; break } }
      if ($skip) { $script:skipped++; continue }
      Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $To $item.Name) -Force
      $script:copied++
    }
  }
}

Write-Host "-> [1/4] 复制文件到暂存目录" -ForegroundColor Cyan
Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
Copy-Tree $root $stageRoot

# node_modules 只在 -IncludeDeps 时补齐（逐个插件包单独拷）
if ($IncludeDeps) {
  foreach ($pkgDir in @('fairy-visual\dsh-fairy-visual', 'balance-meter\dsh-balance-meter',
                        'browser-dock\dsh-browser-dock', 'fairy-startup\dsh-fairy-startup',
                        'fairy-voice\dsh-fairy-voice', 'fairy-contracts')) {
    $src = Join-Path (Join-Path $root $pkgDir) 'node_modules'
    $dst = Join-Path (Join-Path $stageRoot $pkgDir) 'node_modules'
    if (Test-Path -LiteralPath $src) {
      Write-Host "     附带依赖: $pkgDir" -ForegroundColor DarkGray
      Copy-Tree $src $dst
    }
  }
}
Write-Host "     文件 $($script:copied) 个，跳过 $($script:skipped) 项" -ForegroundColor DarkGray

Write-Host "-> [2/4] 统计体积" -ForegroundColor Cyan
$files = Get-ChildItem $stageRoot -Recurse -File -Force
$totalMb = [math]::Round(($files | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
Write-Host "     $($files.Count) 个文件 / $totalMb MB" -ForegroundColor DarkGray

Write-Host "-> [3/4] 生成 zip" -ForegroundColor Cyan
$zipPath = Join-Path $OutDir $zipName
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $staging, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
if (-not (Test-Path -LiteralPath $zipPath)) { throw "打包失败：$zipPath" }

Write-Host "-> [4/4] 计算校验值" -ForegroundColor Cyan
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
$hashFile = "$zipPath.sha256"
[System.IO.File]::WriteAllText($hashFile, "$hash  $zipName`r`n", (New-Object System.Text.UTF8Encoding($false)))
Write-Host "     SHA256: $hash" -ForegroundColor DarkGray

if (-not $KeepStaging) { Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue }

$zipMb = [math]::Round((Get-Item -LiteralPath $zipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "  [完成] 发布包已生成" -ForegroundColor Green
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
Write-Host "  包文件  : $zipPath  ($zipMb MB)"
Write-Host "  校验文件: $hashFile"
if ($KeepStaging) { Write-Host "  暂存目录: $staging" }
Write-Host ""

exit 0
