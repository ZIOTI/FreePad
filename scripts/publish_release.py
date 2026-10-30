import os
import sys
import json
import subprocess
import urllib.request
import urllib.parse

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG_PATH = os.path.join(ROOT_DIR, "package.json")

with open(PKG_PATH, "r", encoding="utf-8") as f:
    pkg = json.load(f)

VERSION = pkg.get("version", "1.0.0")
TAG = f"v{VERSION}"
REPO = "ZIOTI/FreePad"

# Get GitHub Token securely from Environment or Windows Git Credential Helper
TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
if not TOKEN:
    try:
        proc = subprocess.Popen(
            ["git", "credential", "fill"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        out, _ = proc.communicate(input=f"protocol=https\nhost=github.com\npath={REPO}.git\n")
        for line in out.splitlines():
            if line.startswith("password="):
                TOKEN = line.split("=", 1)[1].strip()
                break
    except Exception as e:
        print("Notice: Git credential fill check:", e)

if not TOKEN:
    print("ERROR: GitHub token not found. Please set GITHUB_TOKEN or authenticate git.")
    sys.exit(1)

RELEASE_NAME = f"FreePad {TAG} — Pilote Micro Direct 64-bit Natif & Support Universel Discord VoIP"
BODY = f"""# 🎉 FreePad {TAG} — Pilote Micro Direct 64-bit Natif & Support Universel Discord VoIP

**Fait par zioti** — Le soundboard moderne, libre et open-source pour Windows avec injection micro native et capture de clips instantanés (Instant Replay).

---

### 🚀 Quoi de neuf dans la v1.3.7 ?

#### 1. ⚙️ Exécution PowerShell 64-bit Native (Sysnative)
* 🚀 **Accès direct au Registre 64-bit :** L'installeur NSIS et l'application FreePad utilisent désormais le canal `Sysnative` 64-bit de Windows pour configurer les périphériques audio (`MMDevices\\Audio\\Capture`) directement dans la ruche système native, éliminant tout blocage lié au pont 32-bit SysWOW64.
* 🛡️ **Auto-élévation 64-bit :** Le script d'installation détecte l'architecture de l'OS et se relance automatiquement en 64-bit natif.

#### 2. 🎙️ Support Universel Discord VoIP (Mode Communications)
* 🎧 **Compatible tous casques gaming :** Enregistrement simultané des modes `DEFAULT` et `COMMUNICATIONS` (`{{FC1CFC9B-B9D6-4CFA-B5E0-4BB2166878B2}}`) pour que Windows ne contourne jamais le filtre APO lors des appels vocaux Discord sur casques Logitech, Razer, Corsair, SteelSeries, HyperX et micros USB.
* 📋 **Enregistrement AudioEngine APO & COM :** Enregistrement complet dans `AudioEngine\\AudioProcessingObjects` avec drapeaux de format et `regsvr32` natif.

#### 3. 🔑 Permissions Windows Universelles (FR / EN & TrustedInstaller)
* 🌐 **Compatibilité linguistique :** Remplacement des noms de groupes Windows localisés par des SIDs immuables (`*S-1-5-32-545` et `*S-1-5-11`), fonctionnant sur n'importe quelle version de Windows (Français, Anglais, etc.).
* 🔓 **Déverrouillage TrustedInstaller :** Attribution automatique des privilèges système Win32 (`SetNamedSecurityInfo`) sur `FxProperties` pour garantir zéro erreur « Accès refusé » même sur PC clean install.

#### 4. 💡 Conseil Réglage Discord Intégré
* ⚠️ **Bandeau d'information & Paramètres :** Rappel indispensable pour désactiver la suppression de bruit Krisp et l'annulation d'écho dans Discord afin de garantir une diffusion limpide à 100% de volume.

---

### 📥 Téléchargement & Mise à jour
* **Via l'application :** Ouvre FreePad > Paramètres > clique sur **Rechercher les mises à jour** (ou attends la notification automatique). Après mise à jour, clique sur **🔄 Réparer / Réinstaller** dans les paramètres micro.
* **Via l'installeur :** Télécharge **FreePad-Setup-{VERSION}.exe** ci-dessous pour une installation 100% propre avec élévation immédiate !
"""

print(f"Publishing release {TAG} for {REPO}...")

# 1. Create or get existing release
create_url = f"https://api.github.com/repos/{REPO}/releases"
payload = json.dumps({
    "tag_name": TAG,
    "target_commitish": "main",
    "name": RELEASE_NAME,
    "body": BODY,
    "draft": False,
    "prerelease": False
}).encode('utf-8')

req = urllib.request.Request(create_url, data=payload, method="POST")
req.add_header("Authorization", f"Bearer {TOKEN}")
req.add_header("Accept", "application/vnd.github+json")
req.add_header("User-Agent", "FreePad-Release-Script")
req.add_header("Content-Type", "application/json")

release_id = None
try:
    with urllib.request.urlopen(req) as resp:
        release_data = json.loads(resp.read().decode('utf-8'))
        print(f"Release created: {release_data['html_url']}")
        release_id = release_data['id']
except urllib.error.HTTPError as e:
    print(f"HTTP notice ({e.code}): Checking existing release for tag {TAG}...")
    get_url = f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}"
    g_req = urllib.request.Request(get_url)
    g_req.add_header("Authorization", f"Bearer {TOKEN}")
    g_req.add_header("Accept", "application/vnd.github+json")
    g_req.add_header("User-Agent", "FreePad-Release-Script")
    with urllib.request.urlopen(g_req) as g_resp:
        release_data = json.loads(g_resp.read().decode('utf-8'))
        release_id = release_data['id']
        print(f"Found existing release ID: {release_id} at {release_data['html_url']}")

    # Update existing release name and body
    patch_url = f"https://api.github.com/repos/{REPO}/releases/{release_id}"
    p_req = urllib.request.Request(patch_url, data=payload, method="PATCH")
    p_req.add_header("Authorization", f"Bearer {TOKEN}")
    p_req.add_header("Accept", "application/vnd.github+json")
    p_req.add_header("User-Agent", "FreePad-Release-Script")
    p_req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(p_req) as p_resp:
            print("Updated release details successfully.")
    except Exception as pe:
        print("Notice: could not patch release info:", pe)

# 2. Get existing assets to avoid conflicts
assets_url = f"https://api.github.com/repos/{REPO}/releases/{release_id}/assets"
a_req = urllib.request.Request(assets_url)
a_req.add_header("Authorization", f"Bearer {TOKEN}")
a_req.add_header("Accept", "application/vnd.github+json")
a_req.add_header("User-Agent", "FreePad-Release-Script")

existing_assets = {}
try:
    with urllib.request.urlopen(a_req) as a_resp:
        for a in json.loads(a_resp.read().decode('utf-8')):
            existing_assets[a['name']] = a['id']
except Exception as e:
    print("Could not fetch existing assets:", e)

# 3. Upload Assets
upload_base = f"https://uploads.github.com/repos/{REPO}/releases/{release_id}/assets"

setup_src = os.path.join(ROOT_DIR, "release", f"FreePad Setup {VERSION}.exe")
latest_yml = os.path.join(ROOT_DIR, "release", "latest.yml")

assets_to_upload = [
    (setup_src, f"FreePad-Setup-{VERSION}.exe"),
    (latest_yml, "latest.yml")
]

for file_path, asset_name in assets_to_upload:
    if not os.path.exists(file_path):
        print(f"WARNING: File not found: {file_path}")
        continue

    if asset_name in existing_assets:
        del_url = f"https://api.github.com/repos/{REPO}/releases/assets/{existing_assets[asset_name]}"
        d_req = urllib.request.Request(del_url, method="DELETE")
        d_req.add_header("Authorization", f"Bearer {TOKEN}")
        d_req.add_header("User-Agent", "FreePad-Release-Script")
        try:
            with urllib.request.urlopen(d_req):
                print(f"Deleted old asset {asset_name}")
        except Exception as de:
            print(f"Could not delete old asset {asset_name}:", de)

    file_size = os.path.getsize(file_path)
    print(f"Uploading {asset_name} ({file_size / (1024*1024):.1f} MB)...")
    url = f"{upload_base}?name={urllib.parse.quote(asset_name)}"
    
    with open(file_path, "rb") as f:
        file_bytes = f.read()
    
    u_req = urllib.request.Request(url, data=file_bytes, method="POST")
    u_req.add_header("Authorization", f"Bearer {TOKEN}")
    u_req.add_header("Content-Type", "application/octet-stream")
    u_req.add_header("User-Agent", "FreePad-Release-Script")
    
    try:
        with urllib.request.urlopen(u_req) as u_resp:
            res = json.loads(u_resp.read().decode('utf-8'))
            print(f"Uploaded: {asset_name} -> {res.get('browser_download_url')}")
    except urllib.error.HTTPError as ue:
        print(f"Error uploading {asset_name}: {ue.code} {ue.read().decode('utf-8')}")

print(f"\nSUCCESS! Release {TAG} published on GitHub: https://github.com/{REPO}/releases/tag/{TAG}")
