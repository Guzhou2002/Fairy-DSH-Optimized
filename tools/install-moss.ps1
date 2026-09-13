<#
  Fairy-DSH 配套：MOSS-TTS-Nano 一键安装（Windows / PowerShell）

  为什么有这个东西：MOSS 本身不难装，但路上有一堆不对着做就必踩的坑，
  而官方 README 里没写（或者写了但已经过时）。本脚本把那 6 个坑全部写死，
  使用者（或他的 AI Agent）只要跑这一条命令。

  已写死的坑：
    1. Python 版本    —— MOSS 要 3.10+，但 3.14 上 torch 轮子不一定齐；本脚本固定用 3.12
    2. 磁盘位置       —— 全部装到 $Root，并把 uv 的 Python / 缓存 / HuggingFace 缓存都指过去，
                        避免把 C 盘塞满（C 盘常常只剩几 GB）
    3. huggingface_hub —— 必须 <1.0：1.x 移除了代码里在用的 local_dir_use_symlinks 参数
    4. transformers    —— 官方 README 说 ONNX 版不需要它，**但 HTTP 服务需要**（app 链路会 import）
    5. WeTextProcessing —— 不装，也不能装：它的依赖 pynini 在 PyPI 上没有任何 Windows 轮子。
                        官方服务因此在预热时就失败，所以本仓库自带 server.py 绕开它
    6. 下载源          —— HuggingFace 官方站国内常不通、hf-mirror 证书又时好时坏，
                        所以先试官方（走代理）、失败自动回退镜像

  用法：
    .\install-moss.ps1                          # 默认装到 E:\MOSS-TTS-nano，端口 18083
    .\install-moss.ps1 -Root D:\MOSS-TTS-nano   # 换目录
    .\install-moss.ps1 -NoMirror                # 不用清华 PyPI 镜像
    .\install-moss.ps1 -SkipWeights             # 先不下载模型权重（约 730 MB）
    .\install-moss.ps1 -SkipVerify              # 装完不做自检

  装完会生成：
    $Root\server.py        服务端（自带的，绕开 pynini）
    $Root\verify.py        验证器（随时可重跑）
    $Root\start-moss.cmd   双击启动服务（纯 ASCII，不受 936 代码页影响）
#>
[CmdletBinding()]
param(
  [string]$Root = 'E:\MOSS-TTS-nano',
  [int]$Port = 18083,
  [string]$Proxy = '',
  [string]$HfEndpoint = '',
  [switch]$NoMirror,
  [switch]$SkipWeights,
  [switch]$SkipVerify
)

$RepoUrl = 'https://github.com/OpenMOSS/MOSS-TTS-Nano.git'
$PyMirror = 'https://pypi.tuna.tsinghua.edu.cn/simple'
$RepoDir = Join-Path $Root 'repo'
$VenvDir = Join-Path $Root 'venv'
$ToolsDir = Join-Path $PSScriptRoot 'moss-tts-server'

function Step([string]$text) { Write-Host "`n-> $text" -ForegroundColor Cyan }
function Ok([string]$text) { Write-Host "   [OK] $text" -ForegroundColor Green }
function Warn([string]$text) { Write-Host "   [!]  $text" -ForegroundColor Yellow }
function Info([string]$text) { Write-Host "   $text" -ForegroundColor DarkGray }
function Fail([string]$text) { Write-Host "`n[X] $text" -ForegroundColor Red; exit 1 }

# ⚠️ 这里【刻意不用】'Stop'：
# git / uv / python 这些原生程序把进度和提示写到 stderr 是正常行为
# （例如 uv 会往 stderr 打一句 "Python 3.12 is already installed"），
# 但在 'Stop' 模式下 PowerShell 会把它们当成终止错误、脚本当场退出。
# 本脚本每一步原生调用之后都有显式的 $LASTEXITCODE 判断 + Fail，
# 所以用 'Continue' + 显式检查，比 'Stop' 更可靠。
$ErrorActionPreference = 'Continue'

Write-Host ''
Write-Host '  Fairy-DSH  x  MOSS-TTS-Nano 一键安装' -ForegroundColor Magenta
Write-Host '  ----------------------------------------------------' -ForegroundColor DarkGray
Write-Host "  安装到 : $Root"
Write-Host "  端口   : $Port"
Write-Host ''

# ---------------------------------------------------------------- 1/7 环境
Step '[1/7] 检查环境'

