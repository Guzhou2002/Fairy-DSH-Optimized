# Fairy-DSH 卸载程序
#
#   .\uninstall.ps1                  卸载 Fairy 相关插件 + 预设，并还原默认预设
#   .\uninstall.ps1 -Profile web     指定 profile（默认 web）
#   .\uninstall.ps1 -Yes             跳过确认
#   .\uninstall.ps1 -CleanBundle     额外清掉 package.json / cordis.patch.yml 里的残留行
#
# ---------------------------------------------------------------------------
# 兼容层：这个脚本要能卸掉**任何历史版本**装的 Fairy
#
#   1. 包名不写死 —— 凡是以 dsh-fairy- 开头，或叫 dsh-balance-meter / dsh-browser-dock
#      的依赖，一律卸（这样也覆盖历史上那个独立包 dsh-fairy-contracts）
#   2. 不管当初是 link: / file: / .tgz / 远程 URL 装的，都走同一条 dsh plugin remove
#   3. 老版 0.2.x 在 cordis.patch.yml 里塞的「Fairy-DSH managed block」会被识别；
#      但**默认只报告不动手**（老规矩：动 profile 前要先备份、要先让人看见）
#   4. 插件可能装过一半 / 老版可能留下 node_modules 残渣 —— 会检查并提示
# ---------------------------------------------------------------------------
# 🔴 三件【不做】的事（都是有意的）
#
#   1. **不删 `~/.dsh/fairy-voice/`** —— 那里是你的参考音频、朗读设置和语音简报 API Key，
#      脚本一个字都不动，只在最后打印路径让你自己决定
#   2. **不删插件源码目录**（本仓库 / 你 clone 的目录）—— 卸完随时能重装
#   3. **不碰正在运行的 DSH** —— 不杀进程、不改端口；重启由你自己做
# ---------------------------------------------------------------------------
[CmdletBinding()]
param(
  [string]$Profile = 'web',
  [string]$DshHome,
  [switch]$CleanBundle,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'

if (-not $DshHome) {
  $DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
}
$profileDir = Join-Path $DshHome "profiles\$Profile"
$pkgJson    = Join-Path $profileDir 'package.json'
$patchFile  = Join-Path $profileDir 'cordis.patch.yml'
$settingsFile = Join-Path $DshHome 'settings.yaml'
$presetDir  = Join-Path $DshHome '.agent-presets\fairy'
$fairyMeta  = Join-Path $DshHome '.fairy-persona'
$presetBackup = Join-Path $fairyMeta 'default-preset-backup.json'
$syncStamp  = Join-Path $fairyMeta 'preset-sync.json'
$voiceData  = Join-Path $DshHome 'fairy-voice'

# 所有 dsh 调用都必须打到同一个 home（否则用 -DshHome 测试时会误伤真实环境）
$env:DSH_HOME = $DshHome

function Step([string]$Text) { Write-Host "-> $Text" -ForegroundColor Cyan }
function Ok([string]$Text)   { Write-Host "   $Text" -ForegroundColor Green }
function Warn([string]$Text) { Write-Host "   $Text" -ForegroundColor Yellow }
function Info([string]$Text) { Write-Host "   $Text" -ForegroundColor DarkGray }

# 读文件时保留 BOM、写回时原样：settings.yaml / cordis.patch.yml 可能是带 BOM 也可能不带
function Read-TextKeepBom([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  $offset = if ($hasBom) { 3 } else { 0 }
  return [pscustomobject]@{
    Text   = [System.Text.Encoding]::UTF8.GetString($bytes, $offset, $bytes.Length - $offset)
    HasBom = $hasBom
  }
}
function Write-TextKeepBom([string]$Path, [string]$Text, [bool]$HasBom) {
  [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($HasBom)))
}

Write-Host ""
Write-Host "  Fairy-DSH 卸载程序" -ForegroundColor Magenta
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
Write-Host "  目标 profile: $profileDir"
Write-Host "  插件源码不会被删除，随时可以重新安装。"
Write-Host "  你的语音数据（参考音频 / API Key）也不会被删除。"
Write-Host ""

if (-not (Test-Path $pkgJson)) {
  throw "找不到 $pkgJson（profile 名或 DSH_HOME 是否正确？）"
}

$dshCmd = Get-Command dsh -ErrorAction SilentlyContinue
if (-not $dshCmd) {
  Warn "找不到 dsh 命令 —— 请先确认 DSH 已安装、且当前窗口能直接运行 dsh"
}

if (-not $Yes) {
  Write-Host "  按任意键开始卸载，Ctrl+C 取消 ..." -ForegroundColor Yellow
  try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { }
  Write-Host ""
}

# ---- [1/7] 备份 ----
Step "[1/7] 备份 profile 与设置（出事能翻回去）"
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $profileDir "fairy-backup-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $pkgJson $backupDir -Force
if (Test-Path $patchFile)    { Copy-Item $patchFile $backupDir -Force }
if (Test-Path $settingsFile) { Copy-Item $settingsFile $backupDir -Force }
Ok "已备份到 $backupDir"

# ---- [2/7] 找出真正装了的 Fairy 包（兼容层 ①：不写死包名）----
Step "[2/7] 检查已安装的 Fairy 插件"
$installed = @()
$parsed = $false
try {
  $pkgObj = Get-Content $pkgJson -Raw -Encoding UTF8 | ConvertFrom-Json
  $parsed = $true
  if ($pkgObj.dependencies) {
    $names = @($pkgObj.dependencies.PSObject.Properties | ForEach-Object { $_.Name })
    # dsh-fairy-* 覆盖了 dsh-fairy-contracts 这类历史包名；另外两个名字不带 fairy 前缀，单独列
    $installed = @($names | Where-Object { $_ -like 'dsh-fairy-*' -or $_ -eq 'dsh-balance-meter' -or $_ -eq 'dsh-browser-dock' })
  }
} catch {
  Warn "无法解析 package.json：$($_.Exception.Message)"
  Warn "为安全起见跳过依赖移除，请手动检查 $pkgJson"
}
if (-not $parsed) {
  Warn "跳过 [3/7]"
} elseif ($installed.Count -eq 0) {
  Warn "profile 里没有 Fairy 相关依赖（可能早就卸过了）"
} else {
  Ok "发现 $($installed.Count) 个：$($installed -join ', ')"
}

# ---- [3/7] 解除依赖 ----
Step "[3/7] 解除 profile 依赖（dsh plugin remove）"
if (-not $parsed -or $installed.Count -eq 0) {
  Warn "跳过"
} elseif (-not $dshCmd) {
  Warn "跳过（找不到 dsh 命令）"
} else {
  # dsh 会往 stderr 打警告；$ErrorActionPreference='Stop' 下外部命令的 stderr 会被当成终止错误，
  # 直接把脚本从中间掀翻（连最后的总结都打不出来）—— 所以这里临时放成 Continue。
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & dsh plugin --profile $Profile remove @installed } catch { Warn "dsh 调用异常：$($_.Exception.Message)" }
  $rc = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  if ($rc -ne 0) {
    Warn "dsh plugin remove 返回 $rc，请手动检查 $pkgJson"
  } else {
    Ok "已移除 $($installed.Count) 个依赖"
  }
}

