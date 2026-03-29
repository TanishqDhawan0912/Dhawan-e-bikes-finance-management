const {
  parsePurchaseDateMs,
  fifoDeductFromStockEntries,
  fifoRestoreToStockEntries,
} = require("./spareFifo");

/** Snapshot batch size before reconcile/FIFO shrink so "purchased" stays correct. */
function ensureOriginalQtyOnChargerEntries(entries) {
  if (!Array.isArray(entries)) return;
  for (const e of entries) {
    if (!e) continue;
    if (
      e.originalQuantity === undefined ||
      e.originalQuantity === null ||
      e.originalQuantity === ""
    ) {
      e.originalQuantity = Math.max(0, Math.floor(Number(e.quantity) || 0));
    }
  }
}

/**
 * Align sum(stockEntries.quantity) with charger.quantity (legacy jobcards only
 * updated the total). Oldest FIFO layers shrink first when sum > total.
 */
function reconcileChargerStockEntriesToTotal(chargerDoc) {
  const entries = chargerDoc?.stockEntries;
  if (!Array.isArray(entries) || entries.length === 0) return;
  ensureOriginalQtyOnChargerEntries(entries);
  const sumQty = entries.reduce(
    (s, e) => s + Math.max(0, Number(e?.quantity) || 0),
    0
  );
  const total = Math.max(0, Number(chargerDoc.quantity) || 0);
  if (sumQty === total) return;
  if (sumQty > total) {
    fifoDeductFromStockEntries(entries, sumQty - total);
  } else {
    fifoRestoreToStockEntries(entries, total - sumQty);
  }
}

function syncChargerQuantityFromStockEntries(chargerDoc) {
  const entries = chargerDoc?.stockEntries;
  if (!Array.isArray(entries) || entries.length === 0) return;
  chargerDoc.quantity = entries.reduce(
    (s, e) => s + Math.max(0, Number(e?.quantity) || 0),
    0
  );
}

/**
 * @returns {boolean} true if stockEntries were mutated (caller should save).
 */
function ensureChargerLayersMatchTotal(chargerDoc) {
  if (
    !chargerDoc ||
    !Array.isArray(chargerDoc.stockEntries) ||
    chargerDoc.stockEntries.length === 0
  ) {
    return false;
  }
  const sumQty = chargerDoc.stockEntries.reduce(
    (s, e) => s + Math.max(0, Number(e?.quantity) || 0),
    0
  );
  const total = Math.max(0, Number(chargerDoc.quantity) || 0);
  if (sumQty === total) return false;
  reconcileChargerStockEntriesToTotal(chargerDoc);
  syncChargerQuantityFromStockEntries(chargerDoc);
  return true;
}

/**
 * FIFO deduct charger pieces (oldest purchaseDate first).
 * Mutates stockEntries[].quantity; sets originalQuantity on first sale if missing.
 */
function fifoDeductChargerUnits(chargerDoc, units) {
  const entries = Array.isArray(chargerDoc?.stockEntries)
    ? chargerDoc.stockEntries
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
    const unitPrice = Number(e.purchasePrice) || 0;
    totalCost += take * unitPrice;
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
 * Undo FIFO deduct: refill layers up to originalQuantity (oldest date first), then fallback.
 */
function fifoRestoreChargerUnits(chargerDoc, units) {
  const entries = Array.isArray(chargerDoc?.stockEntries)
    ? chargerDoc.stockEntries
    : [];
  const n = Math.floor(Number(units) || 0);
  if (n <= 0 || entries.length === 0) return;

  const order = entries
    .map((e, i) => ({
      i,
      t: parsePurchaseDateMs(e?.purchaseDate),
    }))
    .sort((a, b) => (a.t !== b.t ? a.t - b.t : a.i - b.i));

  let remaining = n;
  for (const row of order) {
    if (remaining <= 0) break;
    const e = entries[row.i];
    if (!e) continue;
    const q = Math.max(0, Number(e.quantity) || 0);
    const origRaw = e.originalQuantity;
    const orig =
      origRaw !== undefined && origRaw !== null && origRaw !== ""
        ? Math.max(0, Math.floor(Number(origRaw)))
        : null;
    const headroom = orig != null ? Math.max(0, orig - q) : remaining;
    const add = Math.min(remaining, headroom);
    if (add <= 0) continue;
    e.quantity = q + add;
    remaining -= add;
  }
  if (remaining > 0) {
    fifoRestoreToStockEntries(entries, remaining);
  }
}

/**
 * Apply charger stock change (jobcard / bill). Uses FIFO on stockEntries when present.
 */
function adjustChargerStockByUnits(chargerDoc, qtyUnits, mode) {
  const u = Math.floor(Number(qtyUnits) || 0);
  if (u <= 0 || !chargerDoc) return { totalCost: 0, deducted: 0 };

  const hasLayers =
    Array.isArray(chargerDoc.stockEntries) &&
    chargerDoc.stockEntries.length > 0;

  if (hasLayers) {
    reconcileChargerStockEntriesToTotal(chargerDoc);
    if (mode === "deduct") {
      const r = fifoDeductChargerUnits(chargerDoc, u);
      syncChargerQuantityFromStockEntries(chargerDoc);
      return r;
    }
    fifoRestoreChargerUnits(chargerDoc, u);
    syncChargerQuantityFromStockEntries(chargerDoc);
    return { totalCost: 0, deducted: u };
  }

  const factor = mode === "deduct" ? -1 : 1;
  const currentQty = Number(chargerDoc.quantity) || 0;
  chargerDoc.quantity = Math.max(0, currentQty + factor * u);
  return { totalCost: 0, deducted: mode === "deduct" ? u : 0 };
}

module.exports = {
  adjustChargerStockByUnits,
  fifoDeductChargerUnits,
  fifoRestoreChargerUnits,
  ensureChargerLayersMatchTotal,
};
