/**
 * Parse voice/text like "add brake pads" or "add brake pads quantity 2".
 * Quantity defaults to 1 and only changes when the user says **quantity** or **qty**
 * followed by a number (e.g. "quantity 3", "qty 2"). Other numbers stay in the item name.
 *
 * Phrases with the word **custom** (e.g. "add custom brake pad") are treated as
 * manual custom spare lines: `isCustom: true`, item name is the text after "custom".
 */

/** Last explicit `quantity|qty <number>` in the string, or 1 if none. */
function quantityFromExplicitPhrase(lower) {
  const re = /\b(?:quantity|qty)\s+(\d+(?:\.\d+)?)\b/gi;
  let quantity = 1;
  let m;
  while ((m = re.exec(lower)) !== null) {
    quantity = Math.max(1, Math.floor(Number.parseFloat(m[1]) || 1));
  }
  return quantity;
}

/** Remove `quantity|qty <number>` phrases (keeps other digits in the name). */
function stripExplicitQuantityPhrases(s) {
  return String(s || "")
    .replace(/\b(?:quantity|qty)\s+\d+(?:\.\d+)?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
