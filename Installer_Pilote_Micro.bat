@echo off
REM FreePad Installation Pilote Micro Direct APO - Fait par zioti
title FreePad - Installation du Pilote Micro Direct APO - Fait par zioti
cd /d "%~dp0"

set "PS_EXE=powershell.exe"
if exist "%WINDIR%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" (
    set "PS_EXE=%WINDIR%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
)

"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\install_apo.ps1"

echo.
pause
