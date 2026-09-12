# Fairy-DSH 安装脚本
#
#   .\install.ps1                 交互式安装（默认只装核心 UI 插件，会先让你确认）
#   .\install.ps1 -Plugins all     安装全部插件
#   .\install.ps1 -Yes             跳过所有确认（自动化用）
#   .\install.ps1 -WhatIfRun       只打印将要做的改动，不写任何文件
#
# 直接双击本目录里的 install.cmd 也能用。
[CmdletBinding()]
param(
  # visual / balance / startup / voice / dock / all，支持逗号分隔："visual,balance"
  # 不传时（双击运行时）会给出按数字键的菜单
  [string[]]$Plugins = @(),

  # 目标 profile 名（$DSH_HOME\profiles\<名字>）
  [string]$Profile = 'web',

  # DSH 家目录；默认取 $env:DSH_HOME，其次 ~\.dsh
  [string]$DshHome,

  # 跳过确认与结尾停顿
  [switch]$Yes,

  # 只检查并打印，不修改任何文件
  [switch]$WhatIfRun,

  # 缺少依赖时不自动执行 pnpm install，直接报错
  [switch]$SkipDeps
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Version = '0.2.3'
. (Join-Path $root 'lib\settings-merge.ps1')

# ---------- 文本读写 ----------
# 关键：不能用 Get-Content -Raw。Windows PowerShell 5.1 会按 ANSI(GBK) 读取
# 无 BOM 的 UTF-8 文件，写回时非 ASCII 内容会被双重编码，甚至吃掉换行。
# 这里始终以字节读入、按 UTF-8 严格解码，失败才回退 ANSI，并保留原 BOM 与换行风格。
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

function Get-DominantEol([string]$Text) {
  if ($Text -match "`r`n") { return "`r`n" }
  return "`n"
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

# 读一个按键（不回显，自己回显）。非交互环境返回 $null，调用方退回默认值。
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

# 按编号选插件，返回 key 数组；$null 表示取消
function Show-PluginMenu {
  Write-Host ""
  Write-Host "  请选择要安装的内容（按数字键）：" -ForegroundColor White
  Write-Host "    1) 只装核心 UI            dsh-fairy-visual"
  Write-Host "    2) UI + 语音朗读          dsh-fairy-visual, dsh-fairy-voice"
  Write-Host "    3) UI + 语音 + 余额挂件    (+ dsh-balance-meter)"
  Write-Host "    4) 全部 5 个插件"
  Write-Host "    5) 自定义（输入编号，如 1,3 后回车）"
  Write-Host "    0) 退出"
  Write-Host ""
  Write-Host "  你的选择: " -NoNewline -ForegroundColor Yellow
  $k = Read-OneKey '012345'
  if ($null -eq $k) { return $null }
  switch ($k) {
    '1' { return @('visual') }
    '2' { return @('visual', 'voice') }
    '3' { return @('visual', 'voice', 'balance') }
    '4' { return @('visual', 'voice', 'balance', 'startup', 'dock') }
    '0' { return $null }
    'ESC' { return $null }
    '5' {
      Write-Host ""
      Write-Host "  输入编号（可多选，逗号分隔，例如 1,3）：" -ForegroundColor White
      Write-Host "    1=visual  2=voice  3=balance  4=startup  5=dock" -ForegroundColor DarkGray
      Write-Host "  > " -NoNewline -ForegroundColor Yellow
      $line = ''
      try { $line = [Console]::ReadLine() } catch { $line = '' }
      if (-not $line) { return $null }
      $map = @{ '1' = 'visual'; '2' = 'voice'; '3' = 'balance'; '4' = 'startup'; '5' = 'dock' }
      $picked = @()
      foreach ($tok in ($line -split '[,\s]+')) {
        if ($map.ContainsKey($tok.Trim())) { $picked += $map[$tok.Trim()] }
      }
      if ($picked.Count -eq 0) { return $null }
      return @($picked | Select-Object -Unique)
    }
    default { return $null }
  }
}

# ---------- 插件清单 ----------
$Catalog = [ordered]@{
  visual  = @{ name = 'dsh-fairy-visual';  dir = 'fairy-visual\dsh-fairy-visual';   note = 'HDD 主题 + mascot + composer 坞（核心 UI，推荐）' }
  balance = @{ name = 'dsh-balance-meter'; dir = 'balance-meter\dsh-balance-meter'; note = '侧栏余额/费用挂件（会读 .credentials.yaml）' }
  startup = @{ name = 'dsh-fairy-startup'; dir = 'fairy-startup\dsh-fairy-startup'; note = '启动时重置会话选择（谨慎，会丢恢复的会话）' }
  voice   = @{ name = 'dsh-fairy-voice';   dir = 'fairy-voice\dsh-fairy-voice';     note = '朗读回复 + 语音简报（需要本机 GPT-SoVITS，否则按钮为灰色）' }
  dock    = @{ name = 'dsh-browser-dock';  dir = 'browser-dock\dsh-browser-dock';   note = 'Playwright 截图 Dock（需要 @playwright/mcp，不建议）' }
}

$Plugins = @($Plugins | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })

# ---------- 菜单（不传 -Plugins 时） ----------
if ($Plugins.Count -eq 0) {
  if ($Yes) {
    # 自动化：不弹菜单，用默认集合
    $Plugins = @('visual')
  } elseif ($script:Interactive) {
    Write-Host ""
    Write-Host "  Fairy-DSH 安装程序  v$Version" -ForegroundColor Magenta
    Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
    $selection = Show-PluginMenu
    if ($null -eq $selection) {
      Write-Host ""
      Write-Host "  已取消。" -ForegroundColor Yellow
      Write-Host ""
      Wait-AnyKey "按任意键退出 ..."
      exit 0
    }
    $Plugins = @($selection)
    if ($Plugins -contains 'voice') {
      Write-Host '  已选语音插件：朗读需要本机 GPT-SoVITS（下一步会详细提示）' -ForegroundColor DarkYellow
    }
    Write-Host ""
  } else {
    # 非交互（管道/重定向）：用默认集合并说明
    Write-Host "  [提示] 非交互环境，使用默认集合：visual" -ForegroundColor DarkGray
    $Plugins = @('visual')
  }
}

if ($Plugins -contains 'all') { $Plugins = @($Catalog.Keys) }
$unknown = @($Plugins | Where-Object { -not $Catalog.Contains($_) })
if ($unknown.Count -gt 0) {
  throw "未知插件：$($unknown -join ', ')（可用：$($Catalog.Keys -join ' / ') / all）"
}
$Plugins = @($Catalog.Keys | Where-Object { $Plugins -contains $_ })   # 固定顺序

if (-not $DshHome) {
  $DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
}
$profileDir = Join-Path $DshHome "profiles\$Profile"
$pkgJson = Join-Path $profileDir 'package.json'
$patchFile = Join-Path $profileDir 'cordis.patch.yml'

# ---------- 欢迎与确认 ----------
Write-Host ""
Write-Host "  Fairy-DSH 安装程序  v$Version" -ForegroundColor Magenta
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
Write-Host "  插件来源   : $root"
Write-Host "  DSH 家目录 : $DshHome"
Write-Host "  目标 profile: $Profile"
Write-Host ""
Write-Host "  将要安装的插件："
foreach ($key in $Plugins) {
  Write-Host ("    . {0,-28} {1}" -f $Catalog[$key].name, $Catalog[$key].note)
}
Write-Host ""
Write-Host "  将要修改的文件：" -ForegroundColor DarkYellow
Write-Host "    . $pkgJson"
Write-Host "    . $patchFile"
Write-Host "    改动前会自动备份到 profile 下的 fairy-backup-<时间戳>\"
Write-Host ""

if ($WhatIfRun) { Write-Host "  [干跑模式] 不会修改任何文件" -ForegroundColor Yellow; Write-Host "" }
elseif (-not $Yes) {
  Write-Host "  按任意键开始安装，Ctrl+C 取消 ..." -ForegroundColor Yellow
  try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { }
  Write-Host ""
}

if (-not (Test-Path $pkgJson)) { throw "找不到 profile：$pkgJson（检查 -Profile / -DshHome）" }
if (-not (Test-Path $patchFile)) { throw "找不到 $patchFile" }

# ---------- 1/5 检查依赖 ----------
Step "[1/7] 检查插件依赖"
$needDeps = @()
foreach ($key in $Plugins) {
  $c = $Catalog[$key]
  $dir = Join-Path $root $c.dir
  if (-not (Test-Path (Join-Path $dir 'package.json'))) { throw "缺少插件包：$dir" }
  if (-not (Test-Path (Join-Path $dir 'node_modules'))) { $needDeps += $dir }
}

if ($needDeps.Count -gt 0) {
  if ($SkipDeps) { throw "以下插件缺少 node_modules：`n  $($needDeps -join "`n  ")`n请先在各目录执行 pnpm install --prod --ignore-scripts" }
  if ($WhatIfRun) {
    Warn "[干跑] 需要为 $($needDeps.Count) 个插件执行 pnpm install"
  } else {
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "未找到 pnpm。请先安装 pnpm，或改用自带依赖的完整包。" }
    Warn "有 $($needDeps.Count) 个插件缺少依赖，开始自动安装（需要网络）..."
    foreach ($dir in $needDeps) {
      Write-Host "     pnpm install -> $(Split-Path $dir -Leaf)"
      Push-Location $dir
      try {
        & pnpm install --prod --ignore-scripts | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "pnpm install 失败于 $dir" }
      } finally { Pop-Location }
    }
    Ok "依赖安装完成"
  }
} else {
  Ok "全部插件依赖就绪"
}

