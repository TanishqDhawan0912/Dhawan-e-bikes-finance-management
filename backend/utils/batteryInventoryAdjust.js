const { parsePurchaseDateMs, fifoRestoreToStockEntries } = require("./spareFifo");

function batteryUnitCostFromEntry(entry, batteryDoc) {
  const pricePerSet = Number(entry?.purchasePrice) || 0;
  const perSet =
    entry?.batteriesPerSet !== undefined && entry?.batteriesPerSet !== null
      ? Number(entry.batteriesPerSet)
      : Number(batteryDoc?.batteriesPerSet) || 0;
  return perSet > 0 ? pricePerSet / perSet : pricePerSet;
}

/**
 * Deduct individual battery units using FIFO by purchaseDate (oldest first).
 * Mutates stockEntries[].quantity. Caller should run battery.recalculateFromStockEntries() after.
 * @returns {{ totalCost: number, deducted: number }}
 */
function fifoDeductBatteryUnits(batteryDoc, units) {
  const entries = Array.isArray(batteryDoc?.stockEntries)
    ? batteryDoc.stockEntries
    : [];
  const n = Math.floor(Number(units) || 0);
  if (n <= 0 || entries.length === 0) return { totalCost: 0, deducted: 0 };

  const order = entries
    .map((e, i) => ({
      i,
      t: parsePurchaseDateMs(e?.purchaseDate),
      q: Math.max(0, Number(e?.quantity) || 0),
    }))
    .filter((x) => x.q > 0)
    .sort((a, b) => {
      if (a.t !== b.t) return a.t - b.t;
      return a.i - b.i;
    });

  let need = n;
  let totalCost = 0;
  let deducted = 0;
  for (const row of order) {
    if (need <= 0) break;
    const e = entries[row.i];
    const current = Math.max(0, Number(e.quantity) || 0);
    if (current <= 0) continue;
    const take = Math.min(need, current);
    const unitCost = batteryUnitCostFromEntry(e, batteryDoc);
    totalCost += take * unitCost;
    // Keep purchased total fixed: snapshot once before any sales (FIFO only mutates quantity).
    if (
      take > 0 &&
      (e.originalQuantity === undefined ||
        e.originalQuantity === null ||
        e.originalQuantity === "")
    ) {
      e.originalQuantity = current;
    }
    e.quantity = current - take;
    deducted += take;
    need -= take;
  }
  return { totalCost, deducted };
}

/**
 * Apply battery stock change in individual units (jobcard / bill).
 * When stockEntries exist, uses FIFO on those layers; otherwise legacy totalSets/openBatteries only.
 */
function adjustBatteryStockByUnits(batteryDoc, qtyUnits, mode) {
  const u = Math.floor(Number(qtyUnits) || 0);
  if (u <= 0 || !batteryDoc) return { totalCost: 0, deducted: 0 };

  const hasLayers =
    Array.isArray(batteryDoc.stockEntries) && batteryDoc.stockEntries.length > 0;

  if (hasLayers) {
    if (mode === "deduct") {
      const r = fifoDeductBatteryUnits(batteryDoc, u);
      if (typeof batteryDoc.recalculateFromStockEntries === "function") {
        batteryDoc.recalculateFromStockEntries();
      }
      return r;
    }
    fifoRestoreToStockEntries(batteryDoc.stockEntries, u);
    if (typeof batteryDoc.recalculateFromStockEntries === "function") {
      batteryDoc.recalculateFromStockEntries();
    }
    return { totalCost: 0, deducted: u };
  }

  const factor = mode === "deduct" ? -1 : 1;
  const perSet = Number(batteryDoc.batteriesPerSet) || 0;
  const totalUnitsBefore =
    (Number(batteryDoc.totalSets) || 0) * (perSet || 0) +
    (Number(batteryDoc.openBatteries) || 0);
  let totalUnitsAfter = totalUnitsBefore + factor * u;
  if (totalUnitsAfter < 0) totalUnitsAfter = 0;
  if (perSet > 0) {
    batteryDoc.totalSets = Math.floor(totalUnitsAfter / perSet);
    batteryDoc.openBatteries = totalUnitsAfter % perSet;
  } else {
    batteryDoc.totalSets = 0;
    batteryDoc.openBatteries = totalUnitsAfter;
  }
  return { totalCost: 0, deducted: mode === "deduct" ? u : 0 };
}

module.exports = {
  batteryUnitCostFromEntry,
  fifoDeductBatteryUnits,
  adjustBatteryStockByUnits,
};
