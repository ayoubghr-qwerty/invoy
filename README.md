<div align="center">

<img src="public/logo.png" width="110" alt="Invoy logo"/>

# Invoy

**Offline desktop invoicing & stock management, built for Algerian businesses.**

Proforma invoices · Delivery notes · Payment receipts · Purchase orders · Inventory

**English** · [Français](README.fr.md) · [العربية](README.ar.md)

[![Version](https://img.shields.io/badge/version-2.2.0-3b82f6)](src-tauri/tauri.conf.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078d4)](#-getting-started)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-f59e0b)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev)
[![Tests](https://img.shields.io/badge/tests-61%20passing-8b5cf6)](#-getting-started)

<img src="docs/screenshots/facture-light.png" alt="Invoy — Proforma invoice with automatic TVA and Droit de Timbre calculation" width="880"/>

*Invoice in progress — article rows, automatic totals (HT / TVA / Droit de Timbre / TTC) and the amount written out in words.*

</div>

---

## Why Invoy

Most small businesses in Algeria still draft invoices in Word. Invoy replaces that with a fast, **100% offline** desktop app: no account, no server, no cloud — your data stays on your machine. It speaks the local business language out of the box: **DZD money formatting**, **TVA 19%**, **Droit de Timbre**, fiscal fields (**NIF**, **NIS**, **Agrément**, **N° d'articles**), a **French / Arabic (RTL)** interface, and **silent one-click PDF export** — no print dialog, ever.

## ✨ Features

### 📄 Business documents
- **Proforma invoices & invoices** — automatic numbering per document type, TVA 19%, Droit de Timbre, amount written out in words (*arrêté*), A4 or A5, custom document fonts & colors
- **Delivery notes** (*Bon de Livraison*) — decrement stock automatically on export
- **Payment receipts** (*Bon de Versement*) — cash or cheque
- **Delivery schedule** (*Programme de Livraison*) — organize the day's route with multiple clients, time slots and articles per client
- **Goods notes** (*Marchandise*) — record purchases and push them into stock
- **Purchase orders** (*Bon de Commande*) — draft → sent → partially received → received, with reception updating stock

<img src="docs/screenshots/stock-alerts.png" alt="Invoy — Stock alerts page showing low-stock and out-of-stock products" width="880"/>

### 📦 Inventory
- Product catalog with **min / max quantities**, cost & sale prices, supplier, notes
- Live status per product — **OK / low stock / out of stock / overstock** — with an alert badge in the sidebar
- Complete **movement ledger** (in / out / adjustment) with reasons: purchase, sale, return, inventory count, damage
- Deleting a document **restores stock** (within available quantities) — the ledger stays consistent

### 👥 Clients
- Full fiscal profile (NIF, NIS, Agrément, N° d'articles) printed on documents
- **Excel import** with column mapping and preview of the first rows
- Per-client **document history** — reload any past invoice, delivery note or receipt in one click

### 🖥️ Experience
- **French + Arabic** interface with full right-to-left support
- **Dark mode**
- **Silent PDF export** via WebView2 `PrintToPdf` — no dialog, straight to file
- **DOCX export** with a layout identical to the PDF
- **JSON backup / restore** to move all data between machines
- Keyboard shortcuts, input validation, French number formatting (`1 450,00 DA`)

## 📸 Screenshots

| Invoice — dark mode | Arabic (RTL) interface |
|---|---|
| <img src="docs/screenshots/facture-dark.png" width="420" alt="Invoice page in dark mode"/> | <img src="docs/screenshots/arabic.png" width="420" alt="Arabic right-to-left interface"/> |

| Stock catalog with status badges | Client list |
|---|---|
| <img src="docs/screenshots/stock.png" width="420" alt="Stock catalog with OK / low / out statuses"/> | <img src="docs/screenshots/clients.png" width="420" alt="Client list"/> |

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Desktop shell | [Tauri 2](https://tauri.app) (Rust backend, WebView2 frontend host) |
| Frontend | React 18 · Vite 5 · Tailwind CSS 3 · Radix UI · lucide-react |
| Documents | PDF via WebView2 `PrintToPdf` (Rust) · DOCX via `docx` · Excel import via `xlsx` |
| Data | Local JSON store (`@tauri-apps/plugin-store`) — no server |
| Tests | Vitest — 61 unit tests (money parsing, stock ledger, i18n, validation…) |

## 🚀 Getting started

**Prerequisites**
- Node.js 18+
- Rust toolchain `stable-x86_64-pc-windows-msvc` (needs MSVC Build Tools on Windows)
- WebView2 Runtime (pre-installed on Windows 10/11 with Edge)

```powershell
# install dependencies
npm install

# run in dev mode (hot reload + Tauri window)
npm run tauri:dev

# run the test suite
npm test

# production build (MSI + NSIS installers)
$env:CARGO_BUILD_JOBS = '1'   # avoids OOM on machines with many cores
npm run tauri:build
```

Installers land in `src-tauri\target\release\bundle\` (`msi\` and `nsis\`).

## 🗂️ Project structure

```
├─ src/                    # React app (pages, components, utils)
│  ├─ pages/               # Facture, Clients, Bon de Livraison, Stock, …
│  ├─ electron-docx/       # DOCX generator (layout identical to PDF)
│  ├─ utils/               # money, i18n, validation, stock store, PDF templates
│  └─ __tests__/           # Vitest unit tests
├─ src-tauri/              # Rust backend
│  └─ src/pdf.rs           # Silent PDF export via WebView2 PrintToPdf
├─ public/fonts/           # Inter (latin) + Tajawal (arabic)
└─ docs/screenshots/       # Screenshots used in the READMEs
```

## 📝 Notes

- **PDF export is Windows-only** (it relies on WebView2); DOCX export works everywhere the app runs
- All data (clients, documents, stock, settings) lives in a local store file — use **Paramètres → Sauvegarde** to export/restore it
- The frontend runs in a plain browser too (`npx vite`) with an in-memory fallback of the API — handy for quick UI work

## 📄 License

Released under the [MIT License](LICENSE) © 2026 ayoubghr-qwerty.

*Invoy was originally an Electron app — it was ported to Tauri 2 for a much smaller binary and lower memory footprint, keeping the exact same UI and document layouts.*
