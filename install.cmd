@echo off
chcp 936 >nul
title Fairy-DSH 安装 / 更新
setlocal

rem ---------------------------------------------------------------
rem Fairy-DSH 安装 / 更新（单文件版）
rem
rem 双击即可。它同时是安装器、更新器和修复器：
rem   没装过      -> 装上
rem   已是最新    -> 提示，不重复下载
rem   有新版      -> 更新到最新
rem   装坏了      -> 修好（用的是永久地址，会重新拉取）
rem
rem ===============================================================
rem 【改这个文件之前必读】编码约定：
rem
rem   本文件必须是 GBK 编码 + 全 CRLF + 无 BOM，第 2 行是 chcp 936。
rem
rem   千万不要存成 UTF-8！UTF-8 的中文在 936 代码页下会让 cmd 认错
rem   行尾换行符，于是 rem 注释行被从中间切开当成命令执行，
rem   满屏报 is not recognized（群友真机实测踩过，排查了很久）。
rem
rem   也不要用 GBK 存不下的字符（emoji、特殊符号等）。
rem ===============================================================

set "BASE=https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download"
set "PROFILE=web"
if not "%~1"=="" set "PROFILE=%~1"

echo.
echo   ============================================
echo     Fairy-DSH 安装 / 更新
echo   ============================================
echo     装到 profile : %PROFILE%
echo     一共 4 步，需要联网，大约 1 到 3 分钟
echo     中途请不要关闭这个窗口
echo   ============================================
echo.

rem ============ [1/4] 检查环境 ============
echo   [1/4] 检查环境...
where pnpm >nul 2>nul
if errorlevel 1 goto nopnpm
where dsh >nul 2>nul
if errorlevel 1 goto nodsh
echo         没问题，继续。
echo.

rem ============ [2/4] 下载并安装插件 ============
:step2
echo   [2/4] 下载并安装 5 个插件...
echo.
echo         下面会刷一大段 pnpm 的输出，不用看懂。
echo         网络慢的时候会卡一会儿，这是正常的。
echo.
rem 必须用 call！dsh 是 npm 生成的 dsh.cmd，批处理里不加 call 调用
rem 另一个 .cmd，当前脚本会直接把控制权交出去、永不返回，
rem 后面的人设预设步骤就永远执行不到（实测踩过）。
call dsh plugin --profile %PROFILE% add ^
  "%BASE%/dsh-fairy-visual.tgz" ^
  "%BASE%/dsh-fairy-voice.tgz" ^
  "%BASE%/dsh-balance-meter.tgz" ^
  "%BASE%/dsh-browser-dock.tgz" ^
  "%BASE%/dsh-fairy-startup.tgz"
if errorlevel 1 goto fail
echo.
echo         插件装好了。
echo.

rem ============ [3/4] 安装人设预设 ============
rem 预设放在插件包内（跟着包一起分发），但 DSH 是从 %DSH_HOME%\.agent-presets\ 读的，
rem 所以要复制一份过去。
set "DSHH=%DSH_HOME%"
if "%DSHH%"=="" set "DSHH=%USERPROFILE%\.dsh"
set "PRESET_SRC=%DSHH%\profiles\%PROFILE%\node_modules\dsh-fairy-visual\.agent-presets\fairy"
set "PRESET_DST=%DSHH%\.agent-presets\fairy"

if not exist "%PRESET_SRC%\preset.yml" goto nopreset
echo   [3/4] 安装 Fairy 人设预设...
rem 必须用 robocopy /E（合并语义）。不要换成 PowerShell 的 Copy-Item，
rem 目标目录已存在时它会往里再套一层，历史上就是这么套出
rem .agent-presets\fairy\fairy\ 的。
if not exist "%DSHH%\.agent-presets" mkdir "%DSHH%\.agent-presets"
robocopy "%PRESET_SRC%" "%PRESET_DST%" /E /NFL /NDL /NJH /NJS /NP >nul
echo         已装到 %PRESET_DST%
goto ok

