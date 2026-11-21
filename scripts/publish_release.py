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

RELEASE_NAME = f"FreePad {TAG} — Studio Voix IA Multilingue, 11 Accents Culturels & Intégration ElevenLabs Pro"
BODY = f"""# 🎉 FreePad {TAG} — Studio Voix IA Multilingue, 11 Accents Culturels & ElevenLabs Pro

**Fait par zioti** — Le soundboard moderne, libre et open-source pour Windows avec injection micro native (100% sans câble virtuel).

---

### 🚀 Quoi de neuf dans la v{VERSION} ?

#### 1. 🎭 Studio Voix IA Multilingue & 11 Accents Culturels
* 🌍 **11 Accents régionaux et internationaux :** Parlez dans votre microphone avec des accents ultra-réalistes et hilarants :
  * 🇨🇬 **Congolais / Africain** (accent chantant, phonétique 'r' roulé, expressions cultes "dé", "eh ya mon frère")
  * 🇮🇹 **Italien** (accent expressif "mamma mia", "ma qué bella jornada")
  * 🇩🇪 **Allemand** (phonétique martelée "achtung", "natürlich", "ponjour")
  * 🇨🇳 **Chinois** (permutation phonétique 'r' -> 'l', "ni hao", "tlès bien")
  * 🇷🇺 **Russe** (voix ferme et puissante "da camarade", "direction goulag")
  * 🇨🇦 **Québécois** (tournures authentiques "mon chum", "icitte", "c'est ben tiguidou")
  * 🇫🇷 **Marseillais** (accent provençal "peuchère", "fada", "mon sang", "putain con")
  * 🇬🇧 **British** (élégance distinguée "my dear", "splendid", "cheerio")
  * 🇲🇦 **Maghrébin** (argot urbain "wallah", "khouya", "sah to the sah")
  * 🇯🇵 **Anime / Waifu** (intonations japonaises "nani ?!", "omae wa mou shindeiru, baka")
  * 🇫🇷 **Français Standard** (synthèse claire et fluide)
* 🎚️ **Interrupteur d'argot :** Activez ou désactivez les expressions d'argot local pour ne conserver que l'intonation phonétique pure.
* 🗣️ **Synthèse croisée multilingue :** Capacité unique de faire prononcer du français par des moteurs étrangers pour une fidélité d'accent incomparable.

#### 2. 🌐 Traducteur Instantané 50+ Langues (100% Gratuit)
* ⚡ **Traduction & Synthèse en 1 clic :** Tapez en français, choisissez votre langue cible (Japonais 🇯🇵, Anglais 🇬🇧, Espagnol 🇪🇸, Allemand 🇩🇪, Russe 🇷🇺, Arabe 🇸🇦, Chinois 🇨🇳, Coréen 🇰🇷, etc.) et laissez FreePad traduire et vocaliser instantanément la phrase avec la voix native du pays directement dans Discord ou votre jeu !
* 🔑 **Zéro configuration requise :** Aucune clé API nécessaire pour la traduction et les voix globales.

#### 3. 💎 Intégration Native ElevenLabs Pro
* 🎙️ **Vos voix IA ultra-réalistes :** Connectez votre clé API ElevenLabs pour synchroniser et injecter toutes vos voix personnalisées, clonées ou officielles (Adam, Rachel, Antoni, Josh, Bella...).
* 🎛️ **Contrôles studio :** Réglages précis de la Stabilité et de la Similitude (Similarity Boost) avec le modèle neural `eleven_multilingual_v2`.

#### 4. ⚡ Expérience Gaming & Productivité
* ⌨️ **Raccourci Entrée direct :** Tapez votre texte et appuyez sur `Entrée` pour l'envoyer instantanément dans le microphone.
* 💾 **Enregistrement en bouton Soundboard :** Sauvegardez n'importe quelle réplique générée en bouton permanent sur votre grille FreePad.
* 📜 **Historique récent interactif :** Rejouez immédiatement n'importe quelle phrase précédente d'un simple clic.
* ✂️ **Chunking intelligent sans coupure :** Les longs textes sont automatiquement découpés le long de la ponctuation et réassemblés en un fichier audio continu sans latence.

#### 5. 🛠️ Outil de Diagnostic Autonome Pilote Micro APO
* 🩺 **Diagnostic_FreePad.bat inclus :** Outil autonome 1-fichier pour tester, vérifier et réparer en un clic l'injection micro APO sur votre vrai microphone actif sans ouvrir l'application.

---

### 📥 Téléchargement & Installation
* **Mise à jour automatique :** Si FreePad est déjà installé, il détecte automatiquement la nouvelle mise à jour au lancement.
* **Nouvelle installation :** Téléchargez **FreePad-Setup-{VERSION}.exe** ci-dessous et lancez l'installation.
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
    u_req.add_header("Content-Length", str(file_size))
    u_req.add_header("User-Agent", "FreePad-Release-Script")
    
    try:
        with urllib.request.urlopen(u_req) as u_resp:
            res = json.loads(u_resp.read().decode('utf-8'))
            print(f"Uploaded: {asset_name} -> {res.get('browser_download_url')}")
    except urllib.error.HTTPError as ue:
        print(f"Error uploading {asset_name}: {ue.code} {ue.read().decode('utf-8')}")

print(f"\nSUCCESS! Release {TAG} published on GitHub: https://github.com/{REPO}/releases/tag/{TAG}")
