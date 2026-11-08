@echo off
chcp 65001 >nul
title FreePad — Outil de Diagnostic et Réparation Micro — Fait par zioti
cd /d "%~dp0"

:: Vérification des droits administrateur
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Demande d'élévation Administrateur Windows (UAC)...
    if exist "%WINDIR%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" (
        "%WINDIR%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -Verb RunAs -ArgumentList '/c `"`"%~f0`"`"'"
    ) else (
        powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -Verb RunAs -ArgumentList '/c `"`"%~f0`"`"'"
    )
    exit /b
)

if exist "%WINDIR%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" (
    "%WINDIR%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Diagnostic_FreePad.ps1"
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Diagnostic_FreePad.ps1"
)
echo.
pause
