@echo off
title FreePad - Diagnostic et Reparation Micro - Fait par zioti
setlocal

set "PS_EXE=powershell.exe"
if exist "%WINDIR%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" (
    set "PS_EXE=%WINDIR%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
)

"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -Command "$p='%~f0'; $lines = [System.IO.File]::ReadAllLines($p); $idx = [array]::IndexOf($lines, '###START_PS###'); if ($idx -ge 0) { $code = ($lines[($idx + 1)..($lines.Length - 1)] -join [Environment]::NewLine); $tmp = [System.IO.Path]::Combine($env:TEMP, 'Diagnostic_FreePad.ps1'); [System.IO.File]::WriteAllText($tmp, $code); & $env:PS_EXE -NoProfile -ExecutionPolicy Bypass -File $tmp } else { Write-Host 'Payload introuvable' }"

echo.
pause
exit /b
###START_PS###
<#
    .SYNOPSIS
    Diagnostic et Reparation Automatique du Pilote Micro Direct FreePad (APO)
    Fait par zioti - 100% Zero VB-Cable
#>

param(
    [switch]$Fix
)

$ErrorActionPreference = "Continue"

# Verification des droits admin (necessaire uniquement pour -Fix)
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($Fix -and -not $isAdmin) {
    $psExe = if ([Environment]::Is64BitOperatingSystem -and -not [Environment]::Is64BitProcess -and (Test-Path "$env:WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe")) {
        "$env:WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
    } else {
        "powershell.exe"
    }
    Start-Process -FilePath $psExe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Fix" -Verb RunAs
    exit 0
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "       DIAGNOSTIC COMPLET DU PILOTE MICRO DIRECT FREEPAD (APO)                  " -ForegroundColor Yellow
Write-Host "                           (Fait par zioti)                                     " -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

$issuesFound = @()
$warnings = @()

# C# COM Interop pour obtenir le VRAI microphone actif par defaut
$audioComCode = @'
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
internal class MMDeviceEnumeratorComObject { }

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr deviceCollection);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDevice {
    int Activate(ref Guid id, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object interfacePointer);
    int OpenPropertyStore(int stgmAccess, out IntPtr properties);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    int GetState(out int state);
}

public class FreePadAudioCom {
    public static string GetDefaultEndpointId(int dataFlow, int role) {
        try {
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            IMMDevice dev;
            int hr = enumerator.GetDefaultAudioEndpoint(dataFlow, role, out dev);
            if (hr == 0 && dev != null) {
                string id;
                dev.GetId(out id);
                return id;
            }
        } catch {}
        return null;
    }
}
'@

try {
    Add-Type -TypeDefinition $audioComCode -Language CSharp -ErrorAction SilentlyContinue
} catch {}

# --- TEST 1 : SERVICES AUDIO WINDOWS ---
Write-Host "[1/5] Verification des services audio Windows..." -ForegroundColor White
$srvAudio = Get-Service -Name "audiosrv" -ErrorAction SilentlyContinue
$srvBuilder = Get-Service -Name "AudioEndpointBuilder" -ErrorAction SilentlyContinue

if ($srvAudio -and $srvAudio.Status -eq "Running") {
    Write-Host "  [OK] audiosrv (Moteur audio Windows) est ACTIF." -ForegroundColor Green
} else {
    Write-Host "  [ERREUR] audiosrv n'est PAS en cours d'execution !" -ForegroundColor Red
    $issuesFound += "Le service audio Windows (audiosrv) est arrete."
}

if ($srvBuilder -and $srvBuilder.Status -eq "Running") {
    Write-Host "  [OK] AudioEndpointBuilder (Gestionnaire peripheriques) est ACTIF." -ForegroundColor Green
} else {
    Write-Host "  [ERREUR] AudioEndpointBuilder n'est PAS en cours d'execution !" -ForegroundColor Red
    $issuesFound += "Le service AudioEndpointBuilder est arrete."
}
Write-Host ""

# --- TEST 2 : DETECTION DU VRAI MICROPHONE PAR DEFAUT ---
Write-Host "[2/5] Detection de ton VRAI microphone actif par defaut..." -ForegroundColor White
$rawConsoleId = [FreePadAudioCom]::GetDefaultEndpointId(1, 0) # 1 = eCapture, 0 = eConsole
$rawCommId = [FreePadAudioCom]::GetDefaultEndpointId(1, 2)    # 1 = eCapture, 2 = eCommunications

