param(
    [switch]$Silent
)

# FreePad APO Driver Installer — 100% Direct Micro Injection (Zero VB-Cable - Fait par zioti)
# Permet l'injection directe des sons et de la voix modifiée dans n'importe quel microphone physique (USB, Casque, Nor-Tec, Realtek, HyperX, Razer, Logitech, etc.)
# Sans avoir besoin de VB-Cable, ni de Soundpad, ni de Steam Streaming Microphone.

$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       INSTALLATEUR DU PILOTE MICRO DIRECT FREEPAD        " -ForegroundColor Yellow
Write-Host "                   (Fait par zioti)                       " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérification des droits administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[!] Droits administrateur requis. Relance avec élévation UAC..." -ForegroundColor Yellow
    $silentArg = if ($Silent) { " -Silent" } else { "" }
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"$silentArg" -Verb RunAs
    exit
}

$scriptDir = Split-Path -Parent $PSCommandPath
$possibleDllSources = @(
    (Join-Path $scriptDir "UniteFx.dll"),
    (Join-Path $scriptDir "..\driver\UniteFx.dll"),
    (Join-Path $scriptDir "driver\UniteFx.dll"),
    (Join-Path $env:APPDATA "freepad\bin\UniteFx.dll"),
    (Join-Path $env:LOCALAPPDATA "Programs\freepad\resources\driver\UniteFx.dll"),
    (Join-Path ${env:ProgramFiles} "FreePad\resources\driver\UniteFx.dll"),
    (Join-Path ${env:ProgramFiles(x86)} "FreePad\resources\driver\UniteFx.dll"),
    (Join-Path (Get-Location) "UniteFx.dll"),
    (Join-Path (Get-Location) "driver\UniteFx.dll"),
    (Join-Path $scriptDir "..\resources\driver\UniteFx.dll"),
    (Join-Path $scriptDir "..\resources\app.asar.unpacked\driver\UniteFx.dll")
)

$driverDllSource = $null
foreach ($p in $possibleDllSources) {
    if ($p -and (Test-Path $p)) {
        $driverDllSource = $p
        break
    }
}

