/**
 * Save a complete document snapshot to history after successful export.
 * Stores ALL data needed for full reconstruction and re-export.
 */
export async function saveToHistory(entry) {
  if (!entry.client?.nom?.trim()) return;
  try {
    const existing = await window.api.storeGet("historique", []);
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: entry.type, // 'facture' | 'livraison' | 'versement'
      numero: entry.numero,
      date: entry.date,
      clientNom: entry.client.nom,
      clientId: entry.client.id || null,
      createdAt: new Date().toISOString(),
      // Full document data for reconstruction
      client: entry.client,
      articles: entry.articles || [],
      montant: parseFloat(entry.montant) || 0,
      // Facture-specific
      totaux: entry.totaux || null,
      modeReglement: entry.modeReglement || null,
      docTitle: entry.docTitle || null,
      showArrete: entry.showArrete ?? true,
      showModeReglement: entry.showModeReglement ?? true,
      // BV-specific
      montantVerse: entry.montantVerse ?? null,
      notes: entry.notes || "",
      // Common
      pageSize: entry.pageSize || "A4",
    };
    await window.api.storeSet("historique", [record, ...existing]);
  } catch (e) {
    console.error("History save error:", e);
  }
}

/** Get all history entries for a client name, sorted newest first */
export async function getClientHistory(clientNom) {
  if (!clientNom) return [];
  const all = await window.api.storeGet("historique", []);
  return (all || []).filter((e) => e.clientNom === clientNom);
}

/**
 * Delete one history entry by id. For livraisons, reverses the stock
 * decrements applied at export time (clamped to available — never negative;
 * silently skips if stock items are gone). Returns true if deleted.
 */
export async function deleteHistoryEntry(id) {
  const all = await window.api.storeGet("historique", []);
  const list = Array.isArray(all) ? all : [];
  const entry = list.find((e) => e.id === id);
  if (!entry) return false;

  if (entry.type === "livraison") {
    try {
      const { reverseSaleMovements } = await import("./stockStore.js");
      const skipped = await reverseSaleMovements(`BL-${entry.numero}`);
      // skipped is informational: stock may have moved on since the sale;
      // reversal restores what is still available. No hard block.
      if (skipped && skipped.length) {
        console.warn(
          "History delete: some sale quantities could not be fully restored:",
          skipped,
        );
      }
    } catch (e) {
      console.error("Stock restore on history delete failed:", e);
    }
  }

  await window.api.storeSet(
    "historique",
    list.filter((e) => e.id !== id),
  );
  return true;
}
