import { dbGet, dbSet, dbExecute, isDbReady } from './db';

export async function migrateFromStore() {
  if (!isDbReady()) return;

  const migrated = await dbGet('_migrated');
  if (migrated) return;

  console.log('Migrating from Tauri Store to SQLite...');

  const settings = await window.api.storeGet('settings');
  if (settings) await dbSet('settings', settings);

  const darkMode = await window.api.storeGet('darkMode', false);
  if (darkMode) await dbSet('darkMode', darkMode);

  const clients = await window.api.storeGet('clients', []);
  for (const c of clients) {
    await dbExecute(
      `INSERT OR IGNORE INTO clients (nom, adresse, telephones, agrement, nif, articles_imp, nis) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.nom, c.adresse || '', JSON.stringify(c.telephones || []), c.agrement || '', c.nif || '', c.articlesImp || '', c.nis || '']
    );
  }

  const counters = await window.api.storeGet('counters', {});
  for (const [key, value] of Object.entries(counters)) {
    await dbExecute(`INSERT OR REPLACE INTO counters (key, value) VALUES (?, ?)`, [key, value]);
  }

  const products = await window.api.storeGet('products', []);
  for (const p of products) {
    const name = typeof p === 'string' ? p : p.name;
    if (name) await dbExecute(`INSERT OR IGNORE INTO products (name) VALUES (?)`, [name]);
  }

  const history = await window.api.storeGet('history', []);
  for (const h of history) {
    await dbExecute(
      `INSERT INTO history (type, numero, date, client, articles, montant, totaux, settings, doc_title, mode_reglement, page_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [h.type, h.numero, h.date, JSON.stringify(h.client), JSON.stringify(h.articles), h.montant || 0, JSON.stringify(h.totaux || {}), JSON.stringify(h.settings || {}), h.docTitle || '', h.modeReglement || '', h.pageSize || 'A4', h.createdAt || new Date().toISOString()]
    );
  }

  const programmeClients = await window.api.storeGet('programmeClients', []);
  for (const pc of programmeClients) {
    await dbExecute(
      `INSERT INTO programme_clients (date, client, articles) VALUES (?, ?, ?)`,
      [pc.date, JSON.stringify(pc.client), JSON.stringify(pc.articles)]
    );
  }

  await dbSet('_migrated', true);
  console.log('Migration complete.');
}
