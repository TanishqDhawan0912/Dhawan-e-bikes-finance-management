const OldCharger = require("../models/OldCharger");
const OldChargerSummary = require("../models/OldChargerSummary");

// @desc    Create a new old charger entry
// @route   POST /api/old-chargers
// @access  Private
const createOldCharger = async (req, res) => {
  try {
    const { voltage, batteryType, ampere, status, entryDate } = req.body;

    const allowedVoltages = ["48V", "60V", "72V"];
    const allowedBatteryTypes = ["lead", "lithium"];
    const allowedAmperes = ["3A", "4A", "5A"];
    const allowedStatuses = ["working", "notWorking"];

    if (!voltage || !voltage.trim()) {
      return res.status(400).json({ message: "Voltage is required" });
    }
    const voltageNorm = voltage.trim().toUpperCase();
    if (!allowedVoltages.includes(voltageNorm)) {
      return res.status(400).json({ message: "Voltage must be 48V, 60V, or 72V" });
    }

    if (!batteryType || !batteryType.trim()) {
      return res.status(400).json({ message: "Battery type is required" });
    }
    const batteryTypeNorm = batteryType.trim().toLowerCase();
    if (!allowedBatteryTypes.includes(batteryTypeNorm)) {
      return res.status(400).json({ message: "Battery type must be lead or lithium" });
    }

    if (!ampere || !ampere.trim()) {
      return res.status(400).json({ message: "Ampere is required" });
    }
    const ampereNorm = ampere.trim().toUpperCase();
    if (!allowedAmperes.includes(ampereNorm)) {
      return res.status(400).json({ message: "Ampere must be 3A, 4A, or 5A" });
    }

    if (!status || !status.trim()) {
      return res.status(400).json({ message: "Status is required" });
    }
    const statusNorm = status.trim();
    if (!allowedStatuses.includes(statusNorm)) {
      return res.status(400).json({ message: "Status must be working or not working" });
    }

    if (!entryDate) {
      return res.status(400).json({ message: "Entry date is required" });
    }

    const oldCharger = new OldCharger({
      voltage: voltageNorm,
      batteryType: batteryTypeNorm,
      ampere: ampereNorm,
      status: statusNorm,
      entryDate: new Date(entryDate),
    });

    const created = await oldCharger.save();
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
    const deleted = await OldCharger.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Old charger entry not found" });
    }
    return res.status(200).json({ message: "Deleted", id: deleted._id });
  } catch (error) {
    console.error("Error deleting old charger:", error);
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
  getOldChargerSummary,
  updateOldChargerSummary,
};







