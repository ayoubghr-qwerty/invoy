function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function now() {
  return new Date().toISOString();
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
}

export async function deleteStockProduct(id) {
  const all = await window.api.storeGet("stock", []);
  const list = (Array.isArray(all) ? all : []).map((p) =>
    p.id === id ? { ...p, deletedAt: now() } : p,
  );
  await window.api.storeSet("stock", list);
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

      // Create in movement only if not already created for this receipt
      if (!line.receivedMovementId) {
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
      }
    } else {
      if ((line.qtyReceived || 0) < line.qtyOrdered) allFullyReceived = false;
    }
  }

  po.status = allFullyReceived ? "received" : "partial";
  po.updatedAt = now();
  await window.api.storeSet("purchase_orders", list);
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
