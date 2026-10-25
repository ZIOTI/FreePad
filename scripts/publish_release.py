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

RELEASE_NAME = f"FreePad {TAG} — Détection Vocale Instantanée & VU-Mètre Réactif"
BODY = f"""# 🎉 FreePad {TAG} — Détection Vocale Instantanée & VU-Mètre Réactif

**Fait par zioti** — Le soundboard moderne, libre et open-source pour Windows avec injection micro et modulateur de voix pro.

---

### 🚀 Quoi de neuf dans la v1.3.0 ?

#### 1. 🎤 Détection Vocale Acoustique & VU-Mètre Ultra-Réactif (Time-Domain RMS + Peak)
* ⚡ **Fin du faux statut "Silence" :** Remplacement de l'ancien calcul de moyenne par bandes de fréquences par un analyseur temporel RMS + Peak calibré pour la voix humaine. Dès que tu parles ou chuchotes dans ton micro, FreePad détecte instantanément ta voix et le VU-mètre réagit en direct !
* 🟢 **Indicateur Dynamique :** Affichage en temps réel du pourcentage de signal vocal (`Signal Micro Détecté 🎤 (xx%)`) avec animation visuelle fluide.

#### 2. ⚡ Réveil & Capture Instantanée à l'Ouverture des Paramètres
* 🔌 **Auto-Activation Directe :** À l'ouverture de la fenêtre Paramètres, le flux du microphone sélectionné est automatiquement vérifié et démarré en arrière-plan sans nécessiter d'action préalable.

#### 3. 🛡️ Capture Microphone Multi-Tier & Anti-Collision WASAPI
* 🚀 **Multi-Tier Fallback :** Si le pilote Windows d'un micro USB ou d'un casque Bluetooth refuse le mode brut sans DSP, FreePad bascule automatiquement sur les contraintes universelles compatibles sans afficher d'erreur.
* 🔒 **Verrou Mutex Asynchrone :** Empêche tout blocage ou plantage du périphérique audio en cas de clics rapides ou changements successifs dans la liste des micros.

---

### 📥 Téléchargement
Téléchargez **FreePad-Setup-{VERSION}.exe** ci-dessous pour installer ou mettre à jour FreePad !
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
