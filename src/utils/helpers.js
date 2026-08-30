/**
 * Shared helpers used across multiple pages.
 */

/** Return today's date as ISO string (YYYY-MM-DD). */
export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * If the client is new (not already saved), persist it to the store.
 * Safe to call on every export — no-ops if the client already exists.
 */
export async function saveClientIfNew(client) {
  if (!client?.nom?.trim()) return;
  const existing = await window.api.storeGet('clients', []);
  if (!existing.find(c => c.nom.toLowerCase() === client.nom.toLowerCase())) {
    await window.api.storeSet('clients', [...existing, { ...client, id: Date.now() }]);
  }
}

/** Available PDF page sizes. */
export const PAGE_SIZES = ['A4', 'A5'];
