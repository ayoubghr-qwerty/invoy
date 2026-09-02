function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function now() {
  return new Date().toISOString();
}

// Notify app shell (badge) that stock data changed. No-op outside browser.
function notifyStockChanged() {
  try {
    window.dispatchEvent(new CustomEvent("invoy:stock-changed"));
  } catch {
    /* non-browser (tests) */
  }
  // Keep the Produits autocomplete list in sync with stock item names
  syncProduitsNames().catch(() => {});
}

// ─── Stock CRUD ───────────────────────────────────────
export async function getStock() {
  const all = await window.api.storeGet("stock", []);
  return (Array.isArray(all) ? all : []).filter((p) => !p.deletedAt);
}

export async function getStockProduct(id) {
  const all = await window.api.storeGet("stock", []);
  return (
    (Array.isArray(all) ? all : []).find((p) => p.id === id && !p.deletedAt) ||
    null
  );
}

export async function upsertStockProduct(product) {
  const all = await window.api.storeGet("stock", []);
  const list = Array.isArray(all) ? all : [];
  const idx = list.findIndex((p) => p.id === product.id);
  const ts = now();
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...product, updatedAt: ts };
  } else {
    list.push({ ...product, createdAt: ts, updatedAt: ts });
  }
  await window.api.storeSet("stock", list);
  notifyStockChanged();
}

export async function deleteStockProduct(id) {
  const all = await window.api.storeGet("stock", []);
  const list = (Array.isArray(all) ? all : []).map((p) =>
    p.id === id ? { ...p, deletedAt: now() } : p,
  );
  await window.api.storeSet("stock", list);
  notifyStockChanged();
}

// ─── Movements ────────────────────────────────────────
export async function getMovements(filters = {}) {
  const all = await window.api.storeGet("stock_movements", []);
  let list = Array.isArray(all) ? all : [];
  if (filters.productId)
    list = list.filter((m) => m.productId === filters.productId);
  if (filters.type) list = list.filter((m) => m.type === filters.type);
  if (filters.from) list = list.filter((m) => m.createdAt >= filters.from);
  if (filters.to) list = list.filter((m) => m.createdAt <= filters.to);
  // Newest-first. seq is a monotonic tiebreaker for movements created in the
  // same millisecond (legacy records without seq keep insertion order after
  // timestamped ones).
  return list.sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || (b.seq || 0) - (a.seq || 0),
  );
}

export async function addMovement(movement) {
  const all = await window.api.storeGet("stock_movements", []);
  const list = Array.isArray(all) ? all : [];
  list.push({
    ...movement,
    id: movement.id || uuid(),
    seq: movement.seq || list.length + 1,
    createdAt: movement.createdAt || now(),
  });
  await window.api.storeSet("stock_movements", list);

  // Update currentQty
  const stock = await window.api.storeGet("stock", []);
  const stockList = Array.isArray(stock) ? stock : [];
  const idx = stockList.findIndex((p) => p.id === movement.productId);
  if (idx >= 0) {
    stockList[idx] = {
      ...stockList[idx],
      currentQty: (stockList[idx].currentQty || 0) + movement.qty,
      updatedAt: now(),
    };
    await window.api.storeSet("stock", stockList);
  }
  notifyStockChanged();
}

/**
 * Reverse movements with a stock guard: an "in" movement reverses to "out".
 * If the product no longer has enough stock, the reversal is clamped to the
 * available quantity (tracked across the whole batch) and reported.
 * Reversed movements are marked reversedAt=now so they can never be reversed
 * twice (double-restore protection).
 * Returns [{ productId, skipped }] for units that could not be reversed.
 */
