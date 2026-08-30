# Task 8: Expand Unit Tests — Report

**Status:** DONE  
**Tests:** 43 passed (was 25) — 18 new tests added

## Files Created

- `src/__tests__/helpers.test.js` — 9 tests
- `src/__tests__/i18n.test.js` — 9 tests

## What Was Tested

### helpers.test.js
- `todayIso()` — YYYY-MM-DD format, returns today's date
- `PAGE_SIZES` — contains A4 and A5
- `saveClientIfNew()` — empty/whitespace/null name no-ops, adds new client, deduplicates (case-insensitive), uses `globalThis.window.api` mock

### i18n.test.js
- `t()` — FR translation, AR translation, missing key returns key, unknown lang falls back to FR
- `translations` — FR and AR have identical keys, no empty values, expected section keys exist

## Notes

- `saveClientIfNew` requires `window.api` mock — used `globalThis.window` since vitest runs in Node without DOM
- `t()` accepts `...args` but does not perform substitution — tested key fallback instead
