# Invoy Fix Plan

**Date:** 2026-08-30
**Status:** Awaiting approval before implementation

---

## Principles
1. **Security first** — S1, S2, S3 must ship together before anything else
2. **No regressions** — every fix gets a verification step
3. **Minimal blast radius** — small, focused commits; one concern per change
4. **Existing functionality preserved** — PDF/DOCX export must continue working after each phase

---

## Phase 1: Security (Critical) — BLOCKING

### Fix 1.1 — XSS Protection in PDF Templates
- **Findings:** S1 (XSS in pdfTemplate.js)
- **File:** `src/utils/pdfTemplate.js`
- **Changes:**
  - Add `escapeHtml(str)` utility at top of file (escape `&`, `<`, `>`, `"`, `'`)
  - Apply to ALL user-input interpolations: `settings.organisation`, `settings.proprietaire`, `settings.adresse`, `settings.logo`, `client.nom`, `client.adresse`, `client.telephone`, `client.nif`, `client.nis`, `client.agrement`, `client.articlesImp`, `a.designation`, `notes`
  - Also fix `numberToWordsFR` output (already safe — no HTML chars)
  - Fix `buildBonVersementPdf` notes interpolation (line 233)
- **Verification:** Export PDF with client name `<script>alert(1)</script>` → should render as literal text
- **Test criteria:** No script execution in WebView2; PDF text shows escaped HTML entities

### Fix 1.2 — Enable CSP
- **Findings:** S2 (CSP disabled)
- **File:** `src-tauri/tauri.conf.json`
- **Changes:** Set `"csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"`
- **Verification:** Launch app, navigate, export PDF — no console CSP violations
- **Test criteria:** PDF export still works (data: URLs for PDF content need `img-src data:` if logo uses data URI)

### Fix 1.3 — Restrict FS Permissions
- **Findings:** S3 (unrestricted fs)
- **File:** `src-tauri/capabilities/default.json`
- **Changes:** Replace `"path": "**"` with scoped paths:
  ```json
  "allow": [{ "path": "$APPDATA/**" }, { "path": "$DOWNLOAD/**" }, { "path": "$DOCUMENT/**" }]
  ```
- **Verification:** App launches, store read/write works, backup export/import works, PDF/DOCX save dialogs work
- **Test criteria:** `tauri:build` succeeds; app launches; all existing functionality works

### Fix 1.4 — Error Message Sanitization
- **Findings:** S5 (path leakage)
- **File:** `src-tauri/src/pdf.rs`
- **Changes:** Replace raw `{e}` in error strings with generic messages (e.g., "PDF generation failed")
- **Verification:** Trigger error condition, confirm frontend sees generic message
- **Test criteria:** No filesystem paths in error toasts

### Fix 1.5 — Backup Import Validation
- **Findings:** S6 (no validation)
- **File:** `src/pages/Parametres.jsx`
- **Changes:**
  - Add `validateBackup(data)` function that checks:
    - `settings` is object with expected keys
    - `clients` is array of objects with `nom` string
    - `counters` is object with numeric values
    - `produits` is array
    - `historique` is array
    - Strip `__proto__` keys from all objects
    - Limit array sizes (clients ≤ 10000, historique ≤ 50000)
  - Auto-create backup before restore (write current state to temp file)
- **Verification:** Import valid backup works; import corrupted file shows error; import XSS payload in settings.organisation shows escaped text
- **Test criteria:** No crashes on bad input; data integrity preserved

### Fix 1.6 — Logo Upload Content Validation
- **Findings:** S7 (extension-only check)
- **File:** `src/tauriApi.js`
- **Changes:**
  - Read first 8 bytes of selected file
  - Validate magic bytes: PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), GIF (`47 49 46 38`), WebP (`52 49 46 46`)
  - Reject if magic bytes don't match
  - Limit file size to 5MB
- **Verification:** Select `.html` renamed to `.png` → rejected; select real PNG → accepted
- **Test criteria:** Logo displays correctly in PDF after upload

---

## Phase 2: Data Integrity (High)

### Fix 2.1 — Counter Key Unification
- **Findings:** D1 (counter mismatch)
- **Files:** `src/pages/Parametres.jsx`, `src/pages/BonLivraison.jsx`, `src/pages/BonVersement.jsx`
- **Changes:**
  - Standardize ALL counter keys to match what pages actually use:
    - `facture` (already correct)
    - `bonLivraison` (Parametres currently uses `livraison`)
    - `bonVersement` (Parametres currently uses `versement`)
    - `programme` (already correct)
    - `marchandise` (already correct)
  - In `Parametres.jsx`: Change `COUNTER_DOCS` keys from `'livraison'` → `'bonLivraison'` and `'versement'` → `'bonVersement'`
