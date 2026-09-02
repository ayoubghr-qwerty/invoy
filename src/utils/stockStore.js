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
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addMovement(movement) {
  const all = await window.api.storeGet("stock_movements", []);
  const list = Array.isArray(all) ? all : [];
  list.push({
    ...movement,
    id: movement.id || uuid(),
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
 * Returns [{ productId, skipped }] for units that could not be reversed.
 */
export async function reverseMovementsGuarded(movements, reference) {
  const stock = await getStock();
  const available = {};
  for (const p of stock) available[p.id] = p.currentQty || 0;

  const skipped = [];
  for (const m of Array.isArray(movements) ? movements : []) {
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
