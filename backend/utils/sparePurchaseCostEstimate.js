const { parsePurchaseDateMs } = require("./spareFifo");

/** Mean of purchasePrice > 0 across all layers (including qty 0). Used when every
 * remaining layer is priced at 0 but an older/sold-out batch was corrected — "latest
 * date only" would wrongly pick the newer zero-priced row. */
function meanPositivePurchasePrices(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const prices = [];
  for (const row of rows) {
    if (!row) continue;
    const p = Number(row.purchasePrice) || 0;
    if (p > 0) prices.push(p);
  }
  if (prices.length === 0) return null;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

/**
 * Same idea as Admin getSpareUnitCost: weighted average of layers with qty > 0,
 * else mean of positive purchase prices on any layer, else latest-dated row.
 */
function estimateSpareUnitPurchaseCost(spare) {
  if (!spare) return 0;
  const useColors =
    Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0;
  const rows = useColors ? spare.colorQuantity : spare.stockEntries;
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  let totalQty = 0;
  let totalCost = 0;
  for (const row of rows) {
    if (!row) continue;
    const q = Math.max(0, Number(row.quantity) || 0);
    if (q <= 0) continue;
    const p = Number(row.purchasePrice) || 0;
    totalQty += q;
    totalCost += q * p;
  }
  if (totalQty > 0) {
    const wAvg = totalCost / totalQty;
    if (wAvg > 0) return wAvg;
  }

  const fromPositive = meanPositivePurchasePrices(rows);
  if (fromPositive != null) return fromPositive;

  let bestI = -1;
  let bestT = -Infinity;
  rows.forEach((row, i) => {
    if (!row) return;
    const t = parsePurchaseDateMs(row.purchaseDate);
    if (t > bestT || (t === bestT && i > bestI)) {
      bestT = t;
      bestI = i;
    }
  });
  if (bestI >= 0 && bestT > -Infinity) {
    return Number(rows[bestI].purchasePrice) || 0;
  }
  return Number(rows[rows.length - 1]?.purchasePrice) || 0;
}

module.exports = { estimateSpareUnitPurchaseCost };
