let sqlReady = false;
const DB_NAME = 'sqlite:invoy.db';

function getInvoke() {
  return window.__TAURI__?.core?.invoke;
}

export async function initDb() {
  try {
    const invoke = getInvoke();
    if (!invoke) { sqlReady = false; return; }
    await invoke('plugin:sql|execute', { db: DB_NAME, query: 'SELECT 1' });
    sqlReady = true;
  } catch {
    sqlReady = false;
  }
}

export async function dbGet(key, defaultValue = null) {
  if (sqlReady) {
    try {
      const invoke = getInvoke();
      const rows = await invoke('plugin:sql|select', {
        db: DB_NAME,
        query: 'SELECT value FROM settings WHERE key = ?',
        args: [key]
      });
      if (rows?.length && rows[0]?.value !== undefined) {
        return JSON.parse(rows[0].value);
      }
    } catch { /* fall through */ }
  }
  return window.api.storeGet(key, defaultValue);
}

export async function dbSet(key, value) {
  if (sqlReady) {
    try {
      const invoke = getInvoke();
      await invoke('plugin:sql|execute', {
        db: DB_NAME,
        query: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        args: [key, JSON.stringify(value)]
      });
      return;
    } catch { /* fall through */ }
  }
  await window.api.storeSet(key, value);
}

export async function dbQuery(sql, args = []) {
  if (!sqlReady) return [];
  try {
    const invoke = getInvoke();
    return await invoke('plugin:sql|select', { db: DB_NAME, query: sql, args });
  } catch { return []; }
}

export async function dbExecute(sql, args = []) {
  if (!sqlReady) return;
  try {
    const invoke = getInvoke();
    await invoke('plugin:sql|execute', { db: DB_NAME, query: sql, args });
  } catch { /* swallow */ }
}

export function isDbReady() { return sqlReady; }

export async function dbQueryCompany(sql, params = [], companyId = null) {
  if (companyId) {
    const separator = sql.includes('WHERE') ? 'AND' : 'WHERE';
    return dbQuery(`${sql} ${separator} company_id = ?`, [...params, companyId]);
  }
  return dbQuery(sql, params);
}
