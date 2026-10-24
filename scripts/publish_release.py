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

RELEASE_NAME = f"FreePad {TAG} — Voice Changer Pro & Zéro Latence"
BODY = f"""# 🎉 FreePad {TAG} — Mise à jour Majeure

**Fait par zioti** — Le soundboard moderne, libre et open-source pour Windows avec injection micro directe sans aucun câble virtuel.

---

### 🎙️ NOUVEAUTÉ : Voice Changer Pro (Modulateur de Voix en Temps Réel)
Transforme ta voix en direct avec **zéro latence** directement dans ton micro physique Windows ou dans Discord :
* 🎤 **Mode Travis Scott / PNL (Auto-Tune) :** Correction de pitch chromatique dure instantanée + Reverb studio spatiale.
* 🤖 **Robot / Vocoder Daft Punk :** Modulateur en anneau synthétique et électrique sur note de basse.
* 😈 **Démon des Abysses :** Voix descendue d'une octave avec sub-bass 90Hz et distorsion sombre de film d'horreur.
* 🎈 **Hélium / Lutin :** Voix aiguë rapide avec formants rehaussés.
* 📢 **Mégaphone de Police :** Filtre de haut-parleur résonant et distorsion de rue.
* 📻 **Talkie-Walkie Militaire :** Filtre radio tactique avec grésillement et bip *"Krrsh... Roger"* déclenché au relâchement.
* 🎧 **Retour Casque Intégré :** Écoute ta propre voix modifiée en temps réel avec volume ajustable.
* ⌨️ **Raccourci Clavier Global (F6) :** Active ou désactive le voice changer en jeu ou sur Discord d'une simple touche.
* 🎛️ **Mode Bascule ou Push-to-Talk (PTT) :** Choisis entre appuyer pour activer ou maintenir pour parler.

---

### 🔥 Instant Remix (F7)
* 🎛️ Capture 2.5 secondes de parole d'un pote en vocal et transforme-la automatiquement en boucle rap calée sur une instru **Drill, Phonk ou Trap** en direct dans ton micro !

---

### ⚡ Améliorations & Corrections
* 🔄 **Mise à Jour 100% Silencieuse :** L'auto-updater applique les mises à jour en arrière-plan sans jamais réouvrir l'assistant d'installation.
* 📦 **Installeur Windows NSIS Pro :** Raccourcis Bureau et Menu Démarrer officiels.

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
