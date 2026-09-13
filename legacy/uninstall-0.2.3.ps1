# Fairy-DSH 卸载脚本
#
#   .\uninstall.ps1                   移除受管 patch 块 + 解除 profile 链接依赖
#   .\uninstall.ps1 -RestoreBackup    额外从最近一次安装备份还原两个文件
#   .\uninstall.ps1 -Yes              跳过确认
#
# 直接双击本目录里的 uninstall.cmd 也能用。
[CmdletBinding()]
param(
  [string]$Profile = 'web',
  [string]$DshHome,
  [switch]$RestoreBackup,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'

# 以字节读入并按 UTF-8 严格解码，避免 PS 5.1 的 ANSI 往返损坏非 ASCII 内容
function Read-TextSmart([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $bom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  if ($bom) {
    return @{ Text = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3); Bom = $true; Ansi = $false }
  }
  try {
    $strict = New-Object System.Text.UTF8Encoding($false, $true)
    return @{ Text = $strict.GetString($bytes); Bom = $false; Ansi = $false }
  } catch {
    $ansi = [System.Text.Encoding]::GetEncoding([System.Globalization.CultureInfo]::CurrentCulture.TextInfo.ANSICodePage)
    return @{ Text = $ansi.GetString($bytes); Bom = $false; Ansi = $true }
  }
}

function Write-TextSmart([string]$Path, [string]$Text, $Info) {
  if ($Info.Ansi) {
    $ansi = [System.Text.Encoding]::GetEncoding([System.Globalization.CultureInfo]::CurrentCulture.TextInfo.ANSICodePage)
    [System.IO.File]::WriteAllText($Path, $Text, $ansi)
  } else {
    [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($Info.Bom)))
  }
}

$script:Interactive = $true
try { $script:Interactive = -not [Console]::IsInputRedirected -and [Environment]::UserInteractive } catch { $script:Interactive = $false }
if ($Yes) { $script:Interactive = $false }

function Wait-AnyKey([string]$Message) {
  if (-not $script:Interactive) { return }
  Write-Host ""
  Write-Host $Message -ForegroundColor DarkGray
  try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { }
}
function Step([string]$Text) { Write-Host "-> $Text" -ForegroundColor Cyan }
function Ok([string]$Text) { Write-Host "   $Text" -ForegroundColor Green }
function Warn([string]$Text) { Write-Host "   $Text" -ForegroundColor Yellow }

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

if (-not $DshHome) {
  $DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
}
$profileDir = Join-Path $DshHome "profiles\$Profile"
$pkgJson = Join-Path $profileDir 'package.json'
$patchFile = Join-Path $profileDir 'cordis.patch.yml'

Write-Host ""
Write-Host "  Fairy-DSH 卸载程序" -ForegroundColor Magenta
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
Write-Host "  目标 profile: $profileDir"
Write-Host "  插件源码不会被删除，可随时重新安装。"
Write-Host ""

# 没在命令行指定 -RestoreBackup 时，给出按数字键的菜单
if (-not $PSBoundParameters.ContainsKey('RestoreBackup') -and -not $Yes -and $script:Interactive) {
  Write-Host "  请选择卸载方式（按数字键）：" -ForegroundColor White
  Write-Host "    1) 只卸载            移除受管块 + 解除依赖，保留备份目录"
  Write-Host "    2) 卸载并还原备份    额外从最近一次安装备份还原两个文件"
  Write-Host "    0) 退出"
  Write-Host ""
  Write-Host "  你的选择: " -NoNewline -ForegroundColor Yellow
  $k = Read-OneKey '012'
  if ($null -eq $k -or $k -eq '0' -or $k -eq 'ESC') {
    Write-Host ""
    Write-Host "  已取消。" -ForegroundColor Yellow
    Write-Host ""
    Wait-AnyKey "按任意键退出 ..."
    exit 0
  }
  if ($k -eq '2') { $RestoreBackup = $true }
  Write-Host ""
  Write-Host "  将移除 cordis.patch.yml 的受管块，并解除 Fairy 相关 link: 依赖" -ForegroundColor DarkYellow
  if ($RestoreBackup) { Write-Host "  并从最近一次安装备份还原 package.json / cordis.patch.yml" -ForegroundColor DarkYellow }
  Write-Host ""
  Write-Host "  按任意键开始卸载，Ctrl+C 取消 ..." -ForegroundColor Yellow
  try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { }
  Write-Host ""
} elseif (-not $Yes) {
  Write-Host "  按任意键开始卸载，Ctrl+C 取消 ..." -ForegroundColor Yellow
  try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { }
  Write-Host ""
}

