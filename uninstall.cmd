@echo off
rem Fairy-DSH uninstaller (double-click friendly)
rem ASCII-only on purpose: cmd.exe mis-parses non-ASCII lines on some Windows setups.
setlocal
cd /d "%~dp0"
title Fairy-DSH uninstaller
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1" %*
set RC=%ERRORLEVEL%
if not "%RC%"=="0" (
  echo.
  echo [ERROR] uninstall.ps1 exited with code %RC%
  echo.
  pause
)
endlocal
