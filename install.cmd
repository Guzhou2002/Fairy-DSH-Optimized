@echo off
rem Fairy-DSH installer (double-click friendly)
rem ASCII-only on purpose: cmd.exe mis-parses non-ASCII lines on some Windows setups.
setlocal
cd /d "%~dp0"
title Fairy-DSH installer
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
set RC=%ERRORLEVEL%
if not "%RC%"=="0" (
  echo.
  echo [ERROR] install.ps1 exited with code %RC%
  echo.
  pause
)
endlocal
