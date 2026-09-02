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
 *   export:backupFile     → plugin-fs writeTextFile + plugin-opener revealItemInDir
 *   export:pdf            → Rust command `export_pdf` (WebView2 silent PrintToPdf)
 *   export:docx           → generated in-process (docx lib) + plugin-fs writeFile + reveal
 *   shell:showItem        → @tauri-apps/plugin-opener revealItemInDir
 *   excel:read            → dialog open + xlsx parsed in-process (was xlsx in main-process)
 */
import { invoke, isTauri } from "@tauri-apps/api/core";

const ALLOWED_STORE_KEYS = new Set([
  "settings",
  "clients",
  "counters",
  "produits",
  "marchandise",
  "historique",
  "stock",
  "stock_movements",
  "purchase_orders",
  "companies",
  "darkMode",
  // Legacy keys (kept for forward-compat with any old data layer)
  "products",
  "history",
  "programmeClients",
]);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_JSON_SIZE = 10 * 1024 * 1024;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 100;

class TauriApiError extends Error {
  constructor(code, message, originalError = null) {
    super(message);
    this.name = "TauriApiError";
    this.code = code;
    this.originalError = originalError;
  }
}

function isRetryableError(error) {
  if (!error) return false;
  const msg = String(error).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("connection")
  );
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, attempts = RETRY_ATTEMPTS) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1 && isRetryableError(err)) {
        await sleep(RETRY_DELAY_MS * (i + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function validateStoreKey(key) {
  if (!ALLOWED_STORE_KEYS.has(key)) {
    throw new TauriApiError(
      "INVALID_STORE_KEY",
      `Store key "${key}" not in allowlist`,
    );
  }
}

function validateString(value, name, maxLen = 500) {
  if (typeof value !== "string") {
    throw new TauriApiError("INVALID_INPUT", `${name} must be a string`);
  }
  if (value.length > maxLen) {
    throw new TauriApiError(
      "INPUT_TOO_LONG",
      `${name} exceeds ${maxLen} chars`,
    );
  }
}

function validateFilePath(path, name) {
  validateString(path, name, 1000);
  if (!path.match(/^[a-zA-Z]:[\\\/].*$/)) {
    throw new TauriApiError(
      "INVALID_PATH",
      `${name} must be an absolute Windows path`,
    );
  }
}

async function loadPlugins() {
  const [{ LazyStore }, dialog, fs, opener] = await Promise.all([
    import("@tauri-apps/plugin-store"),
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
    import("@tauri-apps/plugin-opener"),
  ]);
  return { LazyStore, dialog, fs, opener };
}

function b64FromU8(uint8) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < uint8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function getStore(plugin) {
  if (!plugin._store) plugin._store = new plugin.LazyStore("invoy-data.json");
  return plugin._store;
}

function makeApi() {
  const plugin = {};
  let ready = null;

  const api = {
    // ── Store ─────────────────────────────────────────────
    async storeGet(key, def) {
      validateStoreKey(key);
      const p = await ensurePlugins();
      const store = await getStore(p);
      try {
        return await withRetry(() =>
          store.get(key).then((v) => (v === undefined ? def : v)),
        );
      } catch (e) {
        console.warn(`Store read failed for key "${key}", using default`, e);
        return def;
      }
    },
    async storeSet(key, value) {
      validateStoreKey(key);
      const p = await ensurePlugins();
      const store = await getStore(p);
      await withRetry(async () => {
        await store.set(key, value);
        await store.save();
      });
      return true;
    },

    // ── Dialogs ───────────────────────────────────────────
    async saveDialog({ defaultName, filters } = {}) {
      if (defaultName) validateString(defaultName, "defaultName", 255);
      if (filters) {
        if (!Array.isArray(filters))
          throw new TauriApiError("INVALID_FILTERS", "filters must be array");
        for (const f of filters) {
          validateString(f.name, "filter.name", 100);
          if (!Array.isArray(f.extensions))
            throw new TauriApiError(
              "INVALID_FILTERS",
              "filter.extensions must be array",
            );
        }
      }
      const p = await ensurePlugins();
      const path = await withRetry(() =>
        p.dialog.save({ defaultPath: defaultName, filters }),
      );
      return path || null;
    },

    async pickImage() {
      const p = await ensurePlugins();
      const path = await withRetry(() =>
        p.dialog.open({
          multiple: false,
          filters: [
            {
              name: "Images",
              extensions: ["png", "jpg", "jpeg", "gif", "webp"],
            },
          ],
        }),
      );
      if (!path || Array.isArray(path)) return null;
      validateFilePath(path, "image path");
      const data = await withRetry(() => p.fs.readFile(path));
      if (data.length > MAX_IMAGE_SIZE) {
        throw new TauriApiError(
          "FILE_TOO_LARGE",
          `Image exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
        );
      }
      const magic = Array.from(data.slice(0, 8))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const isPng = magic.startsWith("89504e47");
      const isJpeg = magic.startsWith("ffd8ff");
      const isGif = magic.startsWith("47494638");
      const isWebp =
        magic.slice(8, 16) === "52494646" && magic.slice(16, 24) === "57454250";
      if (!isPng && !isJpeg && !isGif && !isWebp) {
        throw new TauriApiError("INVALID_IMAGE", "Not a valid image format");
      }
      const ext = path.split(".").pop().toLowerCase();
      const mime = ext === "jpg" ? "jpeg" : ext;
      return `data:image/${mime};base64,${b64FromU8(data)}`;
    },

    async pickJson() {
      const p = await ensurePlugins();
      const path = await withRetry(() =>
        p.dialog.open({
          multiple: false,
          filters: [{ name: "Sauvegarde Invoy", extensions: ["json"] }],
        }),
      );
      if (!path || Array.isArray(path)) return null;
      validateFilePath(path, "json path");
      try {
        const content = await withRetry(() => p.fs.readTextFile(path));
        if (content.length > MAX_JSON_SIZE) {
          throw new TauriApiError(
            "FILE_TOO_LARGE",
            `JSON exceeds ${MAX_JSON_SIZE / 1024 / 1024}MB`,
          );
        }
        JSON.parse(content); // validate JSON
        return content;
      } catch (e) {
        if (e instanceof TauriApiError) throw e;
        throw new TauriApiError("INVALID_JSON", "File is not valid JSON", e);
      }
    },

    // ── Exports ───────────────────────────────────────────
    async exportBackupFile({ filePath, json }) {
      validateFilePath(filePath, "filePath");
      validateString(json, "json", 50 * 1024 * 1024);
      const p = await ensurePlugins();
      try {
        await withRetry(async () => {
          await p.fs.writeTextFile(filePath, json);
          await p.opener.revealItemInDir(filePath);
        });
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: e instanceof TauriApiError ? e.code : String(e),
        };
      }
    },

    async exportPdf({ htmlContent, filePath, pageSize } = {}) {
      validateString(htmlContent, "htmlContent", 10 * 1024 * 1024);
      validateFilePath(filePath, "filePath");
      validateString(pageSize, "pageSize", 10);
      try {
        const ok = await withRetry(() =>
          invoke("export_pdf", {
            htmlContent,
            filePath,
            pageSize: pageSize || "A4",
          }),
        );
        const p = await ensurePlugins();
        await withRetry(() => p.opener.revealItemInDir(filePath));
        return { success: !!ok };
      } catch (e) {
        return {
          success: false,
          error: e instanceof TauriApiError ? e.code : String(e),
        };
      }
    },

    async exportDocx({ type, data, filePath }) {
      validateString(type, "type", 50);
      validateFilePath(filePath, "filePath");
      if (!data || typeof data !== "object") {
        throw new TauriApiError("INVALID_INPUT", "data must be an object");
      }
      try {
        const { generateDocxArrayBuffer } =
          await import("./electron-docx/docxGenerator");
        const buf = await generateDocxArrayBuffer(type, data);
        const p = await ensurePlugins();
        await withRetry(async () => {
          await p.fs.writeFile(filePath, new Uint8Array(buf));
          await p.opener.revealItemInDir(filePath);
        });
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: e instanceof TauriApiError ? e.code : String(e),
        };
      }
    },

    // ── Shell ─────────────────────────────────────────────
    async showInFolder(filePath) {
      validateFilePath(filePath, "filePath");
      const p = await ensurePlugins();
      try {
        await withRetry(() => p.opener.revealItemInDir(filePath));
      } catch {
        // ignore
      }
    },

    // ── Excel import ──────────────────────────────────────
    async readExcel() {
      const p = await ensurePlugins();
      const path = await withRetry(() =>
        p.dialog.open({
          multiple: false,
          filters: [
            {
              name: "Fichiers Excel / CSV",
              extensions: ["xlsx", "xls", "csv"],
            },
          ],
        }),
      );
      if (!path || Array.isArray(path)) return null;
      validateFilePath(path, "excel path");
      try {
        const { read, utils } = await import("xlsx");
        const buf = await withRetry(() => p.fs.readFile(path));
        const wb = read(buf, { type: "array" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!rows || rows.length === 0)
          return { headers: [], preview: [], data: [] };
        const firstRow = rows[0];
        const headers = firstRow.map(
          (h, i) =>
            String(h).trim() || `Colonne ${String.fromCharCode(65 + i)}`,
        );
        const preview = rows
          .slice(1, 6)
          .map((r) => headers.map((_, i) => String(r[i] ?? "").trim()));
        const data = rows
          .slice(1)
          .map((r) => headers.map((_, i) => String(r[i] ?? "").trim()));
        return { headers, preview, data };
      } catch (e) {
        if (e instanceof TauriApiError) throw e;
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
  // Use window.__invoyShowToast set by App.jsx
  const notify = (msg) => window.__invoyShowToast?.(msg, "error");

  window.api = {
    storeGet: async (k, d) => {
      if (!ALLOWED_STORE_KEYS.has(k)) {
        console.warn(`Browser fallback: invalid store key "${k}"`);
        return d;
      }
      return k in mem ? mem[k] : d;
    },
    storeSet: async (k, v) => {
      if (!ALLOWED_STORE_KEYS.has(k)) {
        console.warn(`Browser fallback: invalid store key "${k}"`);
        return false;
      }
      mem[k] = v;
      return true;
    },
    saveDialog: () => {
      notify("Export uniquement disponible dans l'app Tauri");
      return Promise.resolve(null);
    },
    pickImage: () => Promise.resolve(null),
    pickJson: () => Promise.resolve(null),
    exportBackupFile: () =>
      Promise.resolve({ success: false, error: "not in Tauri" }),
    exportPdf: () => {
      notify("Export PDF uniquement disponible dans l'app Tauri");
      return Promise.resolve({ success: false, error: "not in Tauri" });
    },
    exportDocx: () => {
      notify("Export DOCX uniquement disponible dans l'app Tauri");
      return Promise.resolve({ success: false, error: "not in Tauri" });
    },
    showInFolder: () => Promise.resolve(),
    readExcel: () =>
      new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".xlsx,.xls,.csv";
        input.style.display = "none";
        document.body.appendChild(input);
        input.addEventListener("change", async () => {
          const file = input.files[0];
          document.body.removeChild(input);
          if (!file) {
            resolve(null);
            return;
          }
          try {
            const { read, utils } = await import("xlsx");
            const buf = await file.arrayBuffer();
            const wb = read(buf, { type: "array" });
            const sheetName = wb.SheetNames[0];
            const ws = wb.Sheets[sheetName];
            const rows = utils.sheet_to_json(ws, { header: 1, defval: "" });
            if (!rows || rows.length === 0) {
              resolve({ headers: [], preview: [], data: [] });
              return;
            }
            const firstRow = rows[0];
            const headers = firstRow.map(
              (h, i) =>
                String(h).trim() || `Colonne ${String.fromCharCode(65 + i)}`,
            );
            const preview = rows
              .slice(1, 6)
              .map((r) => headers.map((_, i) => String(r[i] ?? "").trim()));
            const data = rows
              .slice(1)
              .map((r) => headers.map((_, i) => String(r[i] ?? "").trim()));
            resolve({ headers, preview, data });
          } catch (err) {
            resolve({ error: String(err) });
          }
        });
        input.click();
      }),
  };
  return window.api;
}
