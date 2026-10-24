@echo off
chcp 65001 >nul
title FreePad — Installation du Pilote Micro Direct (APO)
cd /d "%~dp0"

:: Vérification des droits administrateur
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Demande d'élévation Administrateur Windows (UAC)...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -Verb RunAs -ArgumentList '/c `"`"%~f0`"`"'"
    exit /b
)

echo ==========================================================
echo        INSTALLATEUR DU PILOTE MICRO DIRECT FREEPAD
echo ==========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\install_apo.ps1"
echo.
pause
