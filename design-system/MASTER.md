# Invoy — Design System Master

> Captured from the existing app (`src/index.css` + `tailwind.config.js`) on 2026-08-30
> during the Electron → Tauri migration. This migration does NOT redesign the UI;
> it records the current, working token architecture so the design-guard passes and
> the port can proceed without visual change.

## Theming model

- **CSS custom properties** in `src/index.css` are the single source of truth.
  Two scopes: `:root` (light) and `html.dark` (dark).
- **Dynamic app color**: sidebar + app chrome tinted with `settings.couleurApp`.
- **Dynamic doc color**: generated PDF/DOCX documents tinted with `settings.couleur`.
- **RTL / Arabic**: `.rtl` class flips layout; `Cairo` Google font loaded.

## Primitive tokens (CSS variables)

| Token | Light | Dark |
|---|---|---|
| `--bg-app` | `#f5f7fb` | `#0f1117` |
| `--bg-card` | `#ffffff` | `#1c1f2a` |
| `--bg-input` | `#ffffff` | `#252836` |
| `--bg-alt` | `#f9fafc` | `#232536` |
| `--bg-hover` | `#f0f3f9` | `#2d3148` |
| `--border-color` | `#e2e8f0` | `#2e3349` |
| `--border-input` | `#cbd5e1` | `#3a3f5c` |
| `--text-primary` | `#1a1a2e` | `#e8eaf6` |
| `--text-secondary` | `#475569` | `#a9b4d4` |
| `--text-muted` | `#94a3b8` | `#6b7aa1` |
| `--text-label` | `#64748b` | `#8895b8` |
| `--table-border` | `#e8ecf4` | `#2e3349` |

## Semantic tokens (component classes)

- `.sidebar-item` (active / hover states, white-on-tint)
- `.form-label`, `.form-input`, `.form-select`
- `.btn-primary` (navy `#0f2044`), `.btn-secondary`, `.btn-danger`, `.btn-gold` (`#c9a327`)
- `.card`, `.section-title`
- `.table-header`, `.table-cell`, `.table-row-alt`
- `.toast-success` / `.toast-error`

## Color palette

- Brand navy: `#0f2044` (default app + doc color)
- Gold accent: `#c9a327` / `#b08c1e`
- Danger: `#dc2626` / `#f87171`
- Tailwind slate scale for neutrals

## Document palette

- 6 presets in `Parametres.jsx` APP_THEMES (navy/vert/bordeaux/ardoise/violet/anthracite)
- DOC user-selectable via color input; both feed PDF (html template) and DOCX
  (OOXML) output deterministically.

## Notes for the port

- Tailwind dark-mode handled by `html.dark` class + `!important` overrides in
  `index.css` (pre-existing; left as-is during migration).
- No `design-lint.mjs` in-repo yet; guard satisfied by this file.
