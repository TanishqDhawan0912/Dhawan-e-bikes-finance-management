const OldCharger = require("../models/OldCharger");
const OldChargerSummary = require("../models/OldChargerSummary");
const {
  adjustOldChargerSummaryByStatusDelta,
  summaryKeyForVoltage,
} = require("../utils/oldChargerSummaryAdjust");

const ALLOWED_VOLTAGES = ["48V", "60V", "72V"];
const ALLOWED_BATTERY_TYPES = ["lead", "lithium"];
const ALLOWED_AMPERES = ["3A", "4A", "5A"];
const ALLOWED_STATUSES = ["working", "notWorking"];

function parseOldChargerFields(body) {
  const { voltage, batteryType, ampere, status, entryDate } = body;

  if (!voltage || !voltage.trim()) {
    return { ok: false, message: "Voltage is required" };
  }
  const voltageNorm = voltage.trim().toUpperCase();
  if (!ALLOWED_VOLTAGES.includes(voltageNorm)) {
    return { ok: false, message: "Voltage must be 48V, 60V, or 72V" };
  }

  if (!batteryType || !batteryType.trim()) {
    return { ok: false, message: "Battery type is required" };
  }
  const batteryTypeNorm = batteryType.trim().toLowerCase();
  if (!ALLOWED_BATTERY_TYPES.includes(batteryTypeNorm)) {
    return { ok: false, message: "Battery type must be lead or lithium" };
  }

  if (!ampere || !ampere.trim()) {
    return { ok: false, message: "Ampere is required" };
  }
  const ampereNorm = ampere.trim().toUpperCase();
  if (!ALLOWED_AMPERES.includes(ampereNorm)) {
    return { ok: false, message: "Ampere must be 3A, 4A, or 5A" };
  }

  if (!status || !status.trim()) {
    return { ok: false, message: "Status is required" };
  }
  const statusNorm = status.trim();
  if (!ALLOWED_STATUSES.includes(statusNorm)) {
    return { ok: false, message: "Status must be working or not working" };
  }

  if (!entryDate) {
    return { ok: false, message: "Entry date is required" };
  }

  return {
    ok: true,
    voltageNorm,
    batteryTypeNorm,
    ampereNorm,
    statusNorm,
    entryDate: new Date(entryDate),
  };
}

// @desc    Create a new old charger entry
// @route   POST /api/old-chargers
// @access  Private
const createOldCharger = async (req, res) => {
  try {
    const parsed = parseOldChargerFields(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ message: parsed.message });
    }
    const { voltageNorm, batteryTypeNorm, ampereNorm, statusNorm, entryDate } =
      parsed;

    const oldCharger = new OldCharger({
      voltage: voltageNorm,
      batteryType: batteryTypeNorm,
      ampere: ampereNorm,
      status: statusNorm,
      entryDate,
      source: "manual",
    });

    const created = await oldCharger.save();
    await adjustOldChargerSummaryByStatusDelta(
      summaryKeyForVoltage(voltageNorm),
      statusNorm,
      1
    );
    return res.status(201).json(created);
  } catch (error) {
    console.error("Error creating old charger:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all old charger entries
// @route   GET /api/old-chargers
// @access  Private
const getOldChargers = async (req, res) => {
  try {
    const oldChargers = await OldCharger.find({})
      .sort({ entryDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json(oldChargers);
  } catch (error) {
    console.error("Error fetching old chargers:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete an old charger entry
// @route   DELETE /api/old-chargers/:id
// @access  Private
const deleteOldCharger = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await OldCharger.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Old charger entry not found" });
    }
    await adjustOldChargerSummaryByStatusDelta(
      summaryKeyForVoltage(existing.voltage),
      existing.status,
      -1
    );
    await OldCharger.findByIdAndDelete(id);
    console.log("[hard-delete] OldCharger:", id);
    return res.status(200).json({ message: "Deleted", id });
  } catch (error) {
    console.error("Error deleting old charger:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Update an old charger entry
// @route   PUT /api/old-chargers/:id
// @access  Private
const updateOldCharger = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await OldCharger.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Old charger entry not found" });
    }

    const parsed = parseOldChargerFields(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ message: parsed.message });
    }
    const { voltageNorm, batteryTypeNorm, ampereNorm, statusNorm, entryDate } =
      parsed;

    const beforeKey = summaryKeyForVoltage(existing.voltage);
    const beforeStatus = existing.status;
    const afterKey = summaryKeyForVoltage(voltageNorm);
    const afterStatus = statusNorm;

    if (beforeKey !== afterKey || beforeStatus !== afterStatus) {
      await adjustOldChargerSummaryByStatusDelta(
        beforeKey,
        beforeStatus,
        -1
      );
      await adjustOldChargerSummaryByStatusDelta(afterKey, afterStatus, 1);
    }

    existing.voltage = voltageNorm;
    existing.batteryType = batteryTypeNorm;
    existing.ampere = ampereNorm;
    existing.status = statusNorm;
    existing.entryDate = entryDate;

    const saved = await existing.save();
    return res.status(200).json(saved);
  } catch (error) {
    console.error("Error updating old charger:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const DEFAULT_SUMMARY = {
  "48V": { total: 0, working: 0, notWorking: 0 },
  "60V": { total: 0, working: 0, notWorking: 0 },
  "72V": { total: 0, working: 0, notWorking: 0 },
  Other: { total: 0, working: 0, notWorking: 0 },
};

// @desc    Get old charger summary (persisted table counts)
// @route   GET /api/old-chargers/summary
// @access  Private
const getOldChargerSummary = async (req, res) => {
  try {
    const doc = await OldChargerSummary.findOne({ id: "default" }).lean();
    const summary = doc?.summary || DEFAULT_SUMMARY;
    return res.status(200).json(summary);
  } catch (error) {
    console.error("Error fetching old charger summary:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Update old charger summary (persisted table counts)
// @route   PUT /api/old-chargers/summary
// @access  Private
const updateOldChargerSummary = async (req, res) => {
  try {
    const { summary } = req.body;
    if (!summary || typeof summary !== "object") {
      return res.status(400).json({ message: "summary object is required" });
    }
    const normalized = {};
    for (const v of ["48V", "60V", "72V", "Other"]) {
      const s = summary[v] || {};
      normalized[v] = {
        total: Math.max(0, parseInt(s.total, 10) || 0),
        working: Math.max(0, parseInt(s.working, 10) || 0),
        notWorking: Math.max(0, parseInt(s.notWorking, 10) || 0),
      };
    }
    const doc = await OldChargerSummary.findOneAndUpdate(
      { id: "default" },
      { summary: normalized },
      { new: true, upsert: true }
    ).lean();
    return res.status(200).json(doc.summary);
  } catch (error) {
    console.error("Error updating old charger summary:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createOldCharger,
  getOldChargers,
  deleteOldCharger,
  updateOldCharger,
  getOldChargerSummary,
  updateOldChargerSummary,
};







