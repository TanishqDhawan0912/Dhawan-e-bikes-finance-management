/** Levenshtein edit distance — same rules as backend voice search. */
export function levenshtein(a, b) {
  const s = String(a || "");
  const t = String(b || "");
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const v0 = new Array(t.length + 1);
  const v1 = new Array(t.length + 1);
  for (let i = 0; i <= t.length; i++) v0[i] = i;
  for (let i = 0; i < s.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < t.length; j++) {
      const cost = s[i] === t[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= t.length; j++) v0[j] = v1[j];
  }
  return v0[t.length];
}

function maxEditDistanceForToken(tokenLen) {
  if (tokenLen <= 4) return 1;
  if (tokenLen <= 7) return 2;
  return 3;
}

function fuzzyTokenScoreAgainstText(token, text) {
  const t = String(token || "").toLowerCase();
  if (t.length < 3) return 0;
  const maxD = maxEditDistanceForToken(t.length);
  const words = String(text || "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/gi, ""))
    .filter((w) => w.length >= 3);
  let best = 0;
  for (const w of words) {
    if (Math.abs(w.length - t.length) > maxD + 3) continue;
    const d = levenshtein(t, w);
    if (d <= maxD) {
      const score = 22 - d * 7;
      if (score > best) best = score;
    }
  }
  return best;
}

/** Extra score from fuzzy match of tokens against name + supplier (e.g. throttle ↔ throttal). */
export function fuzzySoundScore(doc, tokens) {
  const name = String(doc.name || "");
  const sup = String(doc.supplierName || "");
  let total = 0;
  for (const tok of tokens) {
    if (tok.length < 3) continue;
    const a = fuzzyTokenScoreAgainstText(tok, name);
    const b = fuzzyTokenScoreAgainstText(tok, sup) * 0.6;
    total += Math.max(a, b);
  }
  return total;
}
