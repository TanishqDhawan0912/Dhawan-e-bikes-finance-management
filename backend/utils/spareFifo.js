/**
 * FIFO spare stock: deduct / restore against stockEntries or colorQuantity layers
 * (oldest purchaseDate first on deduct; reverse on restore = LIFO back into layers).
 */

function parsePurchaseDateMs(dateValue) {
  if (dateValue == null || dateValue === "") return -Infinity;
  if (typeof dateValue !== "string") {
    const t = new Date(dateValue).getTime();
    return Number.isNaN(t) ? -Infinity : t;
  }
  if (dateValue.includes("/")) {
    const parts = dateValue.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (
        !Number.isNaN(day) &&
        !Number.isNaN(month) &&
        !Number.isNaN(year) &&
        day > 0 &&
        month > 0
      ) {
        return new Date(year, month - 1, day).getTime();
      }
    }
  }
  const ts = new Date(dateValue).getTime();
  return Number.isNaN(ts) ? -Infinity : ts;
}

function normalizeColorKey(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

/**
 * Deduct units using FIFO over stockEntries (by purchaseDate asc).
 * @returns {{ totalCost: number, deducted: number }}
 */
function fifoDeductFromStockEntries(stockEntries, units) {
  const entries = Array.isArray(stockEntries) ? stockEntries : [];
  if (!units || units <= 0) return { totalCost: 0, deducted: 0 };
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

  let need = units;
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
    e.quantity = current - take;
    deducted += take;
    need -= take;
  }
  return { totalCost, deducted };
}

/**
 * Deduct units using FIFO over colorQuantity rows (optionally filter by color).
 * When colorKey is null/empty, uses all rows (e.g. bill accessories without color).
 */
function fifoDeductFromColorQuantity(colorQuantity, units, colorKeyRaw) {
  const rows = Array.isArray(colorQuantity) ? colorQuantity : [];
  if (!units || units <= 0) return { totalCost: 0, deducted: 0 };
  const ck = normalizeColorKey(colorKeyRaw);
  const order = rows
    .map((cq, i) => ({
      i,
      t: parsePurchaseDateMs(cq?.purchaseDate),
      q: Math.max(0, Number(cq?.quantity) || 0),
      color: normalizeColorKey(cq?.color),
    }))
    .filter((x) => x.q > 0 && (!ck || x.color === ck))
    .sort((a, b) => {
      if (a.t !== b.t) return a.t - b.t;
      return a.i - b.i;
    });

  let need = units;
  let totalCost = 0;
  let deducted = 0;
  for (const row of order) {
    if (need <= 0) break;
    const cq = rows[row.i];
    const current = Math.max(0, Number(cq.quantity) || 0);
    if (current <= 0) continue;
    const take = Math.min(need, current);
    const unitPrice = Number(cq.purchasePrice) || 0;
    totalCost += take * unitPrice;
    cq.quantity = current - take;
    deducted += take;
    need -= take;
  }
  return { totalCost, deducted };
}

/** Restore units onto stockEntries (add back to newest-dated entry; best-effort inverse of FIFO). */
function fifoRestoreToStockEntries(stockEntries, units) {
  const entries = Array.isArray(stockEntries) ? stockEntries : [];
  if (!units || units <= 0 || entries.length === 0) return;
  let bestI = -1;
  let bestT = -Infinity;
  entries.forEach((e, i) => {
    if (!e) return;
    const t = parsePurchaseDateMs(e?.purchaseDate);
    if (t >= bestT) {
      bestT = t;
      bestI = i;
    }
  });
  const target =
    bestI >= 0 ? entries[bestI] : entries[entries.length - 1];
  if (!target) return;
  target.quantity = Math.max(
    0,
    (Number(target.quantity) || 0) + Math.floor(units)
  );
}

/** Restore onto colorQuantity (newest matching row by purchaseDate). */
function fifoRestoreToColorQuantity(colorQuantity, units, colorKeyRaw) {
  const rows = Array.isArray(colorQuantity) ? colorQuantity : [];
  if (!units || units <= 0 || rows.length === 0) return;
  const ck = normalizeColorKey(colorKeyRaw);
  const candidates = rows
    .map((cq, i) => ({
      i,
      t: parsePurchaseDateMs(cq?.purchaseDate),
      color: normalizeColorKey(cq?.color),
    }))
    .filter((x) => !ck || x.color === ck);
  const list = candidates.length ? candidates : rows.map((cq, i) => ({ i, t: parsePurchaseDateMs(cq?.purchaseDate) }));
  let bestI = -1;
  let bestT = -Infinity;
  for (const x of list) {
    if (x.t >= bestT) {
      bestT = x.t;
      bestI = x.i;
    }
  }
  const target =
    bestI >= 0 ? rows[bestI] : rows[rows.length - 1];
  if (!target) return;
  target.quantity = Math.max(
    0,
    (Number(target.quantity) || 0) + Math.floor(units)
  );
}

/**
 * Apply FIFO deduct on a Spare mongoose doc (mutates in memory).
 * @param {object} spare - Spare document
 * @param {number} units
 * @param {{ colorKey?: string|null }} opts - jobcard line color; omit/null for bills (all layers by date)
 * @returns {{ totalCost: number, deducted: number }}
 */
function fifoDeductFromSpare(spare, units, opts = {}) {
  if (!spare || !units || units <= 0) return { totalCost: 0, deducted: 0 };
  const colorKey = opts.colorKey;

  if (Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0) {
    return fifoDeductFromColorQuantity(spare.colorQuantity, units, colorKey);
  }
  if (Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0) {
    return fifoDeductFromStockEntries(spare.stockEntries, units);
  }
  spare.quantity = Math.max(
    0,
    (Number(spare.quantity) || 0) - Math.floor(units)
  );
  return { totalCost: 0, deducted: Math.floor(units) };
}

function fifoRestoreToSpare(spare, units, opts = {}) {
  if (!spare || !units || units <= 0) return;
  const colorKey = opts.colorKey;

  if (Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0) {
    fifoRestoreToColorQuantity(spare.colorQuantity, units, colorKey);
    return;
  }
  if (Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0) {
    fifoRestoreToStockEntries(spare.stockEntries, units);
    return;
  }
  spare.quantity = Math.max(
    0,
    (Number(spare.quantity) || 0) + Math.floor(units)
  );
}

module.exports = {
  parsePurchaseDateMs,
  fifoDeductFromSpare,
  fifoRestoreToSpare,
};
