/**
 * Turn voice transcript into work-detail lines.
 * Single phrase → one line. Multiple items → split on the word **and** (e.g. "a and b").
 */
export function parseWorkDetailsTranscript(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  return text
    .split(/\s+and\s+/i)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