# ---------- 语音：装前提示 + 设置检测 ----------
if ($Plugins -contains 'voice') {
  Write-Host ""
  Write-Host "  ================================================================" -ForegroundColor Yellow
  Write-Host "   注意：dsh-fairy-voice 的朗读需要本机运行 GPT-SoVITS" -ForegroundColor Yellow
  Write-Host "     * 服务地址固定 http://127.0.0.1:9880（上游硬编码，不可配置）" -ForegroundColor Yellow
  Write-Host "     * 还需要参考音频 ~/.dsh/fairy-voice/runtime/reference/" -ForegroundColor Yellow
  Write-Host "       fairy_ref.wav 与 fairy_ref.txt" -ForegroundColor Yellow
  Write-Host "     * 没跑 GPT-SoVITS 时「朗读回复」按钮是灰色的，不会出声" -ForegroundColor Yellow
  Write-Host "     * 装完后：设置 -> Fairy -> 朗读服务，可点「重新检测」" -ForegroundColor Yellow
  Write-Host "  ================================================================" -ForegroundColor Yellow
  Write-Host ""
  Step "[2/7] 合并设置栏（设置里只保留一个 Fairy 入口）"
  $mergeState = Get-SettingsMergeState -Root $root
  if ($WhatIfRun) {
    Warn "[干跑] 当前 $mergeState，将把语音面板并入 Fairy 设置栏（会先快照）"
  } elseif ($mergeState -eq 'merged') {
    Ok "设置栏已是合并态，无需改动"
  } else {
    $mg = Set-SettingsMerge -Root $root -Mode merged -Snapshot
    Ok "已合并（$($mg.PreviousState) -> $($mg.State)）"
    Write-Host "     设置 -> Fairy 里会多出「朗读服务」检测区（检测不到时醒目提示）" -ForegroundColor DarkGray
    if ($mg.Snapshot) { Write-Host "     已快照原文件到 snapshots\" -ForegroundColor DarkGray }
  }
}
# ---------- 2/5 备份 ----------
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $profileDir "fairy-backup-$stamp"
# ---------- 3/7 安装 Fairy 人设预设 ----------
Step "[3/7] 安装 Fairy 人设预设"
$presetSrc = Join-Path $root 'fairy-visual\dsh-fairy-visual\.agent-presets\fairy'
$presetDst = Join-Path $DshHome '.agent-presets\fairy'
if (-not (Test-Path $presetSrc)) {
  Warn "包里没有 .agent-presets\fairy，跳过"
} elseif ($WhatIfRun) {
  Warn "[干跑] 将把 Fairy 人设预设复制到 $presetDst"
} else {
  New-Item -ItemType Directory -Force -Path (Split-Path $presetDst -Parent) | Out-Null
  Copy-Item $presetSrc $presetDst -Recurse -Force
  Ok "已安装人设预设 -> $presetDst"
  Write-Host "     在 DSH 界面的预设选择器里选 Fairy 即可启用该人设" -ForegroundColor DarkGray
}
Step "[4/7] 备份现有配置"
if ($WhatIfRun) {
  Warn "[干跑] 将备份到 $backupDir"
} else {
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  Copy-Item $pkgJson (Join-Path $backupDir 'package.json') -Force
  Copy-Item $patchFile (Join-Path $backupDir 'cordis.patch.yml') -Force
  Ok "已备份到 $(Split-Path $backupDir -Leaf)"
}

# ---------- 3/5 安装 profile 依赖 ----------
Step "[5/7] 注册插件（一条命令，插件自带 dsh.bundle 声明）"
$links = @()
foreach ($key in $Plugins) { $links += "link:$root\$($Catalog[$key].dir)" }
$env:DSH_HOME = $DshHome
if ($WhatIfRun) {
  Warn "[干跑] dsh plugin --profile $Profile add $($links -join ' ')"
} else {
  & dsh plugin --profile $Profile add @links | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "dsh plugin add 失败（exit $LASTEXITCODE）" }
  Ok "已登记 $($links.Count) 个 link: 依赖"
}

