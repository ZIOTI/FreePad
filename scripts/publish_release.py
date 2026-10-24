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

RELEASE_NAME = f"FreePad {TAG} — Correctif Zéro Feedback & Moteur DSP Tri-Tap Haute Fidélité"
BODY = f"""# 🎉 FreePad {TAG} — Moteur DSP Haute Fidélité & Discord 100% Sans Feedback

**Fait par zioti** — Le soundboard moderne, libre et open-source pour Windows avec injection micro et modulateur de voix pro.

---

### 🚀 Quoi de neuf dans la v1.2.3 ?

#### 1. 🛡️ Élimination Totale du Bug de Répétition Ultra-Rapide (Anti-Feedback Guard)
* 🚫 **Fin du Larsen / Répétition en rafale :** Le streaming en boucle locale vers l'APO matériel qui créait un écho ultra-rapide en mitraillette (50Hz) a été **définitivement supprimé**.
* 🎧 **Isolation Acoustique Absolue :** Le microphone physique de l'utilisateur reste 100% propre, sans aucun retour ni larsen audio.

#### 2. 🎛️ Tout Nouveau Moteur DSP Tri-Tap à Énergie Constante (Zero Dropouts, Zero Flutter)
* 💎 **Moteur Granulaire 3 Taps à 120° :** Remplacement complet de l'ancien vocodeur instable par un algorithme à sommation constante (puissance égale garantie $\\sum \\sin^2 = 1.5$). Zéro hachure, zéro saccade, zéro trou de silence.
* 🎤 **Travis Scott / PNL (Auto-Tune) :** Détecteur de hauteur AMDF temps réel avec snap chromatique instantané (0 ms de temps de recalage) + delay spatial studio + brillance 8 kHz.
* 🤖 **Robot / Vocoder Daft Punk :** Synthétiseur analogique bitonal (fondamentale A2 110Hz + quinte E3 165Hz) avec suiveur d'enveloppe vocal et préservation des consonnes/sibilances (> 3.2kHz) pour une intelligibilité parfaite.
* 😈 **Démon des Abysses :** Pitch descendu (-8.5 demi-tons) + couche sous-octave (-12 st) + résonance de poitrine sub-bass 85Hz + saturation tube analogique.
* 🎈 **Hélium / Lutin :** Pitch monté (+9.5 demi-tons) + coupe-bas 380Hz éliminant les résonances d'adulte + boost de présence 2600Hz.
* 📢 **Mégaphone de Police :** Filtrage acoustique de pavillon 620Hz - 2500Hz + pic de résonance 1250Hz + distorsion à diode + écho slapback de rue 22ms.
* 📻 **Talkie-Walkie Militaire :** Bande passante radio VHF/UHF + saturation radio + compression dynamique + bip "Roger" réaliste au relâchement de la touche.

#### 3. 🎙️ Connexion Discord Instantanée & Auto-Détection
* ⚡ **Auto-Sélection Intelligente :** FreePad détecte automatiquement tout câble virtuel ou périphérique disponible (Voicemod Virtual Audio Device, Steam Streaming Microphone, VB-Cable) et configure la sortie de diffusion sans aucune manipulation complexe.
* 📋 **Guide Clair dans l'Interface :** Indication exacte du périphérique d'entrée à sélectionner dans les paramètres Discord.
* 🎙️ **Test d'Écoute 3s :** Permet de s'entendre parler comme Discord nous entend d'un simple clic.

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