if (-not (Test-Path $patchFile)) { throw "找不到 $patchFile（profile 名或 DSH_HOME 是否正确？）" }

$beginMarker = '# >>> Fairy-DSH managed block'
$endMarker = '# <<< Fairy-DSH managed block'

Step "[1/5] 移除受管 patch 块"
$read = Read-TextSmart $patchFile
$raw = $read.Text
if ($raw -match [regex]::Escape($beginMarker)) {
  $pattern = '(?ms)^' + [regex]::Escape($beginMarker) + '.*?^' + [regex]::Escape($endMarker) + '\r?\n?'
  $cleaned = [regex]::Replace($raw, $pattern, '')
  Write-TextSmart $patchFile $cleaned $read
  Ok "已移除"
} else {
  Warn "未发现受管块，跳过"
}

Step "[2/5] 还原设置栏（移除语音检测面板）"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Test-Path (Join-Path $root 'lib\settings-merge.ps1')) {
  . (Join-Path $root 'lib\settings-merge.ps1')
  $st = Get-SettingsMergeState -Root $root
  if ($st -eq 'merged') {
    $m = Set-SettingsMerge -Root $root -Mode upstream -Snapshot
    Ok "已还原（$($m.PreviousState) -> $($m.State)）"
  } else {
    Warn "设置栏状态：$st，无需还原"
  }
} else {
  Warn "找不到 lib\settings-merge.ps1，跳过"
}

Step "[3/5] 移除 Fairy 人设预设"
$presetDst = Join-Path $DshHome '.agent-presets\fairy'
if (Test-Path $presetDst) {
  Remove-Item $presetDst -Recurse -Force -ErrorAction SilentlyContinue
  Ok "已移除 $presetDst"
} else {
  Warn "未发现人设预设，跳过"
}

Step "[4/5] 解除 profile 链接依赖"
$pkgs = @('dsh-fairy-visual', 'dsh-balance-meter', 'dsh-fairy-startup', 'dsh-fairy-voice', 'dsh-browser-dock')
# pnpm remove 只要收到一个不存在的包名就会整体失败，所以先只挑出真正装了的
$installed = @()
try {
  $pkgRead = Read-TextSmart $pkgJson
  $pkgObj = $pkgRead.Text | ConvertFrom-Json
  if ($pkgObj -and $pkgObj.dependencies) {
    $names = @($pkgObj.dependencies.PSObject.Properties | ForEach-Object { $_.Name })
    $installed = @($pkgs | Where-Object { $names -contains $_ })
  }
} catch {
  Warn "无法解析 $pkgJson，将尝试移除全部：$($_.Exception.Message)"
  $installed = $pkgs
}
if ($installed.Count -eq 0) {
  Warn "profile 里没有 Fairy 相关依赖，跳过"
} else {
  $env:DSH_HOME = $DshHome
  & dsh plugin --profile $Profile remove @installed | Out-Null
  if ($LASTEXITCODE -ne 0) { Warn "dsh plugin remove 返回 $LASTEXITCODE，请手动检查 $pkgJson" } else { Ok "已解除 $($installed.Count) 个依赖：$($installed -join ', ')" }
}

if ($RestoreBackup) {
  Step "附加：从备份还原"
  $latest = Get-ChildItem $profileDir -Directory -Filter 'fairy-backup-*' -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
  if ($latest) {
    Copy-Item (Join-Path $latest.FullName 'package.json') $pkgJson -Force
    Copy-Item (Join-Path $latest.FullName 'cordis.patch.yml') $patchFile -Force
    Ok "已从 $($latest.Name) 还原"
  } else {
    Warn "没有找到 fairy-backup-* 备份目录"
  }
}

Step "[5/5] 校验 profile 合成"
$dump = & dsh --profile $Profile --dump-config 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { Warn "dump-config 返回 $LASTEXITCODE，请检查 $patchFile" } else { Ok "合成 OK" }

Write-Host ""
Write-Host "  [完成] 卸载成功，重启 DSH 后生效" -ForegroundColor Green
Write-Host ""
Wait-AnyKey "按任意键退出 ..."

exit 0