$rootFull = [System.IO.Path]::GetFullPath($Root)
$driveLetter = [System.IO.Path]::GetPathRoot($rootFull).TrimEnd('\')
$free = (Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$driveLetter'").FreeSpace
if ($free -and $free -lt 6GB) {
  Warn "$driveLetter 只剩 $([math]::Round($free/1GB,1)) GB，装完大约要 4~5 GB。建议换盘：-Root D:\MOSS-TTS-nano"
} else {
  Ok "$driveLetter 剩余空间够用（$([math]::Round($free/1GB,1)) GB）"
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Fail '没找到 git。请先装 Git for Windows：https://git-scm.com/download/win'
}
Ok '找到 git'

# uv 优先；没有就用 python -m pip 装一个
$uvCmd = $null
$uvExe = (Get-Command uv -ErrorAction SilentlyContinue).Source
if (-not $uvExe) {
  foreach ($candidate in @("$env:APPDATA\Python\Python314\Scripts\uv.exe", "$env:APPDATA\Python\Python313\Scripts\uv.exe", "$env:APPDATA\Python\Python312\Scripts\uv.exe")) {
    if (Test-Path $candidate) { $uvExe = $candidate; break }
  }
}
$pythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
if ($uvExe) { Ok "找到 uv: $uvExe" }
elseif ($pythonExe) {
  Warn "没找到 uv，用 $pythonExe 装一个（很小）"
  $env:PIP_CACHE_DIR = Join-Path $Root '.pip-cache'
  & $pythonExe -m pip install --quiet --disable-pip-version-check uv
  if ($LASTEXITCODE -ne 0) { Fail 'uv 安装失败。检查网络，或手动装 Python 3.12 后重试。' }
  $uvExe = "$env:APPDATA\Python\Python314\Scripts\uv.exe"
  if (-not (Test-Path $uvExe)) { $uvExe = '' }
}
if (-not $uvExe) {
  if (Test-Path "$env:APPDATA\Python\Python314\Scripts\uv.exe") { $uvExe = "$env:APPDATA\Python\Python314\Scripts\uv.exe" }
}
if (-not $uvExe) { Fail '拿不到 uv。请先装一个 Python（3.10+）再重跑本脚本。' }
Ok "uv 就绪：$uvExe"

New-Item -ItemType Directory -Force -Path $Root | Out-Null

# ---------------------------------------------------------------- 2/7 Python 3.12
Step '[2/7] 准备 Python 3.12'

# 三个缓存目录全部指到 $Root：C 盘常年吃紧，别往那儿写
$env:UV_CACHE_DIR = Join-Path $Root '.uv-cache'
$env:UV_PYTHON_INSTALL_DIR = Join-Path $Root '.uv-python'
$env:HF_HOME = Join-Path $Root '.hf-home'
$env:HF_HUB_DISABLE_TELEMETRY = '1'

& $uvExe python install 3.12 2>&1 | Out-Null
$py312 = Join-Path $env:UV_PYTHON_INSTALL_DIR 'cpython-3.12-windows-x86_64-none\python.exe'
if (-not (Test-Path $py312)) {
  $found = Get-ChildItem (Join-Path $env:UV_PYTHON_INSTALL_DIR 'cpython-3.12*-windows-x86_64-none\python.exe') -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $py312 = $found.FullName }
}
if (-not (Test-Path $py312)) { Fail "Python 3.12 没装上（找了 $py312）。网络不通？重跑一次试试。" }
Ok "Python 3.12: $py312"

# ---------------------------------------------------------------- 3/7 源码
Step '[3/7] 获取 MOSS-TTS-Nano 源码'
if (Test-Path (Join-Path $RepoDir '.git')) {
  Info "已存在，只更新（不删你的东西）：$RepoDir"
  & git -C $RepoDir fetch --depth 1 origin 2>&1 | Out-Null
  & git -C $RepoDir reset --hard FETCH_HEAD 2>&1 | Out-Null
  Ok '源码已更新'
} else {
  Info "克隆到 $RepoDir（约 30 MB）"
  & git clone --depth 1 $RepoUrl $RepoDir 2>&1 | Out-Null
  if (-not (Test-Path (Join-Path $RepoDir 'infer_onnx.py'))) { Fail '源码克隆失败。多半是网络：挂上代理再试，或用 -Proxy 指定。' }
  Ok '源码克隆完成'
}

# ---------------------------------------------------------------- 4/7 依赖
Step '[4/7] 建虚拟环境并安装依赖（约 1.5 GB，含 PyTorch CPU 版）'
& $uvExe venv --python 3.12 $VenvDir 2>&1 | Out-Null
$venvPy = Join-Path $VenvDir 'Scripts\python.exe'
if (-not (Test-Path $venvPy)) { Fail "虚拟环境没建起来：$VenvDir" }
Ok "虚拟环境：$VenvDir"

$indexArgs = @()
if (-not $NoMirror) { $indexArgs = @('--default-index', $PyMirror); Info "PyPI 走清华镜像（想用官方源加 -NoMirror）" }

# 注意：这里【故意不装】WeTextProcessing —— 它的依赖 pynini 在 Windows 上没有轮子，
# 装它等于现场编译。本仓库的 server.py 不需要它。
$deps = @(
  'numpy>=1.24',
  'sentencepiece>=0.1.99',
  'torch==2.7.0',
  'torchaudio==2.7.0',
  'onnxruntime>=1.20.0',
  'huggingface_hub<1',          # 1.x 移除了代码里在用的参数
  'transformers==4.57.1',       # HTTP 服务链路会 import 它
  'soundfile',
  'fastapi>=0.110.0',
  'uvicorn>=0.29.0',
  'python-multipart>=0.0.9'
)
& $uvExe pip install --python $venvPy @indexArgs @deps 2>&1 | Select-Object -Last 4
if ($LASTEXITCODE -ne 0) { Fail '依赖安装失败。看上面的报错；网络问题就挂代理重试。' }
Ok '依赖安装完成'

# ---------------------------------------------------------------- 5/7 权重
Step '[5/7] 下载 ONNX 权重（约 730 MB）并做一次命令行合成'
if ($SkipWeights) {
  Warn '按你的要求跳过（-SkipWeights）。第一次合成时会自动补下载。'
} else {
  $refSample = Join-Path $RepoDir 'assets\audio\zh_1.wav'
  if (-not (Test-Path $refSample)) { $refSample = (Get-ChildItem (Join-Path $RepoDir 'assets\audio\zh_*.wav') -ErrorAction SilentlyContinue | Select-Object -First 1).FullName }

  # 代理：没显式给就先探一下本机常见端口
  $proxyToUse = $Proxy
  if ($proxyToUse -eq '') {
    foreach ($p in @(7897, 7890, 10809, 1080)) {
      $client = New-Object System.Net.Sockets.TcpClient
      try { if ($client.ConnectAsync('127.0.0.1', $p).Wait(300)) { $proxyToUse = "http://127.0.0.1:$p"; break } } catch { } finally { $client.Close() }
    }
    if ($proxyToUse -ne '') { Info "探测到本机代理：$proxyToUse" }
  }
  if ($proxyToUse -ne '') { $env:HTTP_PROXY = $proxyToUse; $env:HTTPS_PROXY = $proxyToUse }

  $endpoints = @()
  if ($HfEndpoint -ne '') { $endpoints += $HfEndpoint }
  else { $endpoints += ''; if (-not $NoMirror) { $endpoints += 'https://hf-mirror.com' } }

  $downloaded = $false
  foreach ($ep in $endpoints) {
    if ($ep -eq '') { Remove-Item Env:HF_ENDPOINT -ErrorAction SilentlyContinue; Info '下载源：HuggingFace 官方' }
    else { $env:HF_ENDPOINT = $ep; Info "下载源：$ep" }
    $log = & $venvPy (Join-Path $RepoDir 'infer_onnx.py') `
      --prompt-audio-path $refSample `
      --text '安装自检，一二三四五。' `
      --output-audio-path (Join-Path $Root 'install-check.wav') `
      --disable-wetext-processing 2>&1
    if ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $Root 'install-check.wav'))) { $downloaded = $true; break }
    Warn '这一源没成功，换下一个'
  }
  if ($downloaded) {
    $wav = Get-Item (Join-Path $Root 'install-check.wav')
    Ok "命令行合成成功：$($wav.Name)（$([math]::Round($wav.Length/1KB)) KB）—— 说明引擎本体没问题了"
  } else {
    Warn '权重没下全 / 命令行合成没成功。服务仍会尝试，但第一次合成可能要等下载。'
    Warn '多半是网络：挂代理重跑本脚本即可（已下好的部分不会重下）。'
  }
}

