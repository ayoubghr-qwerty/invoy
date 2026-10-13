# Changelog

All notable changes to Invoy are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] — 2026-09-02

### Added
- **Unified catalog** — every new article created on a document becomes a stock item, and delivery notes (*Bon de Livraison*) decrement stock automatically
- Deleting a delivery-note history entry restores the stock it consumed
- Stock product names flow into the invoice article autocomplete
- Sticky table headers on all screens, new font list, animated danger zone, refreshed app icons
- Purchase-order tab renamed and reorganized
- Test suite expanded to 86 unit tests

### Fixed
- Stock ledger integrity and movement sign convention (audit H1–H5, H9)
- Money parsing and `pdf.rs` hardening (audit H6, H7, M2–M7)
- DOCX/PDF export money display — cents-to-dinars conversion (audit C1–C4)
- PDF export WebView2 browser-arguments mismatch and CSP
- Arabic language-switch label mojibake
- PDF document title from data URL; PDF subtitle displayed a literal double-escaped entity
- Purchase-order line field labels and readable selects
- Stock pages UI/UX consistency pass
- Delivery-note re-export idempotency and movement reversal safety
- Excel import — xlsx utils import fix, browser fallback guard, missing headers
- Prettier + cargo fmt cleanup

### Removed
- Dead SQL layer and general hygiene (audit M1, M9, M10, H8, L1, L3, L5)

## [2.0.0] — 2026-08-31

First stable release of Invoy — the *FacturePro* Electron app ported to [Tauri 2](https://tauri.app), keeping the same UI and document layouts, with silent WebView2 PDF export and 21 fixes across security, data integrity, business logic, UX and i18n.