- **Verification:** Export BonLivraison → counter increments in Parametres; reset counter in Parametres → next BL gets 0001
- **Test criteria:** All 5 document types show correct counter in Parametres; reset works for all

### Fix 2.2 — Store Corruption Recovery
- **Findings:** D3 (no error handling)
- **Files:** `src/tauriApi.js`, all page components
- **Changes:**
  - Wrap `storeGet` in `src/tauriApi.js` with try/catch, return default on error
  - Show toast warning when fallback used: "Data store corrupted, using defaults"
  - Add `validateStoreData(key, data)` helper for type checking
- **Verification:** Manually corrupt `invoy-data.json` → app launches with defaults, shows warning
- **Test criteria:** No crashes on corrupted store; user informed

### Fix 2.3 — Atomic Store Writes
- **Findings:** D4 (no atomic writes)
- **File:** `src/tauriApi.js`
- **Changes:**
  - Before `store.save()`, write to `invoy-data.json.tmp`
  - On success, rename `.tmp` → `.json`
  - On failure, delete `.tmp`, keep original
- **Verification:** Kill app during save → original file intact
- **Test criteria:** Store never corrupted by crash

### Fix 2.4 — Backup Auto-Before-Restore
- **Findings:** D2 (restore without backup)
- **File:** `src/pages/Parametres.jsx`
- **Changes:**
  - Before `importBackup` writes, auto-export current state to `$DOWNLOAD/invoy-auto-backup-{timestamp}.json`
  - Show toast: "Auto-backup saved to {path}"
- **Verification:** Import backup → auto-backup file created in Downloads
- **Test criteria:** Can recover from bad import using auto-backup

---

## Phase 3: Business Logic (High)

### Fix 3.1 — Delivery Notes Fiscal IDs
- **Findings:** B1 (missing fiscal on BL)
- **File:** `src/utils/pdfTemplate.js`
- **Changes:** Change `buildBonLivraisonPdf` line 206: `false` → `true` for `showFiscal`
- **Verification:** Export BL → seller RC/NIF/NIS visible in header
- **Test criteria:** Fiscal IDs appear on BL PDF; remain hidden on BV PDF

### Fix 3.2 — RTL Support in PDFs
- **Findings:** B2 (no RTL in PDF)
- **File:** `src/utils/pdfTemplate.js`
- **Changes:**
  - Pass `lang` to all template builders
  - Add `dir="auto"` to all `<span>` wrapping user content (already done for `settings.organisation`)
  - Add `dir="auto"` to `clientHtml` value spans, `itemsTableHtml` designation cells, notes blocks
  - Set `<html lang="${lang}">` instead of hardcoded `fr`
- **Verification:** Switch to Arabic → export PDF → text reads right-to-left
- **Test criteria:** Arabic content renders RTL; French content unchanged

### Fix 3.3 — Arabic Number-to-Words
- **Findings:** B3 (French-only)
- **Files:** `src/utils/numberToWords.js`, `src/utils/pdfTemplate.js`
- **Changes:**
  - Add `numberToWordsAR(amount)` function in `numberToWords.js`
  - In `pdfTemplate.js`, use `lang === 'ar' ? numberToWordsAR(ttc) : numberToWordsFR(ttc)`
- **Verification:** Arabic mode → PDF shows Arabic words for amount
- **Test criteria:** Both FR and AR produce correct words; edge cases (0, decimals, millions) handled

### Fix 3.4 — Per-Article Rounding Fix
- **Findings:** B5 (rounding drift)
- **File:** `src/components/ArticlesTable.jsx`
- **Changes:**
  - Remove `toFixed(2)` from per-article montant calculation
  - Only round at display level (in PDF template and totals display)
- **Verification:** Add 100 articles with 0.333 unit price → total matches expected
- **Test criteria:** Sum of displayed amounts equals displayed total

---

## Phase 4: UX & Accessibility (Medium)

### Fix 4.1 — Unsaved Changes Guard
- **Findings:** U1 (no dirty tracking)
- **Files:** `src/App.jsx`, all form pages
- **Changes:**
  - Add `isDirty` state to each form page, set true on any field change
  - Add `beforeunload` handler in `App.jsx` when dirty
  - Add confirmation modal before sidebar nav when dirty
  - Clear dirty on successful save/export
- **Verification:** Fill form → click sidebar → confirmation shown; dismiss → data preserved
- **Test criteria:** No data loss on accidental navigation