# Extraire le GUID entre accolades {xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}
$consoleGuid = $null
$commGuid = $null
if ($rawConsoleId -match "\{([0-9a-fA-F\-]{36})\}") {
    $consoleGuid = "{$($Matches[1])}"
}
if ($rawCommId -match "\{([0-9a-fA-F\-]{36})\}") {
    $commGuid = "{$($Matches[1])}"
}

$baseCapture = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture"

function Get-DeviceFriendlyName($guid) {
    if (-not $guid) { return "Inconnu" }
    $p = Get-ItemProperty "$baseCapture\$guid\Properties" -ErrorAction SilentlyContinue
    $name = $p.'{a45c254e-df1c-4efd-8020-67d146a850e0},2'
    $hw = $p.'{b3f8fa53-0004-438e-9003-51a46e139bfc},6'
    if ($name -and $hw) { return "$name ($hw)" }
    if ($name) { return $name }
    if ($hw) { return $hw }
    return $guid
}

$consoleName = Get-DeviceFriendlyName $consoleGuid
$commName = Get-DeviceFriendlyName $commGuid

if ($consoleGuid) {
    Write-Host "  [OK] Micro Principal (Console / Standard) :" -ForegroundColor Green
    Write-Host "       Nom  : $consoleName" -ForegroundColor Cyan
    Write-Host "       GUID : $consoleGuid" -ForegroundColor DarkGray
} else {
    Write-Host "  [ATTENTION] Aucun micro principal par defaut detecte via CoreAudio." -ForegroundColor Yellow
    $warnings += "Aucun microphone par defaut detecte par CoreAudio."
}

if ($commGuid) {
    Write-Host "  [OK] Micro Communication (Discord / VoIP) :" -ForegroundColor Green
    Write-Host "       Nom  : $commName" -ForegroundColor Cyan
    Write-Host "       GUID : $commGuid" -ForegroundColor DarkGray
} else {
    Write-Host "  [ATTENTION] Aucun micro communication par defaut detecte." -ForegroundColor Yellow
}
Write-Host ""

# --- TEST 3 : VERIFICATION DU PILOTE APO SUR LE MICRO ACTIF ---
Write-Host "[3/5] Verification de l'injection du pilote APO FreePad sur ton micro..." -ForegroundColor White

$targetGuids = @()
if ($consoleGuid) { $targetGuids += $consoleGuid }
if ($commGuid -and ($targetGuids -notcontains $commGuid)) { $targetGuids += $commGuid }

if ($targetGuids.Count -eq 0) {
    Get-ChildItem $baseCapture -ErrorAction SilentlyContinue | ForEach-Object {
        $p = Get-ItemProperty $_.PSPath
        if (($p.DeviceState -band 0xF) -eq 1 -and $targetGuids.Count -lt 2) {
            $targetGuids += $_.PSChildName
        }
    }
}

$apoOk = $true
foreach ($tg in $targetGuids) {
    $devName = Get-DeviceFriendlyName $tg
    Write-Host "  -> Analyse de : $devName [$tg]" -ForegroundColor Yellow
    
    $fxKeyPath = "$baseCapture\$tg\FxProperties"
    if (-not (Test-Path $fxKeyPath)) {
        Write-Host "     [ERREUR] La cle FxProperties n'existe pas ou est inaccessible !" -ForegroundColor Red
        $issuesFound += "Le pilote n'est pas installe sur $devName (FxProperties manquant)."
        $apoOk = $false
        continue
    }

    $fxProp = Get-ItemProperty $fxKeyPath -ErrorAction SilentlyContinue
    $capVal = $fxProp.'{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},7'
    $commVal = $fxProp.'{d3993a3f-99c2-4402-b5ec-a92a0367664b},7'
    $disableFx = $fxProp.'{1da5d803-d01f-4d68-af3b-3051d1f69d5b},5'

    # Check 1: Filtre de capture principal
    if ($capVal -eq "{27384E53-9860-0AC3-9519-C60EBCAA2C71}") {
        Write-Host "     [OK] Filtre micro APO standard present ({27384E53-...})" -ForegroundColor Green
    } else {
        Write-Host "     [ERREUR] Filtre micro APO standard ABSENT sur ce micro !" -ForegroundColor Red
        $issuesFound += "Filtre standard absent sur $devName."
        $apoOk = $false
    }

    # Check 2: Filtre Discord / VoIP
    $hasCommApo = $false
    if ($commVal -is [array]) {
        if ($commVal -contains "{FC1CFC9B-B9D6-4CFA-B5E0-4BB2166878B2}") { $hasCommApo = $true }
    } elseif ($commVal -is [string]) {
        if ($commVal -like "*{FC1CFC9B-B9D6-4CFA-B5E0-4BB2166878B2}*") { $hasCommApo = $true }
    }
    if ($hasCommApo) {
        Write-Host "     [OK] Filtre Discord VoIP present ({FC1CFC9B-...})" -ForegroundColor Green
    } else {
        Write-Host "     [ATTENTION] Filtre Discord VoIP manquant sur ce micro !" -ForegroundColor Yellow
        $warnings += "Filtre Discord VoIP manquant sur $devName."
    }

    # Check 3: Ameliorations audio Windows (Disable_SysFx)
    if ($disableFx -eq 1) {
        Write-Host "     [BLOCAGE CRITIQUE] L'option 'Ameliorations audio' est DESACTIVEE sous Windows !" -ForegroundColor Red
        Write-Host "                        Windows bloque donc 100% des APO sur ce micro !" -ForegroundColor Red
        $issuesFound += "'Ameliorations audio' est desactivee sur $devName (bloque l'injection)."
    } else {
        Write-Host "     [OK] Ameliorations audio Windows actives." -ForegroundColor Green
    }
}