# ---- [4/7] 还原「新会话默认预设」----
#
# 🔴 这一步是整个卸载脚本里最重要的：不还原它，卸完反而更坏 ——
#    settings.yaml 里 agent-presets.default 还指着 fairy，而预设已经被删了，
#    结果就是「点新建会话没反应」（预设挂载失败 → 会话创建被回滚）。
Step "[4/7] 还原「新会话默认预设」"
$restoreTo = $null
if (Test-Path $presetBackup) {
  try {
    $b = Get-Content $presetBackup -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($b.previousDefault -is [string] -and $b.previousDefault.Trim() -ne '') { $restoreTo = $b.previousDefault.Trim() }
  } catch {
    Warn "读不了 $presetBackup：$($_.Exception.Message)"
  }
}
# 没有备份（或备份里是空的）就回落到内置的 standard —— 绝不能写空串，那会让新会话没有默认预设
if (-not $restoreTo) { $restoreTo = 'standard' }

if (-not (Test-Path $settingsFile)) {
  Warn "没有 $settingsFile，跳过"
} else {
  $sf = Read-TextKeepBom $settingsFile
  $t = $sf.Text
  $cur = $null
  # 两种写法都认：块状（default 在下一行）与行内（{ default: fairy }）
  $blockRe = [regex]'(?m)^(?<head>agent-presets:[ \t]*\r?\n(?<ind>[ \t]+)default:[ \t]*)(?<val>[^\r\n]+)'
  $inlineRe = [regex]'(?m)^agent-presets:[ \t]*\{[^}]*default:[ \t]*(?<val>[^,}\r\n]+)'
  if ($blockRe.Matches($t).Count -eq 1) {
    $m = $blockRe.Match($t)
    $cur = $m.Groups['val'].Value.Trim().Trim('"').Trim("'")
    if ($cur -eq 'fairy') {
      $t = $blockRe.Replace($t, { param($x) $x.Groups['head'].Value + $restoreTo }, 1)
      Write-TextKeepBom $settingsFile $t $sf.HasBom
      Ok "agent-presets.default：fairy → $restoreTo"
    } else {
      Warn "当前默认预设是「$cur」，不是 fairy，不动它"
    }
  } elseif ($inlineRe.Matches($t).Count -eq 1) {
    $m = $inlineRe.Match($t)
    $cur = $m.Groups['val'].Value.Trim().Trim('"').Trim("'")
    if ($cur -eq 'fairy') {
      $t = $inlineRe.Replace($t, { param($x) $x.Value -replace [regex]::Escape($cur), $restoreTo }, 1)
      Write-TextKeepBom $settingsFile $t $sf.HasBom
      Ok "agent-presets.default（行内写法）：fairy → $restoreTo"
    } else {
      Warn "当前默认预设是「$cur」，不是 fairy，不动它"
    }
  } else {
    Warn "settings.yaml 里没找到 agent-presets 段（或写法不认识）—— 请重启 DSH 后到设置里确认默认预设"
  }
}

