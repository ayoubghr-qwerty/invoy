# Task 11: Email Integration

## Status: DONE

## What was done
- Created `src/utils/email.js` — composeEmail utility using mailto: protocol
- Added i18n keys: `btn_email`, `email_client_required` (FR + AR)
- Added email button to ExportButton dropdown (purple, uses Mail icon)
- Added email input field to Clients.jsx form
- Updated ExportButton signature to accept `client`, `docTitle`, `num`, `showToast` props
- Updated all ExportButton callers (FactureProforma, BonLivraison, BonVersement) to pass new props
- ProgrammeLivraison omitted (no single client prop)
- Updated normalizeClient and Excel import to include email field

## Tests
- 43/43 passed

## Build
- `npm run react-build` succeeded

## Commits
- [commit hash]

## Concerns
- None
