/** Normalize spare.models to unique non-empty strings */
export function getModelOptions(spare) {
  const m = spare?.models;
  if (!Array.isArray(m)) return [];
  return [
    ...new Set(
      m.map((x) => String(x || "").trim()).filter(Boolean)
    ),
  ];
}

const UNIVERSAL_LABELS = new Set([
  "universal",
  "all",
  "all models",
  "all model",
  "common",
  "na",
  "n/a",
  "any",
  "generic",
]);

/** Empty models, or only universal-style entries → fits all models */
export function isUniversalSpare(spare) {
  const opts = getModelOptions(spare);
  if (opts.length === 0) return true;
  if (opts.length === 1 && UNIVERSAL_LABELS.has(opts[0].toLowerCase())) {
    return true;
  }
  return false;
}

/** More than one distinct compatible model → user must choose */
export function needsModelPicker(spare) {
  if (!spare || isUniversalSpare(spare)) return false;
  return getModelOptions(spare).length >= 2;
}
