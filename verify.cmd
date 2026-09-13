@echo off
rem Fairy-DSH isolated verification launcher (double-click friendly)
rem ASCII-only on purpose: cmd.exe mis-parses non-ASCII lines on some Windows setups.
rem All user-facing text (Chinese) lives in verify-isolated.ps1, which is UTF-8 with BOM.
setlocal
cd /d "%~dp0"
title Fairy-DSH verify
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-isolated.ps1" %*
set RC=%ERRORLEVEL%
echo.
if not "%RC%"=="0" echo [WARN] verify-isolated.ps1 exited with code %RC%
pause
endlocal
