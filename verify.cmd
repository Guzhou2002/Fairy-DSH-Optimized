@echo off
rem Fairy-DSH isolated verification (double-click friendly)
rem ASCII-only on purpose: cmd.exe mis-parses non-ASCII lines on some Windows setups.
setlocal
cd /d "%~dp0"
title Fairy-DSH verify
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-isolated.ps1" %*
set RC=%ERRORLEVEL%
if not "%RC%"=="0" (
  echo.
  echo [WARN] verify-isolated.ps1 exited with code %RC%
  echo.
  pause
)
endlocal
