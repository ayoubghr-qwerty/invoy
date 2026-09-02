import { describe, it, expect } from "vitest";
import {
  getStockStatus,
  calculateStockValue,
  formatQty,
} from "../utils/stockHelpers";

describe("getStockStatus", () => {
  const product = { currentQty: 10, minQty: 5, maxQty: 20 };
  it("returns ok when qty > min", () =>
    expect(getStockStatus(product)).toBe("ok"));
  it("returns low when qty <= min", () =>
    expect(getStockStatus({ ...product, currentQty: 5 })).toBe("low"));
  it("returns out when qty is 0", () =>
    expect(getStockStatus({ ...product, currentQty: 0 })).toBe("out"));
  it("returns over when qty > max", () =>
    expect(getStockStatus({ ...product, currentQty: 25 })).toBe("over"));
  it("returns low when below min and no max", () =>
    expect(getStockStatus({ currentQty: 2, minQty: 5 })).toBe("low"));
});

describe("calculateStockValue", () => {
  it("sums qty * costPrice (returns cents)", () => {
    const items = [
      { currentQty: 10, costPrice: 100 },
      { currentQty: 5, costPrice: 200 },
    ];
    expect(calculateStockValue(items)).toBe(200000);
  });
  it("skips items without costPrice", () => {
    expect(calculateStockValue([{ currentQty: 10 }])).toBe(0);
  });
});

describe("formatQty", () => {
  it("formats number with unit", () =>
    expect(formatQty(10, "pcs")).toBe("10 pcs"));
  it("handles 0", () => expect(formatQty(0, "kg")).toBe("0 kg"));
});