export async function reverseMovementsGuarded(movements, reference) {
  const stock = await getStock();
  const available = {};
  for (const p of stock) available[p.id] = p.currentQty || 0;

  // Mark target movements reversed FIRST (persisted even if reversal clamps)
  const toReverse = (Array.isArray(movements) ? movements : []).filter(
    (m) => !m.reversedAt,
  );
  if (toReverse.length > 0) {
    const all = (await window.api.storeGet("stock_movements", [])) || [];
    const byId = new Map(toReverse.map((m) => [m.id, m]));
    const marked = all.map((m) =>
      byId.has(m.id) ? { ...m, reversedAt: now() } : m,
    );
    await window.api.storeSet("stock_movements", marked);
  }

  const skipped = [];
  for (const m of toReverse) {
    // Normalize to absolute quantity
    let qty = Math.abs(m.qty || 0);
    if (m.type === "out" && (m.qty || 0) > 0) qty = m.qty; // legacy positive out

    if (m.type === "in") {
      // Reversing an "in" = taking out. Clamp to available stock.
      const avail = Math.max(available[m.productId] ?? 0, 0);
      const clamp = Math.min(qty, avail);
      if (clamp < qty) {
        skipped.push({ productId: m.productId, skipped: qty - clamp });
      }
      available[m.productId] = avail - clamp;
      if (clamp <= 0) continue;
      await addMovement({
        productId: m.productId,
        type: "out",
        qty: -clamp, // signed negative
        reason: "reversal",
        reference,
        unitCost: m.unitCost,
      });
    } else {
      // Reversing an "out" = putting back in.
      if (qty <= 0) continue;
      await addMovement({
        productId: m.productId,
        type: "in",
        qty, // positive
        reason: "reversal",
        reference,
        unitCost: m.unitCost,
      });
    }
  }
  return skipped;
}

// ─── Low Stock ────────────────────────────────────────
export async function getLowStock() {
  const stock = await getStock();
  return stock.filter((p) => {
    const current = p.currentQty || 0;
    const min = p.minQty || 0;
    if (current <= 0) return true;
    return min > 0 && current <= min;
  });
}

// ─── Purchase Orders ──────────────────────────────────
export async function getPurchaseOrders() {
  const all = await window.api.storeGet("purchase_orders", []);
  return Array.isArray(all) ? all : [];
}

export async function upsertPurchaseOrder(po) {
  const all = await window.api.storeGet("purchase_orders", []);
  const list = Array.isArray(all) ? all : [];
  const idx = list.findIndex((p) => p.id === po.id);
  const ts = now();
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...po, updatedAt: ts };
  } else {
    list.push({ ...po, createdAt: ts, updatedAt: ts });
  }
  await window.api.storeSet("purchase_orders", list);
}

export async function receivePO(poId, receivedLines) {
  const all = await window.api.storeGet("purchase_orders", []);
  const list = Array.isArray(all) ? all : [];
  const po = list.find((p) => p.id === poId);
  if (!po) return;

  let allFullyReceived = true;

  for (const line of po.lines) {
    const received = receivedLines.find((r) => r.productId === line.productId);
    if (received && received.qtyReceived > 0) {
      const newQtyReceived = (line.qtyReceived || 0) + received.qtyReceived;
      line.qtyReceived = newQtyReceived;
      if (newQtyReceived < line.qtyOrdered) allFullyReceived = false;

      // Every receive is a distinct physical receipt: always create a movement
      // for the quantity received in THIS call (fixes partial re-receives).
      const movementId = uuid();
      await addMovement({
        id: movementId,
        productId: line.productId,
        type: "in",
        qty: received.qtyReceived,
        reason: "purchase",
        reference: po.number,
        unitCost: line.unitCost,
        createdAt: now(),
      });
      line.receivedMovementId = movementId;
    } else {
      if ((line.qtyReceived || 0) < line.qtyOrdered) allFullyReceived = false;
    }
  }

  po.status = allFullyReceived ? "received" : "partial";
  po.updatedAt = now();
  await window.api.storeSet("purchase_orders", list);
  notifyStockChanged();
}

