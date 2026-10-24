# 🚀 Protocole Obligatoire des Releases FreePad

> [!IMPORTANT]
> **RÈGLE DU PROJET FREEPAD :**
> À chaque nouvelle fonctionnalité ou correction majeure terminée, **une nouvelle version DOIT être compilée et publiée sur GitHub Releases**.
> C'est ce qui permet à l'ensemble des utilisateurs et potes recevant l'application d'obtenir instantanément la pop-up :
> **« Nouvelle mise à jour vX.X.X disponible ! [Mettre à jour] »**.

---

### 📋 Checklist à suivre à chaque mise à jour :

#### 1️⃣ Incrémenter le numéro de version
Dans `package.json`, mettre à jour le champ `"version"` :
* `1.0.0` ➔ `1.0.1` (pour des corrections de bugs, patchs mineurs)
* `1.0.0` ➔ `1.1.0` (pour une nouvelle fonctionnalité majeure comme Travis Scott F9, Bip Censure, etc.)

#### 2️⃣ Compiler l'Installeur Windows & les Métadonnées
Exécuter dans le dossier du projet :
```powershell
npm run dist
```
Cela produit dans le dossier `release/` :
* `FreePad Setup X.X.X.exe` (Le nouvel installeur avec logo officiel)
* `latest.yml` (Le fichier d'intégrité contenant le sha512 et la version pour l'auto-updater)

#### 3️⃣ Sauvegarder le code sur GitHub
```powershell
git add .
git commit -m "feat: release vX.X.X - description des nouveautés"
git push origin main
```

#### 4️⃣ Mettre en ligne la Release sur GitHub
1. Se rendre sur : **https://github.com/ZIOTI/FreePad/releases**
2. Cliquer sur **« Draft a new release »** (ou *Create a new release*).
3. **Tag version :** Tape `vX.X.X` (ex: `v1.0.1`) et clique sur *Create new tag*.
4. **Release title :** Ex: `FreePad v1.0.1 — Nouveautés audio & correctifs`
5. **Description :** Liste rapide des nouveautés (pourquoi tes potes doivent cliquer sur Mettre à jour).
6. **Pièces jointes obligatoires (Attach binaries) :**
   * Glisser-déposer **`release/FreePad Setup X.X.X.exe`**
   * Glisser-déposer **`release/latest.yml`**
7. Cliquer sur le bouton vert **« Publish release »**.

---

### 🤖 Comportement de l'Assistant IA
Chaque fois que l'utilisateur ou l'assistant termine une nouvelle fonctionnalité :
1. L'assistant vérifie ce fichier `RELEASES.md`.
2. L'assistant compile la version avec `npm run dist`.
3. L'assistant prépare le commit git et rappelle les étapes de publication pour que la communauté et les potes soient toujours synchronisés.
