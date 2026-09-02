# Invoy v2.2 — Audit V2 Fix Plan

**Principles**: (1) Fix by blast radius, smallest first. (2) Every phase ends with a verification gate — no phase starts until the previous passes. (3) Money conventions are frozen: `totaux`/`total` = CENTS; `article.montant`/`prixUnitaire`/`quantite` = DINARS/units as stored. No unit-convention changes — only display/call-site corrections.

**Gate commands** (after every phase): `npm test` (61 tests, add new ones per phase) → `npm run react-build` → `npm run tauri:build` → manual smoke via `--pdf-self-test` + real UI export.

---

## PHASE 1 — Money display on exports (CRITICAL, contained, high value)

**Files**: `docxGenerator.js`, `pdfTemplate.js` — both leaf modules, no state, no store writes. Zero data-migration risk.

1.1 **C1 DOCX totals 100x**:
   - Add helper `d(cents)` = `fromCents` equivalent (import money.js from `../utils/money` — check import path works from electron-docx/).
   - `buildTotals` (538-545): `formatNum(d(totaux.ht))` etc. — 4 rows.
   - BonLivraison TOTAL table (~778): `formatNum(d(total))`.
   - BonVersement: TOTAL FACTURE (~849), Montant versé, solde cells (~887): `formatNum(d(...))`.
   - ProgrammeLivraison per-client totals (~1051-1062): `formatNum(d(clTotal))` — verify clTotal currency first (it sums `parseAmount(a.montant)` = cents there — must convert).
   - **DO NOT touch items rows** (447-449, 1051 qty/pu lines) — they correctly consume dinar-stored fields.

1.2 **C2 numberToWords cents**: `pdfTemplate.js:230-232` and `docxGenerator.js:648`: pass `(totaux.ttc || 0) / 100`.

1.3 **C3 FactureProforma pageSize**: add `pageSize` to docData (158-169), memo data+deps (234-263). Copy exact pattern from BonLivraison.jsx:107/180.

1.4 **C4 BonVersement history units**: `159-160` → `montant: montantVerseCents || total, montantVerse: montantVerseCents`.

**Tests to add**: docx totals formatting (pure fn test on `d()`/buildTotals via exported helper or indirect), numberToWords input contract (cents/100), BonVersement history unit (mock storeGet capture).
**Manual gate**: export Facture Proforma DOCX+PDF (espece w/ timbre), BonLivraison, BonVersement, Programme — verify amounts match on-screen exactly; A5 export on FactureProforma.

---

## PHASE 2 — Stock ledger integrity (HIGH, additive guards, no schema change)

**Files**: `stockStore.js`, `Marchandise.jsx`, `PurchaseOrders.jsx`, `Stock.jsx`, `StockMovements` untouched.

2.1 **H4 receivePO movement-per-receive** (stockStore.js:118-139): remove `if (!line.receivedMovementId)` gate — always `addMovement({qty: received.qtyReceived, ...})`. Keep updating `line.receivedMovementId = movementId` (now = last movement ref; also keep for H3 reversal lookup by reference).
   - Update stockStore.test.js receive cases: two receives → two movements, stock = sum.

2.2 **H3 PO delete reversal** (PurchaseOrders.jsx:144-150): before filtering out, if `po.status === "received" || po.status === "partial"`, find movements `source==="purchase" && reference===po.number` → reverse each (in→out) **with guard**: for "out" reversal, clamp to current available (read stock list once, track per-product decrements), skip-and-note if insufficient.
   - Toast summary if clamped ("X unités non retirées — stock insuffisant").

2.3 **H2 Marchandise delete guard** (Marchandise.jsx:235-244): same clamp guard as 2.2 (shared helper `reverseMovementsGuarded(movements)` in stockStore.js — reuse in both 2.2 and 2.3).

