@echo off
rem Fairy-DSH installer launcher (double-click friendly)
rem ASCII-only on purpose: cmd.exe mis-parses non-ASCII lines on some Windows setups.
rem All user-facing text (Chinese) lives in install.ps1, which is UTF-8 with BOM.
setlocal
cd /d "%~dp0"
title Fairy-DSH installer
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
set RC=%ERRORLEVEL%
echo.
if not "%RC%"=="0" echo [ERROR] install.ps1 exited with code %RC%
pause
endlocal
