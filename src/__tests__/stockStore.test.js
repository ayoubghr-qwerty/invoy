import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock window.api
const mockStore = {};
window.api = {
  storeGet: vi.fn((key, def) => Promise.resolve(mockStore[key] || def)),
  storeSet: vi.fn((key, val) => {
    mockStore[key] = val;
    return Promise.resolve();
  }),
};

import {
  getStock,
  upsertStockProduct,
  deleteStockProduct,
  addMovement,
  getLowStock,
  getMovements,
  upsertPurchaseOrder,
  receivePO,
  syncProduitsNames,
  reverseMovementsGuarded,
} from "../utils/stockStore";

beforeEach(() => {
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
});

describe("upsertStockProduct", () => {
  it("creates a new product with defaults", async () => {
    await upsertStockProduct({
      id: "p1",
      name: "Widget",
      unit: "pcs",
      minQty: 5,
      currentQty: 0,
    });
    const stock = await getStock();
    expect(stock).toHaveLength(1);
    expect(stock[0].name).toBe("Widget");
    expect(stock[0].createdAt).toBeDefined();
  });

  it("updates existing product by id", async () => {
    await upsertStockProduct({
      id: "p1",
      name: "Widget",
      unit: "pcs",
      minQty: 5,
      currentQty: 0,
    });
    await upsertStockProduct({
      id: "p1",
      name: "Widget Pro",
      unit: "pcs",
      minQty: 10,
      currentQty: 0,
    });
    const stock = await getStock();
    expect(stock).toHaveLength(1);
    expect(stock[0].name).toBe("Widget Pro");
    expect(stock[0].minQty).toBe(10);
  });
});

describe("deleteStockProduct", () => {
  it("soft-deletes by setting deletedAt", async () => {
    await upsertStockProduct({
      id: "p1",
      name: "Widget",
      unit: "pcs",
      minQty: 5,
      currentQty: 0,
    });
    await deleteStockProduct("p1");
    const stock = await getStock();
    expect(stock).toHaveLength(0);
    const all = mockStore.stock;
    expect(all[0].deletedAt).toBeDefined();
  });
});

describe("addMovement", () => {
  it("creates in movement and updates currentQty", async () => {
    await upsertStockProduct({
      id: "p1",
      name: "Widget",
      unit: "pcs",
      minQty: 5,
      currentQty: 0,
    });
    await addMovement({
      id: "m1",
      productId: "p1",
      type: "in",
      qty: 10,
      reason: "purchase",
      createdAt: new Date().toISOString(),
    });
    const stock = await getStock();
    expect(stock[0].currentQty).toBe(10);
  });

  it("creates out movement and decrements currentQty", async () => {
    await upsertStockProduct({
      id: "p1",
      name: "Widget",
      unit: "pcs",
      minQty: 5,
      currentQty: 10,
    });
    await addMovement({
      id: "m2",
      productId: "p1",
      type: "out",
      qty: -3,
      reason: "sale",
      createdAt: new Date().toISOString(),
    });
    const stock = await getStock();
    expect(stock[0].currentQty).toBe(7);
  });

  it("adjust movement sets qty directly", async () => {
    await upsertStockProduct({
      id: "p1",
      name: "Widget",
      unit: "pcs",
      minQty: 5,
      currentQty: 10,
    });
    await addMovement({
      id: "m3",
      productId: "p1",
      type: "adjust",
      qty: -2,
      reason: "count",
      createdAt: new Date().toISOString(),
    });
    const stock = await getStock();
    expect(stock[0].currentQty).toBe(8);
  });
});

describe("getLowStock", () => {
  it("returns products at or below minQty", async () => {
    await upsertStockProduct({
      id: "p1",
      name: "A",
      unit: "pcs",
      minQty: 5,
      currentQty: 3,
    });
    await upsertStockProduct({
      id: "p2",
      name: "B",
      unit: "pcs",
      minQty: 5,
      currentQty: 10,
    });
    await upsertStockProduct({
      id: "p3",
      name: "C",
      unit: "pcs",
      minQty: 5,
      currentQty: 0,
    });
    const low = await getLowStock();
    expect(low).toHaveLength(2);
    expect(low.map((p) => p.id)).toEqual(expect.arrayContaining(["p1", "p3"]));
  });
});