# ---------- 5/6 清理遗留受管块 ----------
# 0.2.1 起插件自带 dsh.bundle.patch，dsh plugin add 会自动把它们加入
# dsh.profile.bundles，因此不再需要手写 cordis.patch.yml。这里只负责把
# 0.1.x 留下的受管块清掉，避免同一插件被注册两次。
Step "[6/7] 清理遗留受管块"
$beginMarker = '# >>> Fairy-DSH managed block'
$endMarker = '# <<< Fairy-DSH managed block'
$read = Read-TextSmart $patchFile
if ($read.Text -match [regex]::Escape($beginMarker)) {
  $pattern = '(?ms)^' + [regex]::Escape($beginMarker) + '.*?^' + [regex]::Escape($endMarker) + '\r?\n?'
  $cleaned = [regex]::Replace($read.Text, $pattern, '')
  if ($WhatIfRun) {
    Warn "[干跑] 将移除遗留受管块（插件现由 dsh.bundle 自动注册）"
  } else {
    Write-TextSmart $patchFile $cleaned $read
    Ok "已移除遗留受管块（0.1.x 写法，现由插件自带的 dsh.bundle 接管）"
  }
} else {
  Ok "无需迁移：cordis.patch.yml 里没有遗留受管块"
}
# ---------- 5/5 校验 ----------
Step "[7/7] 校验 profile 合成"
if ($WhatIfRun) {
  Warn "[干跑] 跳过校验"
} else {
  $dump = & dsh --profile $Profile --dump-config 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    Copy-Item (Join-Path $backupDir 'cordis.patch.yml') $patchFile -Force
    throw "profile 合成失败，已自动还原 cordis.patch.yml。输出：`n$dump"
  }
  $missing = @()
  foreach ($key in $Plugins) {
    $entryId = $Catalog[$key].name -replace '^dsh-', ''
    if ($dump -notmatch [regex]::Escape($entryId)) { $missing += $entryId }
  }
  if ($missing.Count -gt 0) { Warn "合成结果里没看到：$($missing -join ', ')" } else { Ok "合成 OK，$($Plugins.Count) 个插件条目均已生效" }
}