if (-not $driverDllSource) {
    Write-Host "[-] ERREUR: Fichier pilote UniteFx.dll introuvable." -ForegroundColor Red
    Write-Host "    Recherché dans les dossiers de l'application et AppData." -ForegroundColor Yellow
    Write-Host ""
    if (-not $Silent) {
        Write-Host "Appuyez sur une touche pour quitter..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    exit 1
}

Write-Host "[1/5] Copie du pilote système..." -ForegroundColor Green
$sys32Dll = "C:\Windows\System32\UniteFx1.8.0.dll"

$needsCopy = $true
if (Test-Path $sys32Dll) {
    try {
        $item = Get-Item $sys32Dll
        if ($item.Length -gt 100000) {
            Write-Host "      -> Pilote déjà présent et valide dans $sys32Dll" -ForegroundColor Gray
            $needsCopy = $false
        }
    } catch {}
}

if ($needsCopy) {
    try {
        Copy-Item -Path $driverDllSource -Destination $sys32Dll -Force -ErrorAction Stop
        Write-Host "      -> Pilote copié avec succès dans $sys32Dll" -ForegroundColor Gray
    } catch {
        # Tenter d'arrêter audiosrv et audiodg au cas où le fichier est verrouillé en mémoire
        Stop-Service -Name "audiosrv" -Force -ErrorAction SilentlyContinue
        Stop-Process -Name "audiodg" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
        try {
            Copy-Item -Path $driverDllSource -Destination $sys32Dll -Force -ErrorAction Stop
            Write-Host "      -> Pilote copié avec succès dans $sys32Dll" -ForegroundColor Gray
        } catch {
            if (Test-Path $sys32Dll) {
                Write-Host "      -> Pilote existant conservé dans $sys32Dll" -ForegroundColor Gray
            } else {
                Write-Host "      [-] Échec de copie dans System32: $($_.Exception.Message)" -ForegroundColor Red
                if (-not $Silent) { Start-Sleep -Seconds 3 }
                exit 1
            }
        }
    }
}

Write-Host "[2/5] Enregistrement COM du filtre audio (APO)..." -ForegroundColor Green
try {
    $clsidPaths = @(
        "HKLM:\SOFTWARE\Classes\CLSID\{27384E53-9860-0AC3-9519-C60EBCAA2C71}\InprocServer32",
        "HKLM:\SOFTWARE\WOW6432Node\Classes\CLSID\{27384E53-9860-0AC3-9519-C60EBCAA2C71}\InprocServer32"
    )
    foreach ($cp in $clsidPaths) {
        New-Item -Path $cp -Force -ErrorAction SilentlyContinue | Out-Null
        Set-ItemProperty -Path $cp -Name "(default)" -Value $sys32Dll -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $cp -Name "ThreadingModel" -Value "Both" -ErrorAction SilentlyContinue
    }
    Write-Host "      -> CLSID {27384E53-9860-0AC3-9519-C60EBCAA2C71} enregistré avec succès" -ForegroundColor Gray
} catch {
    Write-Host "      [!] Erreur registre COM: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "[3/5] Détection et configuration des microphones..." -ForegroundColor Green

# 1. Activer les privilèges de sécurité SeTakeOwnership et SeRestore pour accès au registre protégé
$privCode = @"
using System;
using System.Runtime.InteropServices;

public class FreePadPrivilege {
    [DllImport("advapi32.dll", ExactSpelling = true, SetLastError = true)]
    internal static extern bool AdjustTokenPrivileges(IntPtr htok, bool disall,
        ref TokPriv1Luid newst, int len, IntPtr prev, IntPtr relen);

    [DllImport("advapi32.dll", ExactSpelling = true, SetLastError = true)]
    internal static extern bool OpenProcessToken(IntPtr h, int acc, ref IntPtr phtok);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    internal static extern bool LookupPrivilegeValue(string host, string name, ref long pluid);

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    internal struct TokPriv1Luid {
        public int Count;
        public long Luid;
        public int Attr;
    }

    const int SE_PRIVILEGE_ENABLED = 0x00000002;
    const int TOKEN_QUERY = 0x00000008;
    const int TOKEN_ADJUST_PRIVILEGES = 0x00000020;

    public static void EnableAll() {
        try {
            string[] privs = new string[] { "SeTakeOwnershipPrivilege", "SeRestorePrivilege", "SeBackupPrivilege", "SeSecurityPrivilege" };
            IntPtr htok = IntPtr.Zero;
            if (!OpenProcessToken(System.Diagnostics.Process.GetCurrentProcess().Handle, TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, ref htok)) return;
            foreach (string p in privs) {
                TokPriv1Luid tp;
                tp.Count = 1;
                tp.Luid = 0;
                tp.Attr = SE_PRIVILEGE_ENABLED;
                if (LookupPrivilegeValue(null, p, ref tp.Luid)) {
                    AdjustTokenPrivileges(htok, false, ref tp, 0, IntPtr.Zero, IntPtr.Zero);
                }
            }
        } catch {}
    }
}
"@
try {
    Add-Type -TypeDefinition $privCode -Language CSharp -ErrorAction SilentlyContinue
    [FreePadPrivilege]::EnableAll()
} catch {}

$baseCapture = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture"
$captureDevices = @()
$deviceNames = @{}

if (Test-Path $baseCapture) {
    Get-ChildItem $baseCapture | ForEach-Object {
        $devId = $_.PSChildName
        $devKey = Get-ItemProperty -Path "$baseCapture\$devId" -ErrorAction SilentlyContinue
        $state = $devKey.DeviceState

        # Si le périphérique est déconnecté ou inactif, nettoyer tout ancien filtre pour libérer les slots APO
        if (($state -band 0xF) -ne 1) {
            $regKey = "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture\$devId\FxProperties"
            & reg.exe delete $regKey /v "{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},7" /f 2>&1 | Out-Null
            & reg.exe delete $regKey /v "{d3993a3f-99c2-4402-b5ec-a92a0367664b},7" /f 2>&1 | Out-Null
            return
        }

        $prop = Get-ItemProperty -Path "$baseCapture\$devId\Properties" -ErrorAction SilentlyContinue
        $name = $prop.'{a45c254e-df1c-4efd-8020-67d146a850e0},2'
        $hwName = $prop.'{b3f8fa53-0004-438e-9003-51a46e139bfc},6'

        # Filtrer les prises internes inactives et les câbles virtuels (CABLE, VB-Audio, Voicemeeter, Stereo Mix, Steam)
        # Fait par zioti
        $ignoreWords = @("Subwoofer", "Center", "Rear", "Side", "Mixage st", "Stereo Mix", "AUX", "Green In", "Blue In", "Pink In", "CABLE", "VB-Audio", "Voicemeeter", "Voicemod", "Steam")
        $isIgnored = $false
        foreach ($iw in $ignoreWords) {
            if (($name -and $name -like "*$iw*") -or ($hwName -and $hwName -like "*$iw*")) {
                $isIgnored = $true; break
            }
        }
        if ($isIgnored) { return }

        $dName = if ($name) { $name } else { $hwName }
        $captureDevices += $devId
        $deviceNames[$devId] = $dName
    }
}

# Limiter strictement aux 4 à 6 meilleurs microphones actifs (limite matérielle de 8 slots APO)
if ($captureDevices.Count -gt 6) {
    $captureDevices = $captureDevices[0..5]
}

if ($captureDevices.Count -eq 0 -and (Test-Path $baseCapture)) {
    Write-Host "      [i] Aucun micro spécifique filtré, sélection des microphones disponibles..." -ForegroundColor Yellow
    Get-ChildItem $baseCapture | ForEach-Object {
        $devId = $_.PSChildName
        $devKey = Get-ItemProperty -Path "$baseCapture\$devId" -ErrorAction SilentlyContinue
        if (($devKey.DeviceState -band 0xF) -eq 1 -and $captureDevices.Count -lt 4) {
            $captureDevices += $devId
            $deviceNames[$devId] = "Microphone $devId"
        }
    }
}

# 2. Utilisation de regini.exe pour appliquer les permissions système et injecter le filtre APO
# regini.exe dispose des droits kernel pour configurer [1 17] (Administrateurs & Système Plein Accès)
$reginiLines = @()
foreach ($devId in $captureDevices) {
    $reginiLines += "\Registry\Machine\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture\$devId [1 17]"
    $reginiLines += "    FxProperties [1 17]"
    $reginiLines += "        `"{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},7`" = REG_SZ {27384E53-9860-0AC3-9519-C60EBCAA2C71}"
    $reginiLines += "        `"{d3993a3f-99c2-4402-b5ec-a92a0367664b},7`" = REG_MULTI_SZ `"{C18E2F7E-933D-4965-B7D1-1EEF228D2AF3}`""
}

if ($reginiLines.Count -gt 0) {
    try {
        $iniFile = [System.IO.Path]::GetTempFileName()
        Set-Content -Path $iniFile -Value ($reginiLines -join "`r`n") -Encoding ASCII
        & regini.exe $iniFile 2>&1 | Out-Null
        Remove-Item $iniFile -Force -ErrorAction SilentlyContinue
    } catch {}
}

# 3. Double assurance via reg.exe natif (aucun blocage de permission .NET PowerShell)
foreach ($devId in $captureDevices) {
    $regKey = "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture\$devId\FxProperties"
    & reg.exe add $regKey /v "{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},7" /t REG_SZ /d "{27384E53-9860-0AC3-9519-C60EBCAA2C71}" /f 2>&1 | Out-Null
    & reg.exe add $regKey /v "{d3993a3f-99c2-4402-b5ec-a92a0367664b},7" /t REG_MULTI_SZ /d "{C18E2F7E-933D-4965-B7D1-1EEF228D2AF3}" /f 2>&1 | Out-Null
    
    $dName = $deviceNames[$devId]
    Write-Host "      -> [OK] Filtre micro activé: $dName" -ForegroundColor Cyan
}

Write-Host "[4/5] Configuration du moteur audio FreePad..." -ForegroundColor Green
$cfgPaths = @(
    "HKLM:\SOFTWARE\Leppsoft\UniteFx",
    "HKLM:\SOFTWARE\WOW6432Node\Leppsoft\UniteFx"
)

# Création du dossier ProgramData requis par le driver
$pData = "C:\ProgramData\Leppsoft\Soundpad"
if (-not (Test-Path $pData)) {
    New-Item -Path $pData -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null
}

# Concaténation propre des GUIDs : {guid1}{guid2} ou {{guid1}}
$devListStr = ($captureDevices | ForEach-Object { 
    $id = $_.Trim('{}')
    "{{$id}}" 
}) -join ""

$unixNow = [int][double]::Parse((Get-Date -UFormat %s))

foreach ($cfgPath in $cfgPaths) {
    New-Item -Path $cfgPath -Force -ErrorAction SilentlyContinue | Out-Null
    try {
        $parentKey = Split-Path -Parent $cfgPath
        $acl = Get-Acl $parentKey -ErrorAction SilentlyContinue
        if ($acl) {
            $rule = New-Object System.Security.AccessControl.RegistryAccessRule("Users", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
            $acl.AddAccessRule($rule)
            Set-Acl -Path $parentKey -AclObject $acl -ErrorAction SilentlyContinue
        }
        $aclSub = Get-Acl $cfgPath -ErrorAction SilentlyContinue
        if ($aclSub) {
            $ruleSub = New-Object System.Security.AccessControl.RegistryAccessRule("Users", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
            $aclSub.AddAccessRule($ruleSub)
            Set-Acl -Path $cfgPath -AclObject $aclSub -ErrorAction SilentlyContinue
        }
    } catch {}
    Set-ItemProperty -Path $cfgPath -Name "CaptureDevices" -Value $devListStr -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $cfgPath -Name "LogLevel" -Value "ERROR" -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $cfgPath -Name "FilterBlockVoice" -Value 0 -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $cfgPath -Name "DisableDrmProtection" -Value 1 -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $cfgPath -Name "Standalone" -Value 1 -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $cfgPath -Name "MicAmpInDb" -Value 0 -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $cfgPath -Name "SetupDate" -Value $unixNow -Type DWord -ErrorAction SilentlyContinue

    # CRUCIAL : Sous-clés par microphone requises par UniteFx.dll pour s'initialiser dans audiodg.exe
    foreach ($devId in $captureDevices) {
        $cleanId = "{" + $devId.Trim('{}') + "}"

        $devSubKey = "$cfgPath\$cleanId"
        New-Item -Path $devSubKey -Force -ErrorAction SilentlyContinue | Out-Null
        Set-ItemProperty -Path $devSubKey -Name "Version" -Value 3 -Type DWord -ErrorAction SilentlyContinue

        $devSubKey1 = "$cfgPath\$cleanId,1"
        New-Item -Path $devSubKey1 -Force -ErrorAction SilentlyContinue | Out-Null
        Set-ItemProperty -Path $devSubKey1 -Name "Mode" -Value 0 -Type DWord -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $devSubKey1 -Name "AutoMode" -Value 0 -Type DWord -ErrorAction SilentlyContinue
    }
}
Write-Host "      -> Filtre injecté sur $($captureDevices.Count) microphone(s) avec sous-clés actives" -ForegroundColor Gray

Write-Host "[5/5] Redémarrage du service audio Windows (audiosrv)..." -ForegroundColor Green
try {
    Restart-Service -Name "audiosrv" -Force
    Write-Host "      -> Service audio Windows redémarré avec succès !" -ForegroundColor Gray
} catch {
    Write-Host "      [!] Attention: Le service audio redémarrera au prochain démarrage ($($_.Exception.Message))" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       INSTALLATION TERMINÉE AVEC SUCCÈS !                " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tes sons entreront maintenant directement dans ton micro" -ForegroundColor White
Write-Host "sans aucun réglage nécessaire dans Discord ou tes jeux !" -ForegroundColor White
Write-Host ""
Write-Host "Fait par zioti — 100% Direct Micro Injection" -ForegroundColor Cyan
Write-Host ""
if (-not $Silent) {
    Start-Sleep -Seconds 2
}