### Fix 4.2 — Loading State
- **Findings:** U3 (blank screen on init)
- **File:** `src/App.jsx`
- **Changes:**
  - Add `isLoading` state, show skeleton/spinner while settings load
  - Use existing Tailwind skeleton classes
- **Verification:** Launch app → brief skeleton visible before content
- **Test criteria:** No blank screen flash

### Fix 4.3 — Dark Mode Hardcoded Colors
- **Findings:** U7 (inline white/dark colors)
- **Files:** `src/pages/FactureProforma.jsx`, `src/components/ArticlesTable.jsx`
- **Changes:**
  - Replace `background: 'white'` with `background: 'var(--bg-card)'`
  - Replace `color: '#64748b'` with `color: 'var(--text-secondary)'`
  - Replace `borderRight: '1px solid #e2e8f0'` with CSS variable
- **Verification:** Toggle dark mode → all elements theme correctly
- **Test criteria:** No white backgrounds in dark mode

### Fix 4.4 — Toast Timer Leak
- **Findings:** Q3 (timer leak)
- **File:** `src/App.jsx`
- **Changes:**
  - Store timer ref, clear previous timer before setting new one
  ```js
  const timerRef = useRef(null);
  function showToast(msg, type = 'success') {
    clearTimeout(timerRef.current);
    setToast({ msg, type });
    timerRef.current = setTimeout(() => setToast(null), 3500);
  }
  ```
- **Verification:** Rapid toast calls → only latest message shown, no premature dismiss
- **Test criteria:** Toast displays for full 3.5s regardless of call frequency

---

## Phase 5: i18n (Medium)

### Fix 5.1 — PDF Template Labels i18n
- **Findings:** I1 (hardcoded French in PDF)
- **File:** `src/utils/pdfTemplate.js`
- **Changes:**
  - Pass `lang` and `t` function to all template builders
  - Replace hardcoded labels: "Arrêté la présente facture" → `t(lang, 'pdf_arrete')`, etc.
  - Add missing keys to `src/utils/i18n.js`
- **Verification:** Arabic mode → all PDF labels in Arabic
- **Test criteria:** Both languages produce complete, correctly labeled PDFs

### Fix 5.2 — Export Dropdown i18n
- **Findings:** I2 (hardcoded French)
- **File:** `src/components/ExportButton.jsx`
- **Changes:**
  - Accept `lang` prop, use `t()` for "Exporter", "Exporter en PDF", "Exporter en DOCX", "Plus d'options"
- **Verification:** Arabic mode → dropdown labels in Arabic
- **Test criteria:** All strings translated

---

## Phase 6: Code Quality (Low)

### Fix 6.1 — Remove Dead Code
- **Findings:** Q1, Q2
- **Files:** `src-tauri/src/lib.rs`, `src/electron-docx/docxGenerator.js`
- **Changes:** Remove `ping` command and `noTableBorder` function
- **Verification:** App builds and runs without errors
- **Test criteria:** No references to removed code

### Fix 6.2 — Test Coverage
- **Findings:** Q5 (no tests)
- **Files:** New test files
- **Changes:**
  - Add `vitest` to project
  - Write unit tests for: `numberToWordsFR`, `numberToWordsAR` (after 3.3), `escapeHtml`, `calcTimbre`
  - Write integration test for PDF template builders (HTML output contains expected elements)
- **Verification:** `npm test` passes
- **Test criteria:** All tests green; coverage for critical functions ≥ 80%

---

## Execution Order

```
Phase 1 (Security) → Build → Verify → Commit
Phase 2 (Data Integrity) → Build → Verify → Commit
Phase 3 (Business Logic) → Build → Verify → Commit
Phase 4 (UX) → Build → Verify → Commit
Phase 5 (i18n) → Build → Verify → Commit
Phase 6 (Code Quality) → Build → Verify → Commit
```

**Build verification after each phase:** `npm run tauri:build` must succeed.
**Functional verification after each phase:** Launch app, create client, create invoice, export PDF + DOCX.

---

## Estimated Scope

| Phase | Fixes | Risk | Effort |
|-------|-------|------|--------|
| 1. Security | 6 | Medium (CSP may break data: URLs) | ~2h |
| 2. Data Integrity | 4 | Low (store changes are isolated) | ~1h |
| 3. Business Logic | 4 | Medium (PDF template changes) | ~2h |
| 4. UX | 4 | Low (UI-only changes) | ~1.5h |
| 5. i18n | 2 | Low (string changes) | ~1h |
| 6. Code Quality | 2 | Low (cleanup) | ~1h |
| **Total** | **22** | | **~8.5h** |