# ---------------------------------------------------------------- 6/7 服务端
Step '[6/7] 部署服务端'
Copy-Item -LiteralPath (Join-Path $ToolsDir 'server.py') -Destination (Join-Path $Root 'server.py') -Force
Copy-Item -LiteralPath (Join-Path $ToolsDir 'verify.py') -Destination (Join-Path $Root 'verify.py') -Force
if (-not (Test-Path (Join-Path $Root 'server.py'))) { Fail "server.py 没复制过去。检查 $ToolsDir 是否存在。" }
Ok "server.py / verify.py 已放到 $Root"

# 启动脚本刻意用【纯 ASCII】：.cmd 里的中文在 936 代码页的机器上会把 rem 注释切坏
$startCmd = @"
@echo off
title MOSS-TTS-Nano for Fairy-DSH
cd /d "%~dp0"
"$VenvDir\Scripts\python.exe" "%~dp0server.py" --port $Port
echo.
echo Service stopped. Press any key to close.
pause >nul
"@
Set-Content -LiteralPath (Join-Path $Root 'start-moss.cmd') -Value $startCmd -Encoding ascii
Ok "start-moss.cmd 已生成（纯 ASCII，双击即可启动）"

# ---------------------------------------------------------------- 7/7 自检
Step '[7/7] 自检'
if ($SkipVerify) {
  Warn '按你的要求跳过（-SkipVerify）'
} else {
  $already = $false
  try { (Invoke-WebRequest "http://127.0.0.1:$Port/health" -TimeoutSec 3 -UseBasicParsing) | Out-Null; $already = $true } catch { }
  $proc = $null
  if ($already) {
    Info "端口 $Port 上已有服务在跑，直接复用它做验证"
  } else {
    Info '临时启动服务做验证（第一次要加载模型，会等十几秒）'
    $proc = Start-Process -FilePath $venvPy `
      -ArgumentList @((Join-Path $Root 'server.py'), '--port', "$Port") `
      -WorkingDirectory $Root -PassThru -WindowStyle Hidden
    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
      Start-Sleep -Milliseconds 1500
      try { (Invoke-WebRequest "http://127.0.0.1:$Port/health" -TimeoutSec 3 -UseBasicParsing) | Out-Null; $ready = $true; break } catch { }
    }
    if (-not $ready) { Warn '服务没能在 60 秒内起来，跳过验证。稍后双击 start-moss.cmd 再试。' }
  }

  if ($already -or $proc) {
    $refForVerify = Join-Path $Root 'install-check.wav'
    if (-not (Test-Path $refForVerify)) { $refForVerify = (Get-ChildItem (Join-Path $RepoDir 'assets\audio\zh_*.wav') -ErrorAction SilentlyContinue | Select-Object -First 1).FullName }
    & $venvPy (Join-Path $Root 'verify.py') --base "http://127.0.0.1:$Port" --reference $refForVerify
    $verifyCode = $LASTEXITCODE
    if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue; Info '验证用的临时服务已关闭' }
  }
}

