# 🎛️ FreePad — Soundboard Moderne, Libre & Gratuite

**FreePad** est une alternative moderne, open-source et gratuite à Soundpad, conçue avec une interface soignée en mode sombre néon, un moteur audio ultra-faible latence et une compatibilité directe avec les fichiers Soundpad (`.spl`).

---

## ✨ Fonctionnalités Principales

1. **Interface Double Vue** :
   - **Mode Grille (Stream Deck / Pads)** : Grands boutons sonores dynamiques et colorés avec retour visuel réactif et affichage des touches.
   - **Mode Liste (Soundpad classique)** : Tableau complet avec recherche en temps réel, tri par catégories et métadonnées.

2. **Moteur Audio Avancé** :
   - Mixage Web Audio API haute fidélité (Float32, sans compression destructive).
   - **Double Contrôle de Volume** : Réglage séparé pour *Mes Écouteurs* et *Diffusion Vocale*.
   - **Normalisation dynamique (Anti-Saturation)** : Compresseur audio intégré pour éviter les saturations désagréables.
   - **Visualiseur Audio en Direct** : Spectre de fréquences FFT et oscilloscope animés en temps réel.
   - **Bouton d'Arrêt d'Urgence (Panic Stop)** : Touche `Échap` pour couper instantanément le son avec fondu rapide anti-clic.

3. **Compatibilité Totale Soundpad (`.spl`)** :
   - Importation en un clic de vos listes Soundpad existantes (`.spl` ou `.xml`).
   - Exportation de vos listes FreePad au format Soundpad standard.

4. **Raccourcis Clavier Globaux** :
   - Assignation simple de touches et combinaisons (`Num 1`, `Ctrl+Alt+F`, etc.).
   - Modale intuitive d'enregistrement de touches.

---

## 🚀 Démarrage

### Lancement Rapide
Double-cliquez simplement sur :
```
Lancer_FreePad.bat
```

Ou en ligne de commande :
```bash
cd FreePad
npm run app
```

Pour lancer uniquement le serveur d'interface web (accessible aussi depuis votre téléphone sur le réseau local) :
```bash
npm run dev
```

---

## 🎙️ Diffusion Directe dans Discord & Jeux Vidéo (100% Sans Câble)

FreePad utilise une **injection matérielle directe (APO)** dans votre vrai microphone :
1. **Zéro câble virtuel nécessaire** : Plus besoin de VB-Audio Virtual Cable, Voicemeeter ou Soundpad.
2. Dans FreePad > **Paramètres** :
   - Cliquez sur **« ⚡ Activer l'injection directe dans mon micro (1 clic) »**.
   - Le pilote s'injecte directement dans vos microphones réels (Casque, USB, Realtek, etc.).
3. Dans Discord / Jeux :
   - Conservez simplement votre **micro habituel**.
   - ⚠️ **Réglage Discord conseillé** : Dans *Discord > Voix & Vidéo*, désactivez la **Suppression du bruit (Krisp)** (mettre sur *Aucun*) et désactivez **Annulation de l'écho** pour que Discord ne filtre pas les sons du soundboard !

*Fait par zioti*