# Check 4: UniteFx CaptureDevices Registry
$uniteFxPath = "HKLM:\SOFTWARE\Leppsoft\UniteFx"
$uniteFx = Get-ItemProperty $uniteFxPath -ErrorAction SilentlyContinue
if ($uniteFx) {
    $devList = $uniteFx.CaptureDevices
    $inList = $false
    foreach ($tg in $targetGuids) {
        $cleanGuid = $tg.Trim('{}')
        if ($devList -like "*$cleanGuid*") { $inList = $true }
    }
    if ($inList) {
        Write-Host "  [OK] Le moteur UniteFx a bien enregistre ton micro dans sa liste active." -ForegroundColor Green
    } else {
        Write-Host "  [ERREUR] Ton micro n'est PAS dans la liste UniteFx.CaptureDevices !" -ForegroundColor Red
        Write-Host "          Valeur actuelle : $devList" -ForegroundColor DarkGray
        $issuesFound += "Ton micro par defaut n'est pas dans la liste UniteFx CaptureDevices."
    }
} else {
    Write-Host "  [ERREUR] La cle HKLM:\SOFTWARE\Leppsoft\UniteFx est inexistante !" -ForegroundColor Red
    $issuesFound += "Cle registre Leppsoft UniteFx manquante."
}
Write-Host ""

# --- TEST 4 : PROCESSUS ET PONT FREEPAD (FreePadApoBridge) ---
Write-Host "[4/5] Verification du pont audio FreePad (FreePadApoBridge)..." -ForegroundColor White
$pBridge = Get-Process -Name "FreePadApoBridge" -ErrorAction SilentlyContinue
$pFreePad = Get-Process -Name "FreePad" -ErrorAction SilentlyContinue

if ($pFreePad) {
    Write-Host "  [OK] FreePad est actuellement OUVERT (PID: $($pFreePad[0].Id))." -ForegroundColor Green
} else {
    Write-Host "  [INFO] FreePad n'est pas ouvert en ce moment (ferme ou en arriere-plan)." -ForegroundColor DarkGray
}

if ($pBridge) {
    Write-Host "  [OK] FreePadApoBridge.exe est ACTIF en memoire (PID: $($pBridge[0].Id))." -ForegroundColor Green
} else {
    if ($pFreePad) {
        Write-Host "  [ERREUR] FreePad est ouvert mais FreePadApoBridge.exe NE TOURNE PAS !" -ForegroundColor Red
        $issuesFound += "FreePadApoBridge.exe n'est pas lance (peut etre bloque par Antivirus)."
    } else {
        Write-Host "  [INFO] FreePadApoBridge.exe demarrera des que tu ouvriras FreePad." -ForegroundColor DarkGray
    }
}

