/**
 * Parse voice/text like "add brake pads" or "add brake pads quantity 2".
 * Quantity defaults to 1 and only changes when the user says **quantity** or **qty**
 * followed by a number — digits ("quantity 3"), spoken English ("quantity five"),
 * or common speech-to-text slips for 1–10 (e.g. "quantity to" → 2). Other numbers
 * stay in the item name.
 *
 * Phrases with the word **custom** (e.g. "add custom brake pad") are treated as
 * manual custom spare lines: `isCustom: true`, item name is the text after "custom".
 */

/**
 * Common speech-to-text confusions for 1–10 after "quantity"/"qty"
 * (e.g. "two" transcribed as "to").
 */
const STT_QUANTITY_ONE_TO_TEN = {
  won: 1,
  to: 2,
  too: 2,
  tu: 2,
  tree: 3,
  free: 3,
  for: 4,
  fore: 4,
  ate: 8,
};

/** Map spoken English (and digit-only strings) to a positive integer, or null if not a quantity. */
function spokenEnglishToPositiveInt(phrase) {
  const s = String(phrase || "")
    .trim()
    .toLowerCase()
    .replace(/[-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!s) return null;

  if (/^\d+$/.test(s)) {
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  }

  const ones = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
  };
  const teens = {
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
  };
  const tens = {
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  };

  /** Single token: canonical word, STT alias, or teen/ten multiple */
  function oneWordToInt(w) {
    if (ones[w] !== undefined) return ones[w];
    if (STT_QUANTITY_ONE_TO_TEN[w] !== undefined) return STT_QUANTITY_ONE_TO_TEN[w];
    if (teens[w] !== undefined) return teens[w];
    if (tens[w] !== undefined) return tens[w];
    return null;
  }

  if (!/\s/.test(s)) {
    const n = oneWordToInt(s);
    return n;
  }

  const parts = s.split(" ");
  if (parts.length === 2) {
    const [a, b] = parts;
    if (tens[a] !== undefined) {
      const low = oneWordToInt(b);
      if (low !== null && b !== "zero" && low < 10) {
        return tens[a] + low;
      }
    }
  }

  return null;
}

/** Last explicit `quantity|qty` + number (digits or spoken) in the string, or 1 if none. */
function quantityFromExplicitPhrase(lower) {
  let quantity = 1;
  const re = /\b(?:quantity|qty)\s+/gi;
  let m;
  while ((m = re.exec(lower)) !== null) {
    const from = m.index + m[0].length;
    const tail = lower.slice(from);

    const numDigits = tail.match(/^(\d+)\b/);
    if (numDigits) {
      quantity = Math.max(1, Number.parseInt(numDigits[1], 10) || 1);
      continue;
    }

    const wordChunk = tail.match(/^([a-z]+(?:\s+[a-z]+){0,2})\b/);
    if (wordChunk) {
      const n = spokenEnglishToPositiveInt(wordChunk[1]);
      if (n != null && n >= 1) quantity = Math.floor(n);
    }
  }
  return quantity;
}

/** Remove `quantity|qty` + number phrases (digits or spoken). Keeps other text. */
function stripExplicitQuantityPhrases(s) {
  let t = String(s || "");
  t = t.replace(/\b(?:quantity|qty)\s+\d+\b/gi, " ");
  t = t.replace(/\b(?:quantity|qty)\s+([a-z]+(?:\s+[a-z]+){0,2})\b/gi, (full, words) => {
    const n = spokenEnglishToPositiveInt(words.trim());
    return n != null ? " " : full;
  });
  return t.replace(/\s+/g, " ").trim();
}

export function parseVoiceSpareText(raw) {
  const text = String(raw || "").trim();
  const lower = text.toLowerCase();

  const customWord = lower.match(/\bcustom\b/);
  if (customWord) {
    const idx = customWord.index;
    const keyLen = customWord[0].length;
    const afterRaw = text.slice(idx + keyLen).trim();

    const quantity = quantityFromExplicitPhrase(lower);

    const itemName = stripExplicitQuantityPhrases(afterRaw)
      .replace(/\b(add|get|put|pcs?|pieces?|numbers?)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    return { quantity, itemName, isCustom: true };
  }

  if (!lower) {
    return { quantity: 1, itemName: "", isCustom: false };
  }

  const quantity = quantityFromExplicitPhrase(lower);

  let rest = stripExplicitQuantityPhrases(lower)
    .replace(/\b(add|get|put|pcs?|pieces?|numbers?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const itemName = rest.replace(/^[\s,]+|[\s,]+$/g, "").trim();
  return { quantity, itemName, isCustom: false };
}

/** For inputs: keep only integer digits (no letters/symbols). */
export function filterIntegerDigits(raw) {
  return String(raw ?? "").replace(/\D/g, "");
}