describe("syncProduitsNames", () => {
  it("adds stock names to produits store", async () => {
    mockStore.produits = ["Existing"];
    await upsertStockProduct({
      id: "p1",
      name: "Widget",
      unit: "pcs",
      minQty: 5,
      currentQty: 0,
    });
    await syncProduitsNames();
    expect(mockStore.produits).toContain("Widget");
    expect(mockStore.produits).toContain("Existing");
  });

  it("fires automatically on stock mutation (autocomplete stays in sync)", async () => {
    mockStore.produits = [];
    await upsertStockProduct({
      id: "p1",
      name: "Autocomplete Widget",
      unit: "pcs",
      minQty: 0,
      currentQty: 0,
    });
    // notifyStockChanged inside upsertStockProduct calls syncProduitsNames
    // (async fire-and-forget) — flush microtasks/timers before asserting
    await new Promise((r) => setTimeout(r, 20));
    expect(mockStore.produits).toContain("Autocomplete Widget");
  });
});

describe("receivePO", () => {
  it("creates in movements and updates currentQty", async () => {
    await upsertStockProduct({
      id: "p1",
      name: "Widget",
      unit: "pcs",
      minQty: 5,
      currentQty: 0,
    });
    await upsertPurchaseOrder({
      id: "po1",
      number: "PO-0001",
      supplierName: "Acme",
      date: "2026-08-31",
      status: "sent",
      lines: [
        {
          productId: "p1",
          productName: "Widget",
          qtyOrdered: 10,
          qtyReceived: 0,
          unit: "pcs",
          unitCost: 100,
        },
      ],
      totalCost: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await receivePO("po1", [{ productId: "p1", qtyReceived: 7 }]);
    const stock = await getStock();
    expect(stock[0].currentQty).toBe(7);
    const pos = mockStore.purchase_orders;
    expect(pos[0].status).toBe("partial");
    expect(pos[0].lines[0].qtyReceived).toBe(7);
  });

  it("creates a movement for EACH receive (partial re-receive adds stock)", async () => {
    await upsertStockProduct({
      id: "p1",
      name: "Widget",
      unit: "pcs",
      minQty: 5,
      currentQty: 0,
    });
    await upsertPurchaseOrder({
      id: "po1",
      number: "PO-0002",
      supplierName: "Acme",
      date: "2026-09-02",
      status: "sent",
      lines: [
        {
          productId: "p1",
          productName: "Widget",
          qtyOrdered: 10,
          qtyReceived: 0,
          unit: "pcs",
          unitCost: 100,
        },
      ],
      totalCost: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await receivePO("po1", [{ productId: "p1", qtyReceived: 5 }]);
    await receivePO("po1", [{ productId: "p1", qtyReceived: 5 }]);
    const stock = await getStock();
    expect(stock[0].currentQty).toBe(10); // BOTH receives hit stock
    const movements = await getMovements({ productId: "p1", type: "in" });
    const poMovements = movements.filter((m) => m.reason === "purchase");
    expect(poMovements).toHaveLength(2);
    expect(poMovements.map((m) => m.qty)).toEqual([5, 5]);
    const pos = mockStore.purchase_orders;
    expect(pos[0].status).toBe("received");
    expect(pos[0].lines[0].qtyReceived).toBe(10);
  });
});

describe("reverseMovementsGuarded", () => {
  it("reverses in-movements to out and clamps to available stock", async () => {
    await upsertStockProduct({
      id: "p1",
      name: "Widget",
      unit: "pcs",
      minQty: 0,
      currentQty: 3, // only 3 available — movement wants to remove 5
    });
    const skipped = await reverseMovementsGuarded(
      [
        {
          productId: "p1",
          type: "in",
          qty: 5,
          reason: "purchase",
          unitCost: 10,
        },
      ],
      "REV-TEST",
    );
    expect(skipped).toEqual([{ productId: "p1", skipped: 2 }]);
    const stock = await getStock();
    expect(stock[0].currentQty).toBe(0); // clamped: 3 - 3 = 0, never negative
    const movements = await getMovements({ productId: "p1" });
    const rev = movements.find((m) => m.reference === "REV-TEST");
    expect(rev.type).toBe("out");
    expect(rev.qty).toBe(-3); // signed convention: out movements are negative
  });

  it("reverses out-movements to in without clamp", async () => {
    await upsertStockProduct({
      id: "p1",
      name: "Widget",
      unit: "pcs",
      minQty: 0,
      currentQty: 2,
    });
    const skipped = await reverseMovementsGuarded(
      [{ productId: "p1", type: "out", qty: -4, reason: "sale", unitCost: 10 }],
      "REV-TEST2",
    );
    expect(skipped).toEqual([]);
    const stock = await getStock();
    expect(stock[0].currentQty).toBe(6); // 2 + 4
    const movements = await getMovements({ productId: "p1" });
    const rev = movements.find((m) => m.reference === "REV-TEST2");
    expect(rev.type).toBe("in");
    expect(rev.qty).toBe(4);
  });
});
