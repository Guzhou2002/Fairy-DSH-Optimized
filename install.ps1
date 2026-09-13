# Fairy-DSH 安装脚本（0.3.0 起的新流程）
#
# 通常由 install.cmd 调起 —— 双击 install.cmd 就行，不需要直接跑本文件。
#
#   .\install.ps1                       装到 web profile
#   .\install.ps1 -Profile 我的profile   装到别的 profile
#   .\install.ps1 -Only visual,voice     只装其中几个
#   .\install.ps1 -Yes                   不询问（自动化用）
#
# 本脚本只做两件事：
#   ① 检查 pnpm —— 缺了就问一声，然后帮你装
#   ② 调用 DSH 官方命令装插件（dsh plugin add）
#      官方命令自己会完成：下载 + 装依赖 + 注册到 profile
#      所以这里不需要做旧版安装器做的那些事
#
# 原理与实测证据见 docs\安装机制实测.md
# 旧版（0.2.3 及之前）的安装器保存在 legacy\install-0.2.3.ps1
[CmdletBinding()]
param(
  [string]$Profile = 'web',
  [string[]]$Only = @(),
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'

# GitHub Release 上的永久地址（附件名不带版本号，否则下次发版就会 404）
$Base = 'https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download'

$Plugins = [ordered]@{
  visual  = 'dsh-fairy-visual'
  voice   = 'dsh-fairy-voice'
  balance = 'dsh-balance-meter'
  dock    = 'dsh-browser-dock'
  startup = 'dsh-fairy-startup'
}

function Say([string]$Text, [string]$Color = 'Gray') { Write-Host $Text -ForegroundColor $Color }

# ---------- 解析要装哪些 ----------
$Only = @($Only | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($Only.Count -eq 0) {
  $keys = @($Plugins.Keys)
} else {
  $bad = @($Only | Where-Object { -not $Plugins.Contains($_) })
  if ($bad.Count -gt 0) {
    throw "未知插件：$($bad -join ', ')（可用：$($Plugins.Keys -join ' / ')）"
  }
  $keys = @($Plugins.Keys | Where-Object { $Only -contains $_ })
  # 语音插件的输入区控制器依赖视觉插件的 HDD 模式，自动带上
  if (($keys -contains 'voice') -and ($keys -notcontains 'visual')) { $keys = @('visual') + $keys }
}

Write-Host ""
Say "  Fairy-DSH 安装" 'Magenta'
Say "  ---------------------------------------------" 'DarkGray'
Say "  profile : $Profile"
Say "  插件    : $((@($keys | ForEach-Object { $Plugins[$_] })) -join ', ')"
Say "  ---------------------------------------------" 'DarkGray'
Write-Host ""

# ---------- ① 检查 pnpm ----------
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Say "  [!] 你的电脑上少一个小工具，叫 pnpm。" 'Yellow'
  Say "      装插件必须用到它。装一次就行，以后不用再管，"
  Say "      也不会影响你电脑上的其他东西。"
  Write-Host ""
  if (-not $Yes) {
    $ans = Read-Host "      现在帮你装吗？(Y = 装 / 其他 = 退出)"
    if ($ans -notmatch '^[Yy]') { Write-Host ""; Say "  已取消，什么都没改。" 'Yellow'; exit 0 }
  }
  Write-Host ""
  Say "      正在装 pnpm，请等十几秒 ..." 'Cyan'
  Write-Host ""
  & npm install -g pnpm
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Say "  [x] pnpm 没装上。" 'Red'
    Say "      请手动运行下面这条命令，然后重新双击 install.cmd：" 'Red'
    Write-Host ""
    Say "          npm install -g pnpm" 'White'
    Write-Host ""
    exit 1
  }
  Write-Host ""
  Say "      装好了。" 'Green'
  Write-Host ""
}

# ---------- ② 装插件 ----------
Say "  正在安装插件（要联网，可能要几分钟）..." 'Cyan'
Write-Host ""
$urls = @($keys | ForEach-Object { "$Base/$($Plugins[$_]).tgz" })
& dsh plugin --profile $Profile add @urls

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Say "  [x] 安装没成功。" 'Red'
  Say "      常见原因：" 'Red'
  Say "        · 网络不通    →  挂上代理 / 梯子，再双击 install.cmd 试一次"
  Say "        · DSH 有问题  →  打开命令行敲 dsh --version，看有没有反应"
  Write-Host ""
  exit 1
}

Write-Host ""
Say "  ============================================" 'Green'
Say "    ✅ 装好了！" 'Green'
Say "  ============================================" 'Green'
Write-Host ""
Say "  接下来两步（第 2 步不能省）："
Say "    1. 重启 DSH"
Say "    2. 设置 → Fairy → 打开「启用」"
Write-Host ""
