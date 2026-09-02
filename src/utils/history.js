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
