const OldChargerSummary = require("../models/OldChargerSummary");

const DEFAULT_OLD_CHARGER_SUMMARY = {
  "48V": { total: 0, working: 0, notWorking: 0 },
  "60V": { total: 0, working: 0, notWorking: 0 },
  "72V": { total: 0, working: 0, notWorking: 0 },
  Other: { total: 0, working: 0, notWorking: 0 },
};

function summaryKeyForVoltage(voltageKey) {
  return voltageKey && ["48V", "60V", "72V", "Other"].includes(voltageKey)
    ? voltageKey
    : "Other";
}

/**
 * Shift persisted summary when selling/restoring working stock (FIFO rows).
 * Same delta is applied to working and total (not notWorking).
 */
async function adjustOldChargerSummaryDelta(voltageKey, delta) {
  if (!delta) return;
  const key = summaryKeyForVoltage(voltageKey);
  const doc = await OldChargerSummary.findOne({ id: "default" }).lean();
  const base = JSON.parse(
    JSON.stringify(doc?.summary || DEFAULT_OLD_CHARGER_SUMMARY)
  );
  if (!base[key]) {
    base[key] = { total: 0, working: 0, notWorking: 0 };
  }
  base[key].working = Math.max(0, (base[key].working || 0) + delta);
  base[key].total = Math.max(0, (base[key].total || 0) + delta);
  await OldChargerSummary.findOneAndUpdate(
    { id: "default" },
    { $set: { summary: base } },
    { upsert: true, new: true }
  );
}

/**
 * Add/remove one logical unit in total + working OR total + notWorking
 * (trade-ins, manual entries, jobcard-tagged rows).
 */
async function adjustOldChargerSummaryByStatusDelta(
  voltageKey,
  statusRaw,
  delta
) {
  if (!delta) return;
  const key = summaryKeyForVoltage(voltageKey);
  const status = String(statusRaw || "").toLowerCase();
  const isWorking = status === "working";

  const doc = await OldChargerSummary.findOne({ id: "default" }).lean();
  const base = JSON.parse(
    JSON.stringify(doc?.summary || DEFAULT_OLD_CHARGER_SUMMARY)
  );
  if (!base[key]) {
    base[key] = { total: 0, working: 0, notWorking: 0 };
  }
  base[key].total = Math.max(0, (base[key].total || 0) + delta);
  if (isWorking) {
    base[key].working = Math.max(0, (base[key].working || 0) + delta);
  } else {
    base[key].notWorking = Math.max(
      0,
      (base[key].notWorking || 0) + delta
    );
  }
  await OldChargerSummary.findOneAndUpdate(
    { id: "default" },
    { $set: { summary: base } },
    { upsert: true, new: true }
  );
}

module.exports = {
  DEFAULT_OLD_CHARGER_SUMMARY,
  summaryKeyForVoltage,
  adjustOldChargerSummaryDelta,
  adjustOldChargerSummaryByStatusDelta,
};
