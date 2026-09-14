@echo off
rem Fairy-DSH uninstall launcher (double-click friendly)
rem ASCII-only on purpose: cmd.exe mis-parses non-ASCII lines on some Windows setups.
rem All user-facing text (Chinese) lives in uninstall.ps1, which is UTF-8 with BOM.
setlocal
cd /d "%~dp0"
title Fairy-DSH uninstall
if not exist "%~dp0uninstall.ps1" (
  echo [X] uninstall.ps1 not found next to this file.
  echo     Please keep uninstall.cmd and uninstall.ps1 in the same folder.
  pause
  endlocal
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1" %*
set RC=%ERRORLEVEL%
echo.
if not "%RC%"=="0" echo [WARN] uninstall.ps1 exited with code %RC%
pause
endlocal