$logFile = "$env:APPDATA\FreePad\apo_bridge.log"
if (Test-Path $logFile) {
    $lastLines = Get-Content $logFile -Tail 3 -ErrorAction SilentlyContinue
    Write-Host "  [LOG BRIDGE DERNIERES LIGNES] :" -ForegroundColor DarkGray
    foreach ($line in $lastLines) {
        Write-Host "       $line" -ForegroundColor DarkGray
    }
}
Write-Host ""

# --- TEST 5 : DISCORD & RECOMMANDATIONS ---
Write-Host "[5/5] Parametres Discord indispensables..." -ForegroundColor White
Write-Host "  Dans Discord > Parametres utilisateur (roue crantee) > Voix et video :" -ForegroundColor Cyan
Write-Host "  1. PERIPHERIQUE D'ENTREE : Selectionne EXPLICITEMENT :" -ForegroundColor White
if ($consoleName -ne "Inconnu") {
    Write-Host "     --> '$consoleName'" -ForegroundColor Yellow
} else {
    Write-Host "     --> Ton vrai micro casque / USB (et NON PAS un cable virtuel)" -ForegroundColor Yellow
}
Write-Host "  2. MODE D'ENTREE : Selectionne 'Sensibilite d'entree automatique' ou regle le seuil bas (-60 dB)." -ForegroundColor White
Write-Host "  3. TRAITEMENT DE LA VOIX :" -ForegroundColor White
Write-Host "     - Annulation de l'echo : DESACTIVER" -ForegroundColor Yellow
Write-Host "     - Suppression du bruit (Krisp) : DESACTIVER (ou Standard)" -ForegroundColor Yellow
Write-Host "     - Attenuation de l'audio : Regler a 0%" -ForegroundColor Yellow
Write-Host ""

# --- BILAN FINAL ---
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                             BILAN DU DIAGNOSTIC                                " -ForegroundColor Yellow
Write-Host "================================================================================" -ForegroundColor Cyan

