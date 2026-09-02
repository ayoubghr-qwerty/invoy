export function getStockStatus(product) {
  const { currentQty, minQty, maxQty } = product;
  if (currentQty <= 0) return "out";
  if (currentQty <= minQty) return "low";
  if (maxQty && currentQty > maxQty) return "over";
  return "ok";
}

import { mul } from "./money";

export function calculateStockValue(products) {
  return products.reduce(
    (sum, p) => sum + mul(p.costPrice, p.currentQty || 0),
    0,
  );
}

export function formatQty(qty, unit) {
  return `${qty} ${unit || ""}`.trim();
}
