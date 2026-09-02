# Invoy v2.2 — Full Audit Report V2

**Date**: 2026-09-02 | **Scope**: 46 frontend files + Rust backend + config
**Method**: 4 parallel reviewer agents + manual verification of every CRITICAL/HIGH claim against source.
**Previous audit**: 87 findings (2026-09-01); most P0s fixed. This audit verifies those fixes held and hunts regressions introduced BY the fix wave.

---

## VERDICT SUMMARY

| Severity | Count | Notes |
|----------|-------|-------|
| CRITICAL | 4 | Wrong amounts in exported documents (DOCX totals 100x, legal text 100x) |
| HIGH | 9 | Stock ledger integrity, PDF layout, money parsing |
| MEDIUM | 10 | Fragility, stale UI, dead code, validation gaps |
| LOW | 8 | i18n placeholders, minor hygiene |

**Headline**: The cents-migration (v2.2) was applied to the 4 pages' own calculations but **NOT to the DOCX generator** and **NOT to numberToWords call sites** — DOCX exports and "Arrêté" legal text now show **100x the real amount** whenever exported. PDF is affected on the numberToWords line and FactureProforma pageSize only.

---

## CRITICAL (wrong money on real documents)

### C1. DOCX totals display 100x the amount — ALL 4 doc types
- `docxGenerator.js:538-545` — `formatNum(totaux.ht)` etc: pages now pass **cents** (from `sumCents`/`calcTva`), but `formatNum` = `parseFloat(n).toLocaleString(...)` — no /100.
  - FactureProforma: HT/TVA/Timbre/TTC rows (538-545) + `numberToWordsFR(totaux.ttc)` (648) — words also 100x.
  - BonLivraison: `formatNum(total)` (778) — total is cents → "300 100,00 DA" instead of "3 001,00 DA".
  - BonVersement: `formatNum(total)` (849), `montantVerse` cells — mixed.
  - ProgrammeLivraison: same pattern (~1062).
- **Contrast**: PDF path is correct (`fmtCents` = `fromCents`). On-screen is correct. **Only DOCX is broken.**
- **Fix**: `formatNum(centsToDinars(x))` in buildTotals/totalTable/verseTable; `numberToWordsFR(totaux.ttc / 100)`; BonVersement montantVerse display cells.
- **Risk**: Contained to docxGenerator; must keep items-table rows (dinars via parseFloat of `art.montant` which is still stored in dinars — see C4) untouched.

### C2. PDF + DOCX "Arrêté" legal text reads cents as dinars
- `pdfTemplate.js:230-232` — `numberToWordsAR/FR(totaux.ttc || 0)` where `totaux.ttc` is **cents**. On-screen twin at `FactureProforma.jsx:590` correctly does `ttc / 100`. PDF says "cent cinquante mille cinquante dinars" for a 1 500,50 DA invoice.
- **Fix**: divide by 100 at both call sites (pdfTemplate.js:230, docxGenerator.js:648).

### C3. FactureProforma ignores A5 selection in generated documents
- `FactureProforma.jsx:158-169` — `docData` has **no `pageSize`** field. Consequences:
  - DOCX: `docxGenerator.js:559` `data.pageSize || "A4"` → always A4 layout.
  - PDF: `buildFacturePdf(docData, settings)` → default "A4" → A4 margins/fonts on A5 paper (`exportPdf` does receive `pageSize` state for paper size only — mismatch).
  - Print preview memo (`234-263`) hardcodes default + omits pageSize dep.
- Other 3 pages wire `pageSize` correctly into docData + memo deps (verified BonLivraison 107/180, BonVersement, ProgrammeLivraison).
- **Fix**: add `pageSize` to docData + memo deps in FactureProforma. Trivial, matches sibling pages.

### C4. BonVersement history saves mixed units (dinars + cents in same field)
- `BonVersement.jsx:159-160` — `montant: parseFloat(montantVerse) || total` — first operand **dinars**, fallback `total` **cents**. History rows become unit-inconsistent → history totals unreliable.
- Line 111 already computes `montantVerseCents` (correct); 159/160 should use `montantVerseCents || total`.
- **Fix**: one line, use cents everywhere in that saveToHistory call.

---

## HIGH

### H1. Marchandise rename orphans its stock item
- `Marchandise.jsx:159-165,169-174` — edit path finds old qty by **new** name; after renaming `designation`, old lookup returns 0 → delta = full new qty → **new stock item created**, old one stays with its qty (double-counted stock).
- **Fix**: match old record lines by index/id (`produits` lines have `id`), not by name; or store `stockProductId` link per line. Prefer id-matching (no schema change; `p.id` exists — see line 105 usage).
- **Risk**: Medium — sync logic rewrite; needs careful test with rename + repeated edit.

### H2. Marchandise delete can drive stock negative
- `Marchandise.jsx:235-244` — reversal creates "out" movements with no `currentQty >= qty` guard. If units were sold since, stock goes negative.
- **Fix**: guard before reversal — clamp to available qty (skip/adjust with toast) or block delete when insufficient.
- **Risk**: Low — additive guard.