# ---- [5/7] 移除人设预设目录与同步指纹 ----
Step "[5/7] 移除 Fairy 人设预设目录"
if (Test-Path $presetDir) {
  Remove-Item $presetDir -Recurse -Force
  Ok "已移除 $presetDir"
} else {
  Warn "未发现人设预设，跳过"
}
if (Test-Path $syncStamp) {
  Remove-Item $syncStamp -Force
  Ok "已移除同步指纹 $syncStamp"
}

# ---- [6/7] 残留扫描（兼容层 ②：老版遗留）----
Step "[6/7] 扫描历史版本的残留"
$managedBegin = '# >>> Fairy-DSH managed block'
$managedEnd   = '# <<< Fairy-DSH managed block'
$hasManagedBlock = $false
if (Test-Path $patchFile) {
  $pf = Read-TextKeepBom $patchFile
  if ($pf.Text -match [regex]::Escape($managedBegin)) {
    $hasManagedBlock = $true
    Warn "cordis.patch.yml 里有老版（0.2.x）的「Fairy-DSH managed block」"
    if ($CleanBundle) {
      $pattern = '(?ms)^' + [regex]::Escape($managedBegin) + '.*?^' + [regex]::Escape($managedEnd) + '\r?\n?'
      $cleaned = [regex]::Replace($pf.Text, $pattern, '')
      Write-TextKeepBom $patchFile $cleaned $pf.HasBom
      Ok "已移除受管块（原文件在 $backupDir）"
    } else {
      Info "没有自动动它。确认要删，就加 -CleanBundle 重跑（会先备份）"
    }
  }
}
if (-not $hasManagedBlock) { Ok "cordis.patch.yml 里没有老版受管块" }

