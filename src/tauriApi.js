/**
 * Tauri implementation of `window.api`.
 *
 * Keeps the EXACT same method surface as the original Electron `preload.js`
 * (`window.api.*`) so that every React page and util works unmodified.
 *
 * Electron IPC → Tauri mapping:
 *   store:get/set         → @tauri-apps/plugin-store (LazyStore on invoy-data.json)
 *   dialog:save           → @tauri-apps/plugin-dialog  save()
 *   dialog:pickImage      → @tauri-apps/plugin-dialog  open() + plugin-fs readFile → base64 dataURL
 *   dialog:pickJson       → @tauri-apps/plugin-dialog  open() + plugin-fs readTextFile
 *   export:backupFile     → plugin-fs writeTextFile + pluverte opener revealItemInDir
 *   export:pdf            → Rust command `export_pdf` (WebView2 silent PrintToPdf)
 *   export:docx           → generated in-process (docx lib) + plugin-fs writeFile + reveal
 *   shell:showItem        → @tauri-apps/plugin-opener revealItemInDir
 *   excel:read            → dialog open + xlsx parsed in-process (was xlsx in main-process)
 */
import { invoke, isTauri } from '@tauri-apps/api/core';

async function loadPlugins() {
  const [{ LazyStore }, dialog, fs, opener] = await Promise.all([
    import('@tauri-apps/plugin-store'),
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
    import('@tauri-apps/plugin-opener'),
  ]);
  return { LazyStore, dialog, fs, opener };
}

function b64FromU8(uint8) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < uint8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function getStore(plugin) {
  if (!plugin._store) plugin._store = new plugin.LazyStore('invoy-data.json');
  return plugin._store;
}

function makeApi() {
  const plugin = {};
  let ready = null;

  const api = {
    // ── Store ─────────────────────────────────────────────
    async storeGet(key, def) {
      const p = await ensurePlugins();
      const store = await getStore(p);
      const v = await store.get(key);
      return v === undefined ? def : v;
    },
    async storeSet(key, value) {
      const p = await ensurePlugins();
      const store = await getStore(p);
      await store.set(key, value);
      await store.save();
      return true;
    },

    // ── Dialogs ───────────────────────────────────────────
    async saveDialog({ defaultName, filters } = {}) {
      const p = await ensurePlugins();
      const path = await p.dialog.save({ defaultPath: defaultName, filters });
      return path || null;
    },

    async pickImage() {
      const p = await ensurePlugins();
      const path = await p.dialog.open({
        multiple: false,
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
        ],
      });
      if (!path || Array.isArray(path)) return null;
      const data = await p.fs.readFile(path);
      const ext = path.split('.').pop().toLowerCase();
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      return `data:image/${mime};base64,${b64FromU8(data)}`;
    },

    async pickJson() {
      const p = await ensurePlugins();
      const path = await p.dialog.open({
        multiple: false,
        filters: [{ name: 'Sauvegarde Invoy', extensions: ['json'] }],
      });
      if (!path || Array.isArray(path)) return null;
      try {
        return await p.fs.readTextFile(path);
      } catch {
        return null;
      }
    },

    // ── Exports ───────────────────────────────────────────
    async exportBackupFile({ filePath, json }) {
      const p = await ensurePlugins();
      try {
        await p.fs.writeTextFile(filePath, json);
        await p.opener.revealItemInDir(filePath);
        return { success: true };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },

    async exportPdf({ htmlContent, filePath, pageSize } = {}) {
      try {
        const ok = await invoke('export_pdf', {
          htmlContent,
          filePath,
          pageSize: pageSize || 'A4',
        });
        const p = await ensurePlugins();
        await p.opener.revealItemInDir(filePath);
        return { success: !!ok };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },

    async exportDocx({ type, data, filePath }) {
      try {
        const { generateDocxArrayBuffer } = await import('./electron-docx/docxGenerator');
        const buf = await generateDocxArrayBuffer(type, data);
        const p = await ensurePlugins();
        await p.fs.writeFile(filePath, new Uint8Array(buf));
        await p.opener.revealItemInDir(filePath);
        return { success: true };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },

    // ── Shell ─────────────────────────────────────────────
    async showInFolder(filePath) {
      const p = await ensurePlugins();
      try {
        await p.opener.revealItemInDir(filePath);
      } catch {
        /* ignore */
      }
    },

    // ── Excel import ──────────────────────────────────────
    async readExcel() {
      const p = await ensurePlugins();
      const path = await p.dialog.open({
        multiple: false,
        filters: [{ name: 'Fichiers Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }],
      });
      if (!path || Array.isArray(path)) return null;
      try {
        const { read } = await import('xlsx');
        const buf = await p.fs.readFile(path);
        const wb = read(buf, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = read.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!rows || rows.length === 0) return { columns: [], rows: [] };
        const firstRow = rows[0];
        const headers = firstRow.map((h, i) =>
          String(h).trim() || `Colonne ${String.fromCharCode(65 + i)}`
        );
        const preview = rows.slice(1, 6).map((r) =>
          headers.map((_, i) => String(r[i] ?? '').trim())
        );
        const data = rows.slice(1).map((r) =>
          headers.map((_, i) => String(r[i] ?? '').trim())
        );
        return { headers, preview, data };
      } catch (e) {
        return { error: String(e) };
      }
    },
  };

  function ensurePlugins() {
    if (!ready) ready = loadPlugins().then((r) => Object.assign(plugin, r));
    return ready;
  }

  return api;
}

/**
 * Install `window.api` for Tauri. Also provides no-op fallbacks in a plain
 * browser (non-Tauri) so a raw `vite` preview won't crash on startup.
 */
export function installTauriApi() {
  if (window.api) return window.api;
  const api = makeApi();
  if (isTauri()) {
    window.api = api;
    return api;
  }
  // Browser fallback: keep in-memory store + stubs so UI renders.
  const mem = {};
  window.api = {
    storeGet: (k, d) => Promise.resolve(k in mem ? mem[k] : d),
    storeSet: (k, v) => Promise.resolve((mem[k] = v, true)),
    saveDialog: () => Promise.resolve(null),
    pickImage: () => Promise.resolve(null),
    pickJson: () => Promise.resolve(null),
    exportBackupFile: () => Promise.resolve({ success: false, error: 'not in Tauri' }),
    exportPdf: () => Promise.resolve({ success: false, error: 'not in Tauri' }),
    exportDocx: () => Promise.resolve({ success: false, error: 'not in Tauri' }),
    showInFolder: () => Promise.resolve(),
    readExcel: () => Promise.resolve({ columns: [], rows: [] }),
  };
  return window.api;
}