# ---------- 运行中的 DSH 提示 ----------
if (-not $WhatIfRun) {
  $running = @()
  try {
    $running = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -match 'deepseek-ai.dsh' })
  } catch { }
  if ($running.Count -gt 0) {
    Write-Host ""
    Warn "检测到 DSH 正在运行（pid $($running.ProcessId -join ', ')）—— 需要重启它才会加载新插件。"
  }
}

# ---------- 结尾 ----------
Write-Host ""
if ($WhatIfRun) {
  Write-Host "  [完成] 干跑结束 —— 未修改任何文件" -ForegroundColor Yellow
} else {
  Write-Host "  [完成] 安装成功" -ForegroundColor Green
}
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
Write-Host "  接下来："
Write-Host "    1. 重启 DSH"
Write-Host "    2. 打开 设置 -> HDD 视觉与 Fairy 身份 -> 启用"
Write-Host "       （插件默认 enabled=false，不会自动生效）"
Write-Host ""
Write-Host "  卸载：.\uninstall.ps1"
Write-Host "  自检：.\verify-isolated.ps1   （隔离环境验证，不动你的 profile）"
Write-Host ""
Write-Host "  也可以不用本脚本，一条命令即可（插件自带 bundle 声明）："
Write-Host "    dsh plugin --profile web add link:<本目录>\fairy-visual\dsh-fairy-visual"
Write-Host ""

Wait-AnyKey "按任意键退出 ..."

exit 0