$hits = @()
$allLines = @(Get-Content $pkgJson)
for ($i = 0; $i -lt $allLines.Count; $i++) {
  if ($allLines[$i] -match 'dsh-fairy-|dsh-balance-meter|dsh-browser-dock') {
    $hits += [pscustomobject]@{ Line = ($i + 1); Text = $allLines[$i].Trim() }
  }
}
if ($hits.Count -eq 0) {
  Ok "package.json 里没有残留"
} else {
  Warn "package.json 里还有 $($hits.Count) 处残留（前面没删干净）："
  foreach ($h in $hits) { Write-Host ("     L{0}: {1}" -f $h.Line, $h.Text) -ForegroundColor DarkYellow }
  if (-not $CleanBundle) {
    Info "没有自动修改。确认要删这些行，就加 -CleanBundle 重跑（会先备份）"
  } else {
    $dropLines = @($hits | ForEach-Object { $_.Line })
    $kept = @()
    for ($i = 0; $i -lt $allLines.Count; $i++) {
      if ($dropLines -contains ($i + 1)) { continue }
      $kept += $allLines[$i]
    }
    # 🔴 写盘前必须先验证 —— 按行删可能把 JSON 删坏：
    #    · 单行写法的 package.json 会被整个删掉
    #    · 那行正好是数组/对象的最后一项时，会留下尾逗号 → JSON 非法
    #    验不过就一个字都不动（宁可留着残渣，也不能把人家的 profile 弄坏）
    $candidate = (($kept -join "`r`n") + "`r`n")
    $jsonOk = $false
    try {
      $null = $candidate | ConvertFrom-Json
      $jsonOk = ($candidate.Trim().Length -gt 0)
    } catch { $jsonOk = $false }
    if (-not $jsonOk) {
      Warn "自动删行会把 package.json 弄坏（单行写法，或那行是最后一项），已放弃修改"
      Info "请手动编辑 $pkgJson，删掉上面列出的那几行"
    } else {
      # 先备份当前 package.json 再动（[1/7] 备份的是卸载前的，这里再存一份更接近现场）
      Copy-Item $pkgJson (Join-Path $backupDir "package.json.before-clean") -Force
      [System.IO.File]::WriteAllText($pkgJson, $candidate, (New-Object System.Text.UTF8Encoding($false)))
      Ok "已删除 $($dropLines.Count) 行"
    }
  }
}

# 老版/装一半留下的 node_modules 残渣
$nmJunk = @()
foreach ($nm in @("$profileDir\node_modules")) {
  if (Test-Path $nm) {
    foreach ($d in Get-ChildItem $nm -Directory -ErrorAction SilentlyContinue) {
      if ($d.Name -like 'dsh-fairy-*' -or $d.Name -eq 'dsh-balance-meter' -or $d.Name -eq 'dsh-browser-dock') { $nmJunk += $d.Name }
    }
  }
}
if ($nmJunk.Count -gt 0) {
  Warn "node_modules 里还有目录残留：$($nmJunk -join ', ')"
  Info "通常无害（下次装依赖会被 pnpm 清掉）；想立刻清就手动删 $profileDir\node_modules 下这几个目录"
} else {
  Ok "node_modules 里没有残留目录"
}

# ---- [7/7] 校验 ----
Step "[7/7] 校验 profile 合成"
if ($dshCmd) {
  # 同 [3/7]：dsh 的 stderr 会掀翻脚本，这里也要放成 Continue
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & dsh --profile $Profile --dump-config 2>&1 | Out-Null } catch { Warn "dsh 调用异常：$($_.Exception.Message)" }
  $rc = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  if ($rc -ne 0) {
    Warn "dump-config 返回 $rc，profile 可能还有残留"
  } else {
    Ok "合成 OK"
  }
} else {
  Warn "跳过（找不到 dsh 命令）"
}

Write-Host ""
Write-Host "  [完成] 卸载结束，重启 DSH 后生效" -ForegroundColor Green
Write-Host ""
Write-Host "  以下内容【没有被删除】，要不要清由你自己决定：" -ForegroundColor DarkGray
Write-Host "    语音数据（参考音频 / 朗读设置 / 语音简报 API Key）" -ForegroundColor DarkGray
Write-Host "      $voiceData" -ForegroundColor DarkGray
Write-Host "    默认预设备份（万一想改回去）：" -ForegroundColor DarkGray
Write-Host "      $presetBackup" -ForegroundColor DarkGray
Write-Host "    卸载前的 profile 备份：" -ForegroundColor DarkGray
Write-Host "      $backupDir" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  想彻底清干净就自己删上面第一个目录 —— 删了就找不回来。" -ForegroundColor DarkGray
Write-Host "  想重新安装：双击 install.cmd 即可。" -ForegroundColor DarkGray
Write-Host ""