if ($issuesFound.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "  [PARFAIT] Tout est installe et configure correctement pour l'injection micro !" -ForegroundColor Green
    Write-Host "  Si un pote ne t'entend pas :" -ForegroundColor White
    Write-Host "  -> Verifie que dans Discord, ton peripherique d'entree est bien ton micro physique." -ForegroundColor White
    Write-Host "  -> Verifie que Krisp est desactive dans Discord (Krisp filtre les bruits et les soundboards)." -ForegroundColor White
} else {
    if ($issuesFound.Count -gt 0) {
        Write-Host "  PROBLEMES CRITIQUES DETECTES ($($issuesFound.Count)) :" -ForegroundColor Red
        foreach ($iss in $issuesFound) {
            Write-Host "   - $iss" -ForegroundColor Red
        }
    }
    if ($warnings.Count -gt 0) {
        Write-Host "  AVERTISSEMENTS ($($warnings.Count)) :" -ForegroundColor Yellow
        foreach ($w in $warnings) {
            Write-Host "   - $w" -ForegroundColor Yellow
        }
    }
}
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Fonction de reparation
function Invoke-AutoFix {
    if (-not $isAdmin) {
        Write-Host "[!] Droits administrateur requis pour reparer. Elevation UAC en cours..." -ForegroundColor Yellow
        $psExe = if ([Environment]::Is64BitOperatingSystem -and -not [Environment]::Is64BitProcess -and (Test-Path "$env:WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe")) {
            "$env:WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
        } else {
            "powershell.exe"
        }
        Start-Process -FilePath $psExe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Fix" -Verb RunAs
        return
    }

    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Magenta
    Write-Host "        REPARATION AUTOMATIQUE DU PILOTE MICRO FREEPAD                          " -ForegroundColor Yellow
    Write-Host "                       (Fait par zioti)                                         " -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Magenta
    Write-Host ""

    $privCode = @'
using System;
using System.Runtime.InteropServices;

public class FreePadRepairPrivilege {
    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern bool OpenProcessToken(IntPtr ProcessHandle, uint DesiredAccess, out IntPtr TokenHandle);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool LookupPrivilegeValue(string lpSystemName, string lpName, out long lpLuid);

    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern bool AdjustTokenPrivileges(IntPtr TokenHandle, bool DisableAllPrivileges, ref TOKEN_PRIVILEGES NewState, uint BufferLength, IntPtr PreviousState, IntPtr ReturnLength);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern uint SetNamedSecurityInfo(string pObjectName, int ObjectType, int SecurityInfo, IntPtr psidOwner, IntPtr psidGroup, IntPtr pDacl, IntPtr pSacl);

    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string StringSecurityDescriptor, uint StringSDRevision, out IntPtr SecurityDescriptor, out uint SecurityDescriptorSize);

    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern bool ConvertStringSidToSid(string StringSid, out IntPtr Sid);

    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern bool GetSecurityDescriptorDacl(IntPtr pSecurityDescriptor, out bool lpbDaclPresent, out IntPtr pDacl, out bool lpbDaclDefaulted);

    [DllImport("kernel32.dll")]
    public static extern IntPtr GetCurrentProcess();

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr LocalFree(IntPtr hMem);

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct TOKEN_PRIVILEGES {
        public int PrivilegeCount;
        public long Luid;
        public int Attributes;
    }

    public const uint TOKEN_ADJUST_PRIVILEGES = 0x0020;
    public const uint TOKEN_QUERY = 0x0008;
    public const int SE_PRIVILEGE_ENABLED = 0x00000002;
    public const int SE_REGISTRY_KEY = 4;
    public const int OWNER_SECURITY_INFORMATION = 1;
    public const int DACL_SECURITY_INFORMATION = 4;

    public static bool EnablePrivilege(string privilege) {
        IntPtr token;
        if (!OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, out token)) return false;
        long luid;
        if (!LookupPrivilegeValue(null, privilege, out luid)) return false;
        var tp = new TOKEN_PRIVILEGES { PrivilegeCount = 1, Luid = luid, Attributes = SE_PRIVILEGE_ENABLED };
        return AdjustTokenPrivileges(token, false, ref tp, 0, IntPtr.Zero, IntPtr.Zero);
    }

    public static void EnableAll() {
        EnablePrivilege("SeTakeOwnershipPrivilege");
        EnablePrivilege("SeBackupPrivilege");
        EnablePrivilege("SeRestorePrivilege");
        EnablePrivilege("SeSecurityPrivilege");
    }

    public static bool UnlockKey(string subKeyPath) {
        try {
            string objectName = subKeyPath.StartsWith("HKLM\\") ? "MACHINE" + subKeyPath.Substring(4)
                : (subKeyPath.StartsWith("HKEY_LOCAL_MACHINE\\") ? "MACHINE" + subKeyPath.Substring(18)
                : subKeyPath);
            IntPtr pAdminSid = IntPtr.Zero;
            if (ConvertStringSidToSid("S-1-5-32-544", out pAdminSid)) {
                SetNamedSecurityInfo(objectName, SE_REGISTRY_KEY, OWNER_SECURITY_INFORMATION, pAdminSid, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
                LocalFree(pAdminSid);
            }
            IntPtr pSD = IntPtr.Zero;
            uint sdSize = 0;
            if (ConvertStringSecurityDescriptorToSecurityDescriptor("D:P(A;OICI;GA;;;SY)(A;OICI;GA;;;BA)(A;OICI;GRGW;;;BU)", 1, out pSD, out sdSize)) {
                bool daclPresent, daclDefaulted;
                IntPtr pDacl;
                if (GetSecurityDescriptorDacl(pSD, out daclPresent, out pDacl, out daclDefaulted)) {
                    SetNamedSecurityInfo(objectName, SE_REGISTRY_KEY, DACL_SECURITY_INFORMATION, IntPtr.Zero, IntPtr.Zero, pDacl, IntPtr.Zero);
                }
                LocalFree(pSD);
            }
            return true;
        } catch { return false; }
    }
}
'@
    try {
        Add-Type -TypeDefinition $privCode -Language CSharp -ErrorAction SilentlyContinue
        [FreePadRepairPrivilege]::EnableAll()
    } catch {}

    Write-Host "[1/4] Ciblage prioritaire de tes vrais microphones actifs..." -ForegroundColor Cyan
    $repairDevices = @()
    if ($consoleGuid) { $repairDevices += $consoleGuid }
    if ($commGuid -and ($repairDevices -notcontains $commGuid)) { $repairDevices += $commGuid }

    Get-ChildItem $baseCapture -ErrorAction SilentlyContinue | ForEach-Object {
        $devId = $_.PSChildName
        $devKey = Get-ItemProperty -Path "$baseCapture\$devId" -ErrorAction SilentlyContinue
        if (($devKey.DeviceState -band 0xF) -eq 1 -and ($repairDevices -notcontains $devId)) {
            $prop = Get-ItemProperty -Path "$baseCapture\$devId\Properties" -ErrorAction SilentlyContinue
            $name = $prop.'{a45c254e-df1c-4efd-8020-67d146a850e0},2'
            $hw = $prop.'{b3f8fa53-0004-438e-9003-51a46e139bfc},6'
            $ignore = @("Subwoofer", "Center", "Rear", "Side", "Stereo Mix", "Mixage st", "Steam")
            $skip = $false
            foreach ($ig in $ignore) {
                if (($name -and $name -like "*$ig*") -or ($hw -and $hw -like "*$ig*")) { $skip = $true; break }
            }
            if (-not $skip -and $repairDevices.Count -lt 6) {
                $repairDevices += $devId
            }
        }
    }

    Write-Host "[2/4] Injection forcee des registres APO 64-bit..." -ForegroundColor Cyan
    foreach ($devId in $repairDevices) {
        $parentRel = "SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture\$devId"
        $subKeyRel = "$parentRel\FxProperties"
        [FreePadRepairPrivilege]::UnlockKey("MACHINE\$parentRel")
        [FreePadRepairPrivilege]::UnlockKey("MACHINE\$subKeyRel")
        
        $regKey = "HKLM\$subKeyRel"
        & reg.exe add $regKey /v "{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},7" /t REG_SZ /d "{27384E53-9860-0AC3-9519-C60EBCAA2C71}" /f /reg:64 2>&1 | Out-Null
        & reg.exe add $regKey /v "{d3993a3f-99c2-4402-b5ec-a92a0367664b},7" /t REG_MULTI_SZ /d "{C18E2F7E-933D-4965-B7D1-1EEF228D2AF3}\0{FC1CFC9B-B9D6-4CFA-B5E0-4BB2166878B2}" /f /reg:64 2>&1 | Out-Null
        
        # Supprimer tout blocage Disable_SysFx s'il existe
        & reg.exe delete $regKey /v "{1da5d803-d01f-4d68-af3b-3051d1f69d5b},5" /f /reg:64 2>&1 | Out-Null

        $dName = Get-DeviceFriendlyName $devId
        Write-Host "      -> [OK] Pilote APO active sur : $dName" -ForegroundColor Green
    }

    Write-Host "[3/4] Mise a jour du registre UniteFx..." -ForegroundColor Cyan
    $cfgPaths = @(
        "HKLM:\SOFTWARE\Leppsoft\UniteFx",
        "HKLM:\SOFTWARE\WOW6432Node\Leppsoft\UniteFx"
    )
    $devListStr = ($repairDevices | ForEach-Object { 
        $id = $_.Trim('{}')
        "{{$id}}" 
    }) -join ""

    foreach ($cp in $cfgPaths) {
        if (-not (Test-Path $cp)) {
            New-Item -Path $cp -Force -ErrorAction SilentlyContinue | Out-Null
        }
        Set-ItemProperty -Path $cp -Name "CaptureDevices" -Value $devListStr -Type String -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $cp -Name "Standalone" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $cp -Name "FilterBlockVoice" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
    }

    Write-Host "[4/4] Redemarrage securise du service audio Windows (audiosrv)..." -ForegroundColor Cyan
    Stop-Service audiosrv -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 800
    Start-Service audiosrv -ErrorAction SilentlyContinue
    Write-Host "      -> Service audio redemarre avec succes !" -ForegroundColor Green
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "     REPARATION TERMINEE AVEC SUCCES ! LE PILOTE EST OPERATIONNEL !             " -ForegroundColor Yellow
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "  -> Ouvre FreePad et joue un son !" -ForegroundColor White
    Write-Host "  -> Dans Discord, selectionne ton micro physique : '$consoleName'" -ForegroundColor Cyan
    Write-Host ""
}

if ($Fix) {
    Invoke-AutoFix
} else {
    Write-Host "Que souhaites-tu faire ?" -ForegroundColor Cyan
    Write-Host "  [R] Reparer automatiquement maintenant (Force le pilote sur ton micro par defaut)" -ForegroundColor Green
    Write-Host "  [Q] Quitter" -ForegroundColor White
    Write-Host ""
    if ([Environment]::UserInteractive) {
        $key = Read-Host "Appuie sur R pour reparer ou Q pour quitter"
        if ($key -match "^[rR]") {
            Invoke-AutoFix
        }
    }
}