### H3. PO delete orphans received stock
- `PurchaseOrders.jsx:144-150` — `deletePO` only filters the list. Received movements + stock increments survive → phantom stock.
- **Fix**: mirror Marchandise.deleteRecord reversal (with H2 guard) for movements `source==="purchase"` && `reference===po.number` before deleting.
- **Risk**: Low — additive.

### H4. PO partial receive creates no stock movement
- `stockStore.js:118-139` — `if (!line.receivedMovementId)` creates movement only on FIRST receive. Receiving 5 then 5 more: qtyReceived=10 but only 5 entered stock. Stock ledger desync — the "idempotency fix" overcorrected.
- **Fix**: always create a movement for `received.qtyReceived` (each receive is a distinct physical event); keep `receivedMovementId` only as last-movement ref, or drop the guard entirely. Receive modal submit = one physical receipt by definition.
- **Risk**: Low-Medium — pure additive movement per receive; re-receiving same line twice is legitimate (two deliveries).

### H5. Stock.jsx save writes currentQty with no movement (ledger divergence)
- `Stock.jsx` save → `upsertStockProduct` directly (no `addMovement`). `currentQty` no longer equals sum of movements — audit trail broken for manual edits.
- **Fix**: on manual qty change, create an `adjust` movement (type in/out, signed delta, reason "manual") — StockMovements.jsx already has this pattern (signed adjust, verified lines 93-98).
- **Risk**: Low — mirrors existing pattern.

### H6. `toCents` returns 0 for French decimal comma ("2,5" → 0)
- `money.js:1-6` — `Number("2,5")` = NaN → 0. Number inputs shield most flows, but paste/autofill/history-reload can inject comma strings → silent zero amounts.
- **Fix**: normalize in toCents: strip spaces, replace `,`→`.` when single comma. Covered by existing 8 pdfTemplate/money tests + add cases.
- **Risk**: Low — toCents on numbers unaffected; string parsing only broadens accepted inputs.

### H7. Multi-word fonts break in PDF (`Times New Roman` is in the font list)
- `pdfTemplate.js:30` — `escapeCss` regex strips spaces → `font-family: TimesNewRoman` → invalid → Arial fallback silently. Font list from Parametres includes "Times New Roman" (verified present in settings font array).
- **Fix**: allow spaces in escapeCss, or quote the family name: `font-family: "${safeFont}", Arial, sans-serif` (quote + space-allowing escape).
- **Risk**: Low — CSS-in-PDF only.

### H8. allowlist missing 3 legacy store keys (latent)
- `tauriApi.js:20-32` misses `products`, `history`, `programmeClients` (used by `migrate.js:41,50,71`). Today harmless because migration is dead code (see M1) — `isDbReady()` is always false. The moment SQL/withGlobalTauri is enabled, migration throws INVALID_STORE_KEY and legacy data is not migrated.
- **Fix**: add the 3 keys. Trivial, zero behavior change today.
- **Risk**: None.

### H9. lowStockCount badge goes stale
- `App.jsx:100-106` — refreshes only on app start + navigation to stock pages. Receiving a PO / saving Marchandise on their pages doesn't refresh the badge shown in the sidebar.
- **Fix**: cheap event: `window.dispatchEvent(new CustomEvent("invoy:stock-changed"))` from stockStore mutations; App listens and re-fetches count.
- **Risk**: Low — additive listener; keep the page-navigation refresh too.

---

## MEDIUM