2.4 **H1 Marchandise rename orphan**: change old-qty lookup from name-match to line match: `oldRecord.produits.find((op) => op.id === p.id)` (lines have `id` — verified line 105). Stock item match stays name+supplier (that's the stock identity — a rename of marchandise line creates/uses stock item by NEW name; the OLD stock item keeps its qty — acceptable & documented, avoids double-count since delta computed vs old qty of THAT line).
   - Edge: renamed line + same name+supplier existing → merges into existing stock item (correct).
   - Update stockStore.test.js: rename scenario → single stock item, no duplicate.

2.5 **H5 Stock.jsx manual save movement**: in save handler, if editing existing product and `currentQty` changed → `addMovement({type: delta>0?"in":"out", qty: Math.abs(delta), reason:"manual_adjust", ...})` BEFORE upsert (addMovement already applies qty — so upsert must NOT also set currentQty; verify addMovement updates it — it does, stockStore.js:69-77 — so remove duplicate qty-set from upsert path or pass product without currentQty change and let movement apply it. **Careful**: keep `upsertStockProduct` for new products (currentQty 0 + no movement needed, or create movement too for consistency — decide: create movement always, even creation (reason "initial")).
   - Add test: manual edit creates adjust movement; ledger sum == currentQty.

2.6 **H9 badge refresh**: in stockStore.js mutations (addMovement, upsertStockProduct, deleteStockProduct, receivePO) → `window.dispatchEvent(new CustomEvent("invoy:stock-changed"))`. App.jsx: useEffect listener → `getLowStock().then(...)`. Keep existing nav refresh.
   - Browser-safe (CustomEvent standard). No test (DOM event), manual check.

**Gate**: stockStore.test.js updated + all green; manual: receive PO twice → two movements; delete PO → reversal; rename marchandise → no dup stock; Stock edit → movement logged; badge updates after receive.

---

## PHASE 3 — Money parsing + PDF robustness (HIGH/MEDIUM)

3.1 **H6 toCents comma**: `toCents` — if string: strip whitespace, if matches /^\d+,\d+$/ or contains single comma and no dot → comma→dot. Numbers unchanged. Add tests: "2,5"→250, "1 500,50"→150050, 2.5→250, "1.5"→150, NaN→0.
   - **Check callers**: ArticlesTable stores dinars via parseFloat (untouched); only broadens acceptance.

3.2 **H7 escapeCss fonts**: quote family: `font-family: "${safeFont}", Arial, sans-serif` AND allow spaces in escapeCss regex (keep stripping quotes/backslash to prevent CSS injection: strip `"` and `\` explicitly, allow spaces).
   - Test: "Times New Roman" → `font-family: "Times New Roman", Arial...` string present in output HTML.

3.3 **M2 pdf.rs zombie on with_webview err**: wrap: `let wv = window.with_webview(...); if let Err(e) = wv { let _ = window.close(); return Err(format!(...)); }`.

3.4 **M5 page_size allowlist**: `A4 | A5` else `Err("unsupported page size")`. Frontend only sends A4/A5 (PageSizeSelect verified) — safe.

3.5 **M6 file_path .pdf guard**: `if !file_path.to_lowercase().ends_with(".pdf") { return Err(...) }` in Rust.

3.6 **M7 printed guard**: `AtomicBool printed` captured in nav closure; second NavigationCompleted → early return.

3.7 **M3 html size bound**: Rust: `if html_content.len() > 2_000_000 { Err("document trop volumineux pour export PDF") }`. Logo 5MB base64 → html > 2MB → PDF blocked but DOCX fine. Toast the error (frontend already toasts result.error). Flag to user in report: big logos → use DOCX or we raise cap later.

3.8 **M4 render wait (precaution)**: replace `sleep(2s)` with CDP `Runtime.evaluate` poll loop: up to 20 tries × 500ms evaluating `document.readyState`; then proceed (keep 500ms post-Page.enable). **This changes working code — highest care**: test with real 50-line invoice + logo. If flaky, revert to sleep(3s) and note.

**Gate**: npm test + new money/escape tests; build; self-test; manual export of a LARGE invoice (add 40 articles) PDF+DOCX.

---

## PHASE 4 — Hygiene & dead code decisions (MEDIUM/LOW)

4.1 **M1 SQL dead code** → **RECOMMEND removal** (ask user): remove `tauri-plugin-sql` from Cargo.toml + lib.rs, delete db.js + migrate.js + App.jsx initDb/migrate calls. Shrinks binary, removes confusion. **Alternative** (keep+wire) is a separate feature — not in this plan.
4.2 **M9 unhandledrejection**: App.jsx global listener → showToast("Erreur interne", "error") + console.error. preventDefault to silence console noise.
4.3 **M10 darkMode in clearAllData**: add to KEYS; also `applyDark(false)` after clear (reset theme to light).
4.4 **L1 i18n placeholders**: add FR+AR keys: stock_po_ph_qty, stock_po_ph_unit, stock_po_ph_price, stock_po_ph_received, stock_ph_unit, march_ph_num, march_ph_date; remove `|| "Supplier required"` fallback (key exists).
4.5 **L3 delete double-click**: Stock.jsx deleting flag disable.
4.6 **L8 repo hygiene**: .gitignore add `.playwright-mcp/`, `*.pdf` root, `screenshot_*.png`; delete strays (FACTURE-PROFORMA-0003/4.pdf, screenshots).
4.7 **FactureProforma local calcTimbreCents dedupe** (L from verified-ok list): import from money.js, delete local copy (121-129). Zero behavior change (identical bodies verified).
4.8 **H8 allowlist legacy keys**: add products, history, programmeClients (future-proofing for whenever SQL gets wired).

**Gate**: full npm test; react-build; tauri:build; self-test exit 0.

---

## PHASE 5 — Full ship gate

- `npm test` all green (expect ~70+ tests)
- `npm run tauri:build` clean
- `invoy.exe --pdf-self-test` exit 0 (stderr: stages 1→5)
- Manual UI pass (user): FR+AR switch, all 4 doc exports PDF+DOCX on A4+A5, stock flows (adjust/receive/delete PO/marchandise edit+rename+delete), settings save+logo, clear-all-data, dark mode
- `npx prettier --write src/` + `cargo fmt` (deferred formatting — once, at the end)
- Commit (single "fix: audit v2" or per-phase — user preference)

---

## EXPLICITLY NOT DOING (precaution list)

- NOT changing unit conventions (totaux cents / article fields dinars) — only call sites fixed
- NOT touching docxGenerator items rows (correct as-is)
- NOT wiring SQL (removal recommended, wiring = separate project)
- NOT touching actionsRef/KeyboardActionsContext (verified correct)
- NOT touching timbre formula (verified correct)
- NOT touching CSP/fonts (verified correct)
- NOT adding receivedQtyAtMovement schema — H4 solved by movement-per-receive instead

## ORDER RATIONALE

Phase 1 = pure display functions, biggest user-visible damage, zero state risk → unblock real invoices immediately.
Phase 2 = one store-layer module + 3 pages, all additive guards, tested by stockStore.test.js.
Phase 3 = mixed frontend utils + Rust; M4 (render wait) is the only change to WORKING export code → last in phase, isolated, revertable.
Phase 4 = no-behavior hygiene.
Phase 5 = ship.
