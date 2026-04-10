/**
 * Shared rules for "purchase price pending" warnings on All Spares / Models / Batteries / Chargers.
 * Treats 0, empty string, null/undefined, NaN as missing (not entered).
 */

export const NO_PURCHASE_DATE_LABEL = "(no purchase date)";

export function normalizePurchaseDateLabel(raw) {
  if (raw === undefined || raw === null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s.includes("T")) return s.split("T")[0];
  return s;
}

export function isPurchasePriceMissing(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return true;
    const n = Number(t);
    return Number.isNaN(n) || n <= 0;
  }
  const n = Number(v);
  return Number.isNaN(n) || n <= 0;
}

/** Stable key for de-duping pending rows (ISO date prefix or placeholder). */
export function pendingPurchaseDateKey(raw) {
  return normalizePurchaseDateLabel(raw) || NO_PURCHASE_DATE_LABEL;
}

export function sortPendingDateKeys(keys) {
  return [...keys].sort((a, b) => {
    if (a === NO_PURCHASE_DATE_LABEL && b === NO_PURCHASE_DATE_LABEL) return 0;
    if (a === NO_PURCHASE_DATE_LABEL) return 1;
    if (b === NO_PURCHASE_DATE_LABEL) return -1;
    return String(a).localeCompare(String(b));
  });
}

/**
 * Scan stock-like rows (stockEntries, colorQuantity, etc.) for missing purchasePrice.
 * @param {...Array} rowArrays — any number of arrays of { purchasePrice, purchaseDate }
 */
export function collectPendingPurchaseDateKeys(...rowArrays) {
  const set = new Set();
  for (const rows of rowArrays) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!isPurchasePriceMissing(row?.purchasePrice)) continue;
      set.add(pendingPurchaseDateKey(row?.purchaseDate));
    }
  }
  return sortPendingDateKeys(Array.from(set));
}

/** Short display: YYYY-MM-DD → DD/MM/YY; dd/mm/yyyy → dd/mm/yy; placeholder unchanged. */
export function formatPendingPurchaseDateDisplay(label) {
  if (!label) return "";
  if (label === NO_PURCHASE_DATE_LABEL) return label;

  const m = label.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const yy = m[1].slice(2);
    return `${m[3]}/${m[2]}/${yy}`;
  }

  const parts = label.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyyOrYy] = parts;
    if (typeof yyyyOrYy === "string" && yyyyOrYy.length === 4) {
      return `${dd}/${mm}/${yyyyOrYy.slice(2)}`;
    }
  }

  return label;
}

export function formatPendingPurchaseDatesJoined(labels) {
  return labels.map(formatPendingPurchaseDateDisplay).filter(Boolean).join(", ");
}