| # | Finding | Evidence | Fix | Risk |
|---|---------|----------|-----|------|
| M1 | **SQL layer is dead code** — `window.__TAURI__` never defined (`withGlobalTauri` off), so `db.js` always falls back to store; `tauri-plugin-sql` compiled, initialized, capabilities missing `sql:default`. ~90 lines dead + binary weight | `db.js:4-15`, `tauri.conf.json` (no withGlobalTauri), `capabilities/default.json` | Decide: (a) remove plugin + db.js/migrate.js entirely, or (b) wire properly (npm @tauri-apps/plugin-sql invoke + capability). Recommend (a) now — store works, SQL unused | Low if (a); (b) is a project |
| M2 | `pdf.rs:90` — `with_webview` Err returns without closing window (zombie) | `?` at line 90 skips `window_clone.close()` | close before `?` return: `if let Err(e) = ... { let _ = window.close(); return Err(...) }` | None |
| M3 | `pdf.rs` — no upper bound on data: URL; logo embedded as base64 (≤5MB → ~15-20MB URL) may exceed WebView2 data-URL limits | `tauriApi.js` allows 5MB image; htmlContent ≤10MB → 3x percent-encoding | Enforce htmlContent ≤2MB in Rust + toast; (optional later: temp-file + file:// for large docs) | Low |
| M4 | `pdf.rs` hardcoded 2s+500ms render sleeps — big invoices may print before render completes (worked at 203 bytes; 100-line invoice unverified) | `pdf.rs` sleeps | Poll `document.readyState==="complete"` via CDP `Runtime.evaluate` (loop ≤10s), then printToPDF | Medium — replaces sleeps with loop; test on large doc |
| M5 | `pdf.rs` `page_size` accepts any string → silently A4 | `page_size_inches` `_ => A4` | Explicit allowlist A4/A5, else Err | None |
| M6 | `pdf.rs` — caller-controlled `file_path` written via raw `std::fs::write`, bypassing fs capability scoping | line ~248 | Guard: reject if not ends_with(".pdf") (path still user-chosen via native save dialog — acceptable for desktop app) | None |
| M7 | `pdf.rs` NavigationCompleted can double-fire → duplicate printToPDF attempt (send after send ignored today) | handler design | `printed` AtomicBool guard in closure | None |
| M8 | `stockStore.js:151-163` `syncProduitsNames` dedupes produits by name only (case-insensitive) — fine; but pushes plain names while Marchandise sync uses name+supplier — two stock items same name different supplier → one produits entry (OK) — **no bug**; real note: `getMovements` `filters.to` uses `<=` with ISO strings incl. time (inclusive enough) | — | none (rejected, see below) | — |
| M9 | `App.jsx` — no `unhandledrejection` listener; async store failures can be silent | — | add global handler → showToast + console | Low |
| M10 | `Parametres.jsx:129-139` clearAllData misses `darkMode` | KEYS array | add "darkMode" (decide: also reset theme? yes — "clear all" means wipe) | None |

## LOW

| # | Finding | Fix |
|---|---------|-----|
| L1 | Hardcoded UI strings: `PurchaseOrders.jsx:353,359,369` ("Qté","Unit","Prix"), `:224` "Qté reçue"; `Stock.jsx:248` "pcs, kg, L..."; `Marchandise.jsx:454,464` placeholders; `PurchaseOrders.jsx:105` English fallback `\|\| "Supplier required"` | add i18n keys FR+AR, drop `\|\|` fallback |
| L2 | `pdf.rs` logs file path to stderr (fine locally; keep) | none |
| L3 | `Stock.jsx:157-161` delete double-click → two calls (idempotent, extra toast) | disable button while deleting |
| L4 | `useKeyboardShortcuts.js:89` currentPage inference via truthy actions — transition race edge | optional activePage tracking |
| L5 | `docxGenerator.js:447-449` items rows still float-parse `art.montant` (dinars) — consistent with storage, but keep convention documented | none now; if C4/C1 fixed carefully, leave items as-is |
| L6 | `Companies` key in allowlist unused | keep (future) |
| L7 | `Cargo.toml` panic="abort" + process::exit in self-test skips destructors | acceptable; document |
| L8 | `.playwright-mcp/`, stray PDFs/screenshots in repo root | .gitignore + delete |

---

## REJECTED CLAIMS (auditor said, verification says otherwise)

1. **"sql capability missing → all DB ops fail"** — FALSE. SQL layer is dead code (`window.__TAURI__` undefined); everything runs on store. No runtime failure. Refiled as M1 (dead code decision).
2. **"PDF quantity math toCents(qty)×toCents(pu)/100 is wrong"** — MOSTLY FALSE. Algebra: `(q*100)(pu*100)/100 = q*pu*100` = correct cents. Display `fmtCents(qty,0)` correct for integer qty. Real residual: fractional qty display rounding + comma-input → 0 (covered by H6). No standalone fix needed beyond H6.
3. **"allowlist missing keys = user data loss today"** — FALSE TODAY (migration dead), TRUE the moment SQL is wired. Refiled H8.
4. **"ErrorBoundary doesn't reset on navigation"** — FALSE. `key={page}` on wrapper remounts (verified App.jsx:396).
5. **"receivePO double-counts on duplicate receive"** — FALSE direction: it UNDER-counts partial re-receives instead (refiled H4).

## VERIFIED OK (recent fixes held)

- PDF export end-to-end (browser-args match, self-test exit 0, 30KB valid PDF, 2.8s)
- CSP string correct; local fonts only (no external @import — grep verified); `@tauri-apps/api` used (no withGlobalTauri need)
- actionsRef stale-closure pattern correct on all 5 audited pages (assigned every render)
- `calcTimbreCents` matches Algerian tiers (300 DA exempt; 1/1.5/2 DA per 100 DA tranche; min 5 DA) — duplicated in FactureProforma (local copy) — dedupe candidate, LOW
- clearAllData DOES include stock keys (prior gap fixed)
- getLowStock minQty=0 correct; StockMovements signed adjust correct
- pdfTemplate escaping complete (no raw user interpolations found)
- docxGenerator has no Electron APIs; browser-safe
- numberToWordsFR grammar (81 → quatre-vingt-un) correct
- i18n missing-key fallback safe (returns key)
- money.js calcTva/fromCents/sumCents correct; retry logic idempotent; magic-byte checks don't break logo flow
