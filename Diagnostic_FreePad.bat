@echo off
REM FreePad Diagnostic et Reparation Micro - Fait par zioti
title FreePad - Diagnostic et Reparation Micro - Fait par zioti
cd /d "%~dp0"

set "PS_EXE=powershell.exe"
if exist "%WINDIR%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" (
    set "PS_EXE=%WINDIR%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
)

"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Diagnostic_FreePad.ps1"

echo.
pause
