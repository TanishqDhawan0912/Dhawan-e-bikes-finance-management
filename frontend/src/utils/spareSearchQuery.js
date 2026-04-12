import { fuzzySoundScore } from "./stringSimilarity";

/**
 * Loose spare name/supplier match: full phrase, any word, or fuzzy “sounds-like” spelling.
 * Aligns with POST /api/items/search-by-voice behaviour.
 */
export function tokenizeSearchQuery(q) {  return String(q || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/gi, ""))
    .filter((t) => t.length >= 2);
}

export function spareMatchesNameOrSupplier(spare, searchTerm) {
  const q = String(searchTerm || "").trim().toLowerCase();
  if (!q) return true;
  const name = String(spare?.name || "").toLowerCase();
  const sup = String(spare?.supplierName || "").toLowerCase();
  if (name.includes(q) || sup.includes(q)) return true;
  const tokens = tokenizeSearchQuery(q);
  if (tokens.length === 0) {
    return name.includes(q) || sup.includes(q);
  }
  if (tokens.some((t) => name.includes(t) || sup.includes(t))) return true;
  return fuzzySoundScore(spare, tokens) > 0;
}

/** Higher = better match (for sorting) */
export function spareMatchRank(spare, searchTerm) {
  const q = String(searchTerm || "").trim().toLowerCase();
  if (!q) return 0;
  const name = String(spare?.name || "").toLowerCase();
  const sup = String(spare?.supplierName || "").toLowerCase();
  let score = 0;
  if (name.includes(q)) score += 25;
  else if (sup.includes(q)) score += 12;
  const tokens = tokenizeSearchQuery(q);
  for (const t of tokens) {
    if (name.includes(t)) score += 8;
    if (sup.includes(t)) score += 3;
  }
  score += fuzzySoundScore(spare, tokens);
  return score;
}
