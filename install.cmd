@echo off
chcp 65001 >nul
title Fairy-DSH 安装 / 更新
setlocal

rem ---------------------------------------------------------------
rem Fairy-DSH 安装 / 更新（单文件版，0.3.0 起）
rem
rem 双击即可。它同时是安装器、更新器和修复器：
rem   没装过      -> 装上
rem   已是最新    -> 提示，不重复下载
rem   有新版      -> 更新到最新
rem   装坏了      -> 修好（因为用的是永久地址，重新拉取）
rem
rem 做三件事：
rem   ① 检查 pnpm，缺了就问一声再帮你装
rem   ② 用 DSH 官方命令装 5 个插件（dsh plugin add）
rem   ③ 把插件包里的人设预设复制到 %DSH_HOME%\.agent-presets\
rem
rem 用法：
rem   双击                      -> 装到 web profile
rem   install.cmd 我的profile   -> 装到指定 profile
rem
rem 编码说明：全局 UTF-8 无 BOM + 全 CRLF，开头 chcp 65001 让 cmd.exe 正常解析中文。
rem   （.gitattributes 里 *.cmd 标了 -text，所以 git 存储与工作区都保持 CRLF）
rem 原理与实测见 docs\安装机制实测.md
rem ---------------------------------------------------------------

set "BASE=https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download"
set "PROFILE=web"
if not "%~1"=="" set "PROFILE=%~1"

echo.
echo   Fairy-DSH 安装 / 更新
echo   --------------------------------------------
echo   profile : %PROFILE%
echo   --------------------------------------------
echo.

rem ---------- ① 检查 pnpm ----------
where pnpm >nul 2>nul
if not errorlevel 1 goto install

echo   [!] 你的电脑上少一个小工具，叫 pnpm。
echo       装插件必须用到它。装一次就行，以后不用再管，
echo       也不会影响你电脑上的其他东西。
echo.
choice /c YN /n /m "      现在帮你装吗？（Y = 装 / N = 退出） "
if errorlevel 2 goto bye

echo.
echo       正在装 pnpm，请等十几秒...
echo.
call npm install -g pnpm
if errorlevel 1 goto pnpmfail
echo       装好了。
echo.

:install
echo   正在安装插件（要联网，可能要几分钟）...
echo   下面这段是 pnpm 的输出，带版本号的那几行就是刚装上的版本。
echo.
dsh plugin --profile %PROFILE% add ^
  "%BASE%/dsh-fairy-visual.tgz" ^
  "%BASE%/dsh-fairy-voice.tgz" ^
  "%BASE%/dsh-balance-meter.tgz" ^
  "%BASE%/dsh-browser-dock.tgz" ^
  "%BASE%/dsh-fairy-startup.tgz"
if errorlevel 1 goto fail

rem ---------- ③ 安装 Fairy 人设预设 ----------
rem 预设放在插件包内（这样它能跟着包一起分发），但 DSH 是从 %DSH_HOME%\.agent-presets\ 读的，
rem 所以要复制一份过去。
rem 必须用 robocopy /E（合并语义）。不要换成 PowerShell 的 Copy-Item ——
rem 目标目录已存在时它会往里再套一层，历史上就是这么套出 .agent-presets\fairy\fairy\ 的。
set "DSHH=%DSH_HOME%"
if "%DSHH%"=="" set "DSHH=%USERPROFILE%\.dsh"
set "PRESET_SRC=%DSHH%\profiles\%PROFILE%\node_modules\dsh-fairy-visual\.agent-presets\fairy"
set "PRESET_DST=%DSHH%\.agent-presets\fairy"

if not exist "%PRESET_SRC%\preset.yml" goto nopreset
echo.
echo   正在安装 Fairy 人设预设...
if not exist "%DSHH%\.agent-presets" mkdir "%DSHH%\.agent-presets"
robocopy "%PRESET_SRC%" "%PRESET_DST%" /E /NFL /NDL /NJH /NJS /NP >nul
echo   已装到 %PRESET_DST%
goto ok

:nopreset
echo.
echo   [!] 插件包里没找到人设预设，跳过这一步（不影响插件本身）。

:ok
echo.
echo   ============================================
echo     ✅ 装好了！
echo   ============================================
echo.
echo   接下来三步：
echo     1. 重启 DSH
echo     2. 设置 → Fairy → 打开「启用」
echo     3. 设置 → Fairy → 打开「Fairy 人设预设」开关（想用 Fairy 人设的话）
echo.
pause
exit /b 0

:pnpmfail
echo.
echo   [x] pnpm 没装上。
echo       请手动运行下面这条命令，然后重新双击本文件：
echo.
echo           npm install -g pnpm
echo.
pause
exit /b 1

:fail
echo.
echo   [x] 安装没成功。常见原因：
echo       · 网络不通  →  挂上代理 / 梯子，再双击本文件试一次
echo       · DSH 有问题  →  打开命令行敲 dsh --version，看有没有反应
echo.
pause
exit /b 1

:bye
exit /b 0