// ─── Sync Produits ────────────────────────────────────
export async function syncProduitsNames() {
  const stock = await getStock();
  const produits = await window.api.storeGet("produits", []);
  const list = Array.isArray(produits) ? [...produits] : [];
  for (const p of stock) {
    if (!list.some((x) => x.toLowerCase() === p.name.toLowerCase())) {
      list.push(p.name);
    }
  }
  await window.api.storeSet(
    "produits",
    list.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" })),
  );
}

/**
 * Ensure a stock product exists for an article name (idempotent).
 * Used when a NEW article designation is typed on any document page —
 * the name goes to Produits (autocomplete) AND Stock (unified catalog).
 * Matches existing items case-insensitively by name+supplier (like the
 * Marchandise sync) so repeated saves never duplicate.
 * Returns the stock item id (existing or newly created).
 */
// In-flight dedup for ensureStockProductFromArticle: concurrent calls for the
// same name+supplier share one promise (prevents TOCTOU duplicate creation).
const pendingEnsures = new Map();

export async function ensureStockProductFromArticle({
  name,
  supplier = "",
  unit = "pcs",
  salePrice = 0,
}) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const key = `${trimmed.toLowerCase()}|${(supplier || "").toLowerCase()}`;
  const existing = pendingEnsures.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const stock = await getStock();
      const found = stock.find(
        (p) =>
          p.name.toLowerCase() === trimmed.toLowerCase() &&
          (p.supplier || "") === (supplier || ""),
      );
      if (found) return found.id;

      const id = uuid();
      await upsertStockProduct({
        id,
        name: trimmed,
        unit: unit || "pcs",
        currentQty: 0,
        minQty: 0,
        maxQty: 0,
        costPrice: 0,
        salePrice: Math.round(Number(salePrice) || 0),
        supplier: supplier || "",
        notes: "",
      });
      return id;
    } finally {
      pendingEnsures.delete(key);
    }
  })();

  pendingEnsures.set(key, promise);
  return promise;
}

/**
 * Apply "out" movements for a delivered document (Bon de Livraison).
 * IDEMPOTENT PER REFERENCE: first reverses any previous sale movements for
 * the same reference (a re-export of the same bon replaces its stock impact
 * instead of stacking another decrement). Then applies the current articles.
 * Clamped to available stock — never negative. Returns [{ productId, skipped }].
 */
export async function applySaleMovements(articles, reference) {
  await reverseSaleMovements(reference);

  const stock = await getStock();
  const available = {};
  for (const p of stock) available[p.name.toLowerCase()] = p;

  const skipped = [];
  for (const a of Array.isArray(articles) ? articles : []) {
    const name = (a.designation || "").trim();
    const qty = Number(a.quantite) || 0;
    if (!name || qty <= 0) continue;
    const item = available[name.toLowerCase()];
    if (!item) continue; // not tracked in stock — skip silently

    const avail = item.currentQty || 0;
    const take = Math.min(qty, Math.max(avail, 0));
    if (take <= 0) {
      skipped.push({ productId: item.id, skipped: qty });
      continue;
    }
    if (take < qty) skipped.push({ productId: item.id, skipped: qty - take });
    await addMovement({
      productId: item.id,
      type: "out",
      qty: -take, // signed negative — store convention
      reason: "sale",
      reference,
      unitCost: 0,
    });
    item.currentQty = (item.currentQty || 0) - take; // track for next lines
  }
  return skipped;
}

/**
 * Reverse "sale" movements for a document (delete/re-save of a delivery).
 * Already-reversed movements are skipped (idempotent). Returns skipped info.
 */
export async function reverseSaleMovements(reference) {
  const movements = await getMovements({ type: "out" });
  const saleMovements = movements.filter(
    (m) => m.reason === "sale" && m.reference === reference && !m.reversedAt, // never double-restore
  );
  return reverseMovementsGuarded(saleMovements, `${reference}-REV`);
}
