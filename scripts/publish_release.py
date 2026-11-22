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

RELEASE_NAME = f"FreePad {TAG} — Voix Micro dans les Clips & Toggle On/Off Instant Replay"
BODY = f"""# 🎉 FreePad {TAG} — Voix Micro dans les Clips & Toggle On/Off Instant Replay

**Fait par zioti** — Le soundboard moderne, libre et open-source pour Windows avec injection micro native (100% sans câble virtuel).

---

### 🚀 Quoi de neuf dans la v{VERSION} ?

#### 🎙️ 1. Entendez votre propre voix dans vos Clips (Instant Replay F8) !
* 🔥 **Capture bi-directionnelle simultanée :** L'enregistreur instantané capture désormais non seulement les voix de vos potes sur Discord et le son de vos jeux, mais **mixe également votre propre voix** venant directement de votre microphone physique !
* ⏱️ **Synchronisation temporelle parfaite :** Le mixage WASAPI natif synchronise à la milliseconde près votre micro et le flux audio de vos écouteurs, avec égalisation automatique des volumes et limiteur anti-saturation.

#### 🎛️ 2. Bouton Toggle On/Off pour couper ou inclure son micro à volonté
* 🔘 **Bouton capsule dans la barre d'outils :** Un bouton dédié « Ma voix » permet d'activer ou de couper votre microphone dans les clips en un seul clic !
  * 🟢 **Vert (Activé) :** Votre voix est enregistrée dans le clip en même temps que vos potes.
  * ⚪ **Grisé / Barré (Désactivé) :** Seul le son de Discord et du jeu est enregistré, votre voix reste coupée.
* ⚙️ **Option dans les paramètres :** Retrouvez également le commutateur dans la fenêtre Paramètres > Enregistreur Instantané.
* 💾 **Mémorisation automatique :** Votre préférence est automatiquement sauvegardée sur votre PC.

#### 🌟 3. Rappel des Nouveautés Voix IA Neurales HD (Studio)
* 🎙️ Voix humaines ultra-réalistes Microsoft Neural HD gratuites sans compte ni clé API.
* 🚫 Strictement aucun mot parasite ou stéréotype ajouté, prononciation fidèle mot pour mot.
* 🎛️ Sélecteur de moteur vocal (Microsoft Neural HD, Google Traduction classique, ElevenLabs Pro).
* 🌍 Catalogue complet de 20 voix et accents (Français, Québécois, Belge, Suisse, Italien, Allemand, Russe, etc.).

---

#### 3. 🌍 Catalogue de 20 Voix & Accents Réalistes
* 🇫🇷 **Voix Françaises Studio :**
  * 👨 **Henri** (Homme Studio Pro, voix posée et naturelle)
  * 👩 **Denise** (Femme Studio Douce et fluide)
  * 👩 **Vivienne** (Femme Expressive HD)
  * 👨 **Remy** (Homme Gamer / Dynamique)
  * 👩 **Éloïse** (Femme Jeune & Dynamique)
* 🇨🇦 🇧🇪 🇨🇭 **Accents Francophones Authentiques :**
  * 🇨🇦 **Antoine & Sylvie** (Vrais accents québécois / canadiens)
  * 🇧🇪 **Gérard & Charline** (Vrais accents belges)
  * 🇨🇭 **Fabrice & Ariane** (Vrais accents suisses romands)
* 🎭 **Accents Internationaux (Parle Français avec l'accent naturel sans mot ajouté) :**
  * 🇮🇹 **Giuseppe** (Accent Italien authentique)
  * 🇩🇪 **Christoph** (Accent Allemand authentique)
  * 🇬🇧 **Ryan** (Accent Anglais / British)
  * 🇺🇸 **Guy** (Accent Américain)
  * 🇪🇸 **Alvaro** (Accent Espagnol)
  * 🇷🇺 **Dmitry** (Accent Russe)
  * 🇨🇳 **Yunxi** (Accent Chinois / Asiatique)
  * 🇯🇵 **Keita** (Accent Japonais)
  * 🇸🇦 **Shakir** (Accent Arabe)
  * 🌍 **Rafiki** (Accent Africain)

#### 4. 🌐 Traducteur 50+ Langues avec Voix Neurales Natives
* Tapez en français, traduisez vers n'importe quelle langue (Japonais, Anglais, Espagnol, Allemand, Russe, Chinois, Coréen...) et parlez dans le micro avec la voix neurale native du pays !

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
blockmap_src = os.path.join(ROOT_DIR, "release", f"FreePad Setup {VERSION}.exe.blockmap")
latest_yml = os.path.join(ROOT_DIR, "release", "latest.yml")

assets_to_upload = [
    (setup_src, f"FreePad-Setup-{VERSION}.exe"),
    (blockmap_src, f"FreePad-Setup-{VERSION}.exe.blockmap"),
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