:nopreset
echo   [3/4] 插件包里没有人设预设，跳过这一步（不影响插件本身）
goto ok

rem ============ [4/4] 完成 ============
:ok
echo.
echo   ============================================
echo     [4/4] 全部装好了
echo   ============================================
echo.
echo     怎么确认真的装上了：
echo       1) 重启 DSH（关掉再打开）
echo       2) 打开 设置 - Fairy，把最上面的“启用”打开
echo          不开这个开关，朗读控件不会出现
echo       3) 设置里能看到 Fairy 这一栏，就说明装上了
echo.
echo     想用 Fairy 人设的话：
echo       设置 - Fairy，把“Fairy 人设预设”开关打开
echo.
echo     如果重启后设置里找不到 Fairy：
echo       把本窗口的内容拍下来发到群里，会有人帮你看
echo.
pause
exit /b 0

rem ============ 失败分支 ============

:nopnpm
echo.
echo   [1/4] 环境检查：缺少一个小工具，叫 pnpm
echo.
echo     ---- 这是怎么回事 ----
echo     pnpm 是装插件要用的小工具，装一次就永久有了，
echo     不会影响你电脑上的其他软件。
echo.
echo     ---- 现在怎么做 ----
echo     下面会自动帮你装。装好后本文件会自己继续往下跑，
echo     不用你再双击一次。
echo.
choice /c YN /n /m "     现在自动帮你装吗？（Y = 装 / N = 退出） "
if errorlevel 2 goto bye
echo.
echo         正在装 pnpm，请等十几秒...
echo.
call npm install -g pnpm
if errorlevel 1 goto npmfail
echo         装好了，继续。
echo.
goto step2

:npmfail
echo.
echo   [1/4] pnpm 没能自动装上
echo.
echo     ---- 现在怎么做（照着敲就行）----
echo     1) 按 Win 键 + R，输入 cmd，回车，打开黑色窗口
echo     2) 把下面这条命令复制进去，回车：
echo.
echo             npm install -g pnpm
echo.
echo     3) 看到 added 1 package 之类的字样，就是装成功了
echo     4) 再重新双击本文件
echo.
echo     ---- 如果提示 npm 不是内部或外部命令 ----
echo     说明你电脑上还没装 Node.js。
echo     打开 nodejs.org 下载 LTS 版，一路点下一步装好，
echo     装完关掉所有命令行窗口，再重新双击本文件。
echo.
pause
exit /b 1

:nodsh
echo.
echo   [1/4] 环境检查：找不到 dsh 命令
echo.
echo     ---- 说明什么 ----
echo     这台电脑上没装 DSH，或者刚装完还没重启命令行。
echo.
echo     ---- 现在怎么做 ----
echo     1) 确认 DSH 已经装好并且能正常打开
echo     2) 关掉本窗口，重新双击一次试试
echo     3) 还是不行：打开命令行敲 dsh --version，
echo        把结果拍照发到群里
echo.
pause
exit /b 1

:fail
echo.
echo   ============================================
echo     [2/4] 插件安装失败
echo   ============================================
echo.
echo     最常见的原因：网络连不上 GitHub
echo     （国内直连 GitHub 经常慢或者超时）
echo.
echo     ---- 现在怎么做 ----
echo     1) 挂上代理或梯子，再重新双击本文件
echo     2) 已经有梯子的，确认它开的是“全局模式”
echo     3) 网络慢就多等一会儿，别关窗口
echo.
echo     ---- 怎么确认是不是网络问题 ----
echo     把下面这个地址复制到浏览器打开看看：
echo.
echo         %BASE%/dsh-fairy-visual.tgz
echo.
echo         能下载 = 网络没问题，那就把本窗口拍照发群里
echo         打不开 = 就是网络问题，挂上代理再来一次
echo.
pause
exit /b 1

:bye
exit /b 0
