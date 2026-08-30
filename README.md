# Invoy

Gestion commerciale de bureau — Factures (proforma), Bons de livraison, Bons de versement, Programme de livraison, Marchandise, Produits, Clients, Paramètres. Française / algérienne (DZD).

Application de bureau **Tauri v2** (anciennement Electron) + **React 18** + **Vite 5** + **Tailwind 3**.

## Prérequis

- **Node.js** 18+ et npm
- **Rust** (toolchain `stable-x86_64-pc-windows-msvc`) — nécessite Build Tools MSVC sur Windows
- **WebView2 Runtime** (pré-installé sur Windows 10/11 avec Edge) — fourni par le système, non embarqué

## Installation

```powershell
npm install
```

## Développement (rechargement à chaud)

Lance à la fois le serveur Vite et la fenêtre Tauri (mode dev) :

```powershell
npm run tauri:dev
```

> En mode dev, l'application charge l'URL du serveur Vite (`http://localhost:5173`).

## Build de production (installateurs)

```powershell
# IMPORTANT (obligatoire sur cette machine) :
# 1 Go de builds parallèles le crash en mémoire (OOM, 8 cœurs / ~2.7 Go libres).
# Limitez à 1 job Rust avant de builder.
$env:CARGO_BUILD_JOBS='1'

npm run tauri:build
```

Les installateurs sont générés dans `src-tauri\target\release\bundle\` :

- `msi\Invoy_2.0.0_x64_en-US.msi`
- `nsis\Invoy_2.0.0_x64-setup.exe`

Le binaire autonome est `src-tauri\target\release\invoy.exe`.

## Compiler seulement le frontend

```powershell
npm run react-build        # vite build -> dist/
```

## Structure

- `src/` — application React (pages, composants). Appelle uniquement `window.api.*`
- `src/tauriApi.js` — implémentation Tauri de `window.api` (store, dialogs, exports, excel), installée avant le rendu dans `src/main.jsx`
- `src/electron-docx/docxGenerator.js` — générateur DOCX (port navigateur du module Electron d'origine, layout identique)
- `src/utils/pdfTemplate.js` — gabarits HTML des PDF (conservés à l'identique pour la fidélité des thèmes)
- `src-tauri/` — backend Rust Tauri + config
- `src-tauri/src/pdf.rs` — export PDF via WebView2 `PrintToPdf` silencieux (Windows uniquement)

## Notes

- **PDF** : export silencieux direct vers fichier via une fenêtre WebView2 cachée (`ICoreWebView2_7::PrintToPdf`), aucune boîte de dialogue. Windows uniquement.
- **DOCX / PDF** : le thème (couleurs, polices, présentation) est fidèle à l'ancienne version Electron.
- **Données** : stockées dans `invoy-data.json` (store Tauri), sauvegarde via `Paramètres → sauvegarde`.
- La commande `tauri` est disponible via npm (`npm run tauri -- <args>`).

## Dépannage

| Problème | Solution |
|---|---|
| Build Rust crash (OOM) | Redémarrez avec `$env:CARGO_BUILD_JOBS='1'` puis `npm run tauri:build` |
| Fenêtre vide en dev | Vérifiez que le serveur Vite tourne sur le port 5173 (strictPort) |
| Export PDF échoue | Nécessite Windows + WebView2 Runtime installé |
