# Fairy-DSH 卸载脚本（适配 0.3.0 起的 tgz / dsh plugin add 分发形态）
#
#   .\uninstall.ps1                 卸载 Fairy 相关插件 + 人设预设目录
#   .\uninstall.ps1 -Profile web    指定 profile（默认 web）
#   .\uninstall.ps1 -CleanBundle    额外删除 package.json 里 dsh.profile.bundles 的残留条目
#   .\uninstall.ps1 -Yes            跳过确认
#
# 插件源码不会被删除，可随时重新安装。
# 每一步开始前都会把 package.json / cordis.patch.yml 备份到 profile 下的 fairy-backup-<时间戳>\
[CmdletBinding()]
param(
  [string]$Profile = 'web',
  [string]$DshHome,
  [switch]$CleanBundle,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'

# 受管的五个插件包名
$FairyPkgs = @(
  'dsh-fairy-visual',
  'dsh-fairy-voice',
  'dsh-balance-meter',
  'dsh-fairy-startup',
  'dsh-browser-dock'
)

if (-not $DshHome) {
  $DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
}
$profileDir = Join-Path $DshHome "profiles\$Profile"
$pkgJson    = Join-Path $profileDir 'package.json'
$patchFile  = Join-Path $profileDir 'cordis.patch.yml'
$presetDir  = Join-Path $DshHome '.agent-presets\fairy'

function Step([string]$Text) { Write-Host "-> $Text" -ForegroundColor Cyan }
function Ok([string]$Text)   { Write-Host "   $Text" -ForegroundColor Green }
function Warn([string]$Text) { Write-Host "   $Text" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  Fairy-DSH 卸载程序" -ForegroundColor Magenta
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
Write-Host "  目标 profile: $profileDir"
Write-Host "  插件源码不会被删除，可随时重新安装。"
Write-Host ""

if (-not (Test-Path $pkgJson)) {
  throw "找不到 $pkgJson（profile 名或 DSH_HOME 是否正确？）"
}

if (-not $Yes) {
  Write-Host "  按任意键开始卸载，Ctrl+C 取消 ..." -ForegroundColor Yellow
  try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { }
  Write-Host ""
}

# ---- [1/6] 备份 ----
Step "[1/6] 备份 profile 配置"
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $profileDir "fairy-backup-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $pkgJson $backupDir -Force
if (Test-Path $patchFile) { Copy-Item $patchFile $backupDir -Force }
Ok "已备份到 $backupDir"

# ---- [2/6] 只挑出真正装了的包 ----
# pnpm remove 只要收到一个不存在的包名就会整体失败，所以必须先过滤
Step "[2/6] 检查已安装的 Fairy 插件"
$installed = @()
$parsed = $false
try {
  $pkgObj = Get-Content $pkgJson -Raw -Encoding UTF8 | ConvertFrom-Json
  $parsed = $true
  if ($pkgObj.dependencies) {
    $names = @($pkgObj.dependencies.PSObject.Properties | ForEach-Object { $_.Name })
    $installed = @($FairyPkgs | Where-Object { $names -contains $_ })
  }
} catch {
  Warn "无法解析 package.json：$($_.Exception.Message)"
  Warn "为安全起见跳过依赖移除，请手动检查 $pkgJson"
}
if (-not $parsed) {
  Warn "跳过 [3/6]"
} elseif ($installed.Count -eq 0) {
  Warn "profile 里没有 Fairy 相关依赖"
} else {
  Ok "发现 $($installed.Count) 个：$($installed -join ', ')"
}

# ---- [3/6] 解除依赖 ----
Step "[3/6] 解除 profile 依赖（dsh plugin remove）"
if (-not $parsed -or $installed.Count -eq 0) {
  Warn "跳过"
} else {
  $env:DSH_HOME = $DshHome
  & dsh plugin --profile $Profile remove @installed
  if ($LASTEXITCODE -ne 0) {
    Warn "dsh plugin remove 返回 $LASTEXITCODE，请手动检查 $pkgJson"
  } else {
    Ok "已移除 $($installed.Count) 个依赖"
  }
}

# ---- [4/6] 清旧受管块（兼容 0.2.x 遗留）----
Step "[4/6] 移除 cordis.patch.yml 的旧受管块"
$beginMarker = '# >>> Fairy-DSH managed block'
$endMarker   = '# <<< Fairy-DSH managed block'
if (Test-Path $patchFile) {
  $bytes = [System.IO.File]::ReadAllBytes($patchFile)
  $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  $offset = 0
  if ($hasBom) { $offset = 3 }
  $text = [System.Text.Encoding]::UTF8.GetString($bytes, $offset, $bytes.Length - $offset)
  if ($text -match [regex]::Escape($beginMarker)) {
    $pattern = '(?ms)^' + [regex]::Escape($beginMarker) + '.*?^' + [regex]::Escape($endMarker) + '\r?\n?'
    $cleaned = [regex]::Replace($text, $pattern, '')
    [System.IO.File]::WriteAllText($patchFile, $cleaned, (New-Object System.Text.UTF8Encoding($hasBom)))
    Ok "已移除受管块"
  } else {
    Warn "未发现受管块，跳过"
  }
} else {
  Warn "没有 $patchFile，跳过"
}

# ---- [5/6] 扫 bundle 残留 ----
Step "[5/6] 检查 dsh 配置里的包名残留"
$hits = @()
$allLines = @(Get-Content $pkgJson)
for ($i = 0; $i -lt $allLines.Count; $i++) {
  foreach ($p in $FairyPkgs) {
    if ($allLines[$i] -like "*$p*") {
      $hits += [pscustomobject]@{ Line = ($i + 1); Text = $allLines[$i].Trim() }
      break
    }
  }
}
if ($hits.Count -eq 0) {
  Ok "干净，package.json 里没有残留"
} else {
  Warn "发现 $($hits.Count) 处残留（前面没删干净）："
  foreach ($h in $hits) {
    Write-Host ("     L{0}: {1}" -f $h.Line, $h.Text) -ForegroundColor DarkYellow
  }
  if (-not $CleanBundle) {
    Warn "没有自动修改。确认要删这些行，就加 -CleanBundle 重跑（已备份）"
  } else {
    $dropLines = @($hits | ForEach-Object { $_.Line })
    $kept = @()
    for ($i = 0; $i -lt $allLines.Count; $i++) {
      if ($dropLines -contains ($i + 1)) { continue }
      $kept += $allLines[$i]
    }
    [System.IO.File]::WriteAllText($pkgJson, (($kept -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
    Ok "已删除 $($dropLines.Count) 行"
  }
}

# ---- [6/6] 人设预设 ----
Step "[6/6] 移除 Fairy 人设预设目录"
if (Test-Path $presetDir) {
  Remove-Item $presetDir -Recurse -Force
  Ok "已移除 $presetDir"
} else {
  Warn "未发现人设预设，跳过"
}
$presetBackup = Join-Path $DshHome '.fairy-persona\default-preset-backup.json'
if (Test-Path $presetBackup) {
  Write-Host "   提醒：agent-presets.default 若仍是 fairy，请在 DSH 设置里改回原值（备份：$presetBackup）" -ForegroundColor DarkGray
}

# ---- 校验 ----
Step "校验 profile 合成"
& dsh --profile $Profile --dump-config 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Warn "dump-config 返回 $LASTEXITCODE，profile 可能还有残留"
} else {
  Ok "合成 OK"
}

Write-Host ""
Write-Host "  [完成] 卸载结束，重启 DSH 后生效" -ForegroundColor Green
Write-Host "  插件源码（本目录）未被删除，可随时重新安装：" -ForegroundColor DarkGray
Write-Host "    A) 双击 install.cmd（走 tgz，群友路径）" -ForegroundColor DarkGray
Write-Host "    B) dsh plugin --profile $Profile add link:<包目录>（开发态）" -ForegroundColor DarkGray
Write-Host ""