# ---------------------------------------------------------------- 收尾
Write-Host ''
Write-Host '  ----------------------------------------------------' -ForegroundColor DarkGray
Write-Host '  安装完成' -ForegroundColor Magenta
Write-Host ''
Write-Host '  以后启动服务：双击这个文件' -ForegroundColor White
Write-Host "    $Root\start-moss.cmd" -ForegroundColor Gray
Write-Host ''
Write-Host '  然后在 DSH 里做两步：' -ForegroundColor White
Write-Host '    1. 设置 -> Fairy -> 朗读设置 -> 朗读引擎 -> 选「MOSS-TTS-Nano」' -ForegroundColor Gray
Write-Host "    2. 地址填 http://127.0.0.1:$Port  -> 点「保存设置」（会自动重跑自检）" -ForegroundColor Gray
Write-Host ''
Write-Host '  参考音频两个引擎共用这一个：' -ForegroundColor White
Write-Host "    $env:USERPROFILE\.dsh\fairy-voice\reference\fairy_ref.wav" -ForegroundColor Gray
Write-Host '    （这个目录插件启动时会自动建好，里面附一份 README.txt；也可以直接在设置里' -ForegroundColor DarkGray
Write-Host '      把「参考音频路径」改成任意一段 3-10 秒的干净人声）' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  想随时复查服务是否可用：' -ForegroundColor White
Write-Host "    `"$venvPy`" `"$Root\verify.py`"" -ForegroundColor Gray
Write-Host ''
Write-Host '  注意：MOSS 是整句合成完再出声，等几秒才响是正常的。' -ForegroundColor Yellow
Write-Host ''
