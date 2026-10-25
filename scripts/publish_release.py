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

RELEASE_NAME = f"FreePad {TAG} — Modulateur de Voix Studio & Intégration Discord Zéro-Larsen"
BODY = f"""# 🎉 FreePad {TAG} — Modulateur de Voix Studio & Intégration Discord Zéro-Larsen

**Fait par zioti** — Le soundboard moderne, libre et open-source pour Windows avec injection micro et modulateur de voix pro.

---

### 🚀 Quoi de neuf dans la v1.2.8 ?

#### 1. 🎙️ Modulateur de Voix Studio Zéro-Latence (DSP Dual-Tap Overlap-Add)
* ⚡ **Pitch Shifting OLA sans clics ni coupures :** Remplacement intégral de l'ancien algorithme granulaire par un double buffer OLA à fenêtrage de Hann continu ($w_0 + w_1 \\equiv 1.0$) pour des transpositions douces, naturelles et sans aucun grésillement métallique.
* 🎵 **Auto-Tune Travis Scott / PNL :** Détection de fondamentale ultra-rapide par autocorrélation normalisée (ACF 75Hz-550Hz) avec verrouillage instantané sur les 12 demi-tons chromatiques et slapback delay spatial.
* 🤖 **Vocoder Daft Punk :** Double oscillateur dent de scie (A2 110Hz + E3 164.8Hz + Sub 55Hz) avec suivi d'enveloppe vocale et préservation des consonnes sifflantes pour une intelligibilité parfaite.
* 😈 **Démon des Abysses, Hélium, Mégaphone & Talkie-Walkie :** Présets calibrés avec filtres biquad studio, saturation analogique progressive et compresseur dynamique.

#### 2. 🛡️ Suppression Définitive du Bruit Assourdissant & Larsen
* 🔇 **Élimination de la boucle de feedback physique :** Le flux du microphone physique n'est plus réinjecté dans lui-même. Finie la saturation numérique assourdissante à 0 dBFS !
* 👂 **Protection auditive absolue :** Le retour casque (monitoring) reste désactivé par défaut. Tu peux activer l'écoute ou lancer un **Echo Test de 3s** en un clic pour tester ce que tes amis entendront.

#### 3. 💬 Intégration Discord & Jeux 100% Fonctionnelle
* 🟢 **Diffusion vers Steam Streaming Microphone / Câble Virtuel :** Exactement comme Voicemod, ta voix modifiée est retransmise avec une latence quasi-nulle vers le périphérique virtuel déjà présent sur ton PC.
* 📋 **Bouton Copier 1-Clic :** La fenêtre du Voice Changer t'indique précisément le nom du périphérique à choisir dans **Discord > Paramètres > Voix et vidéo > Périphérique d'entrée** (`Steam Streaming Microphone`), avec un bouton pour copier son nom instantanément.

#### 4. 🎯 Fin des Sons Joués en Double (Soundboard)
* 🛑 **Ducking automatique du retour micro :** Lorsqu'un son de la soundboard est joué, le retour micro est temporairement atténué pour éviter qu'il ne soit recapturé en double ou en écho.
* ⚡ **Debounce anti-rebond :** Empêche le déclenchement intempestif de sons multiples lors de clics rapides ou appuis prolongés sur les touches du clavier.

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
