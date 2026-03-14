const OldScooty = require("../models/OldScooty");

// @desc    Create a new old scooty entry
// @route   POST /api/old-scooties
const createOldScooty = async (req, res) => {
  try {
    const {
      name,
      entryDate,
      pmcNo,
      purchasePrice,
      withBattery,
      withCharger,
      batteryCount,
      chargerVoltageAmpere,
      batteryType,
      chargerType,
      status,
      sparesUsed,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Model name is required" });
    }

    if (!entryDate) {
      return res.status(400).json({ message: "Entry date is required" });
    }

    const parsedPrice =
      purchasePrice !== undefined && purchasePrice !== null
        ? Number(purchasePrice)
        : 0;

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res
        .status(400)
        .json({ message: "Purchase price must be a non-negative number" });
    }

    const parsedBatteryCount =
      batteryCount !== undefined && batteryCount !== null
        ? parseInt(batteryCount, 10)
        : 0;

    if (!Number.isInteger(parsedBatteryCount) || parsedBatteryCount < 0) {
      return res
        .status(400)
        .json({ message: "Battery count must be a non-negative integer" });
    }

    const normalizedSpares =
      Array.isArray(sparesUsed) && sparesUsed.length
        ? sparesUsed
            .map((s) => (s && typeof s === "object" ? s : null))
            .filter(Boolean)
            .map((s) => ({
              spareId: s.spareId || null,
              name: String(s.name || "").trim(),
              quantity: Math.max(
                1,
                Number.isFinite(Number(s.quantity)) ? Number(s.quantity) : 1
              ),
              color: s.color ? String(s.color).trim() : "",
            }))
            .filter((s) => s.name)
        : [];

    const oldScooty = new OldScooty({
      name: name.trim(),
      pmcNo: pmcNo ? String(pmcNo).trim() : "",
      purchasePrice: parsedPrice,
      withBattery: Boolean(withBattery),
      batteryCount: parsedBatteryCount,
      batteryType: batteryType ? String(batteryType).trim() : "",
      withCharger: Boolean(withCharger),
      chargerVoltageAmpere: chargerVoltageAmpere
        ? String(chargerVoltageAmpere).trim()
        : "",
      chargerType: chargerType ? String(chargerType).trim() : "",
      entryDate: new Date(entryDate),
      status: status === "ready" ? "ready" : "not-ready",
      sparesUsed: normalizedSpares,
    });

    const created = await oldScooty.save();
    return res.status(201).json(created);
  } catch (error) {
    console.error("Error creating old scooty:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all old scooty entries
// @route   GET /api/old-scooties
const getOldScooties = async (req, res) => {
  try {
    const oldScooties = await OldScooty.find({})
      .sort({ entryDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json(oldScooties);
  } catch (error) {
    console.error("Error fetching old scooties:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Update an existing old scooty entry
// @route   PUT /api/old-scooties/:id
const updateOldScooty = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Old scooty id is required" });
    }

    const {
      name,
      entryDate,
      pmcNo,
      purchasePrice,
      withBattery,
      withCharger,
      batteryCount,
      chargerVoltageAmpere,
      batteryType,
      chargerType,
      status,
      sparesUsed,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Model name is required" });
    }

    if (!entryDate) {
      return res.status(400).json({ message: "Entry date is required" });
    }

    const parsedPrice =
      purchasePrice !== undefined && purchasePrice !== null
        ? Number(purchasePrice)
        : 0;

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res
        .status(400)
        .json({ message: "Purchase price must be a non-negative number" });
    }

    const parsedBatteryCount =
      batteryCount !== undefined && batteryCount !== null
        ? parseInt(batteryCount, 10)
        : 0;

    if (!Number.isInteger(parsedBatteryCount) || parsedBatteryCount < 0) {
      return res
        .status(400)
        .json({ message: "Battery count must be a non-negative integer" });
    }

    const normalizedSpares =
      Array.isArray(sparesUsed) && sparesUsed.length
        ? sparesUsed
            .map((s) => (s && typeof s === "object" ? s : null))
            .filter(Boolean)
            .map((s) => ({
              spareId: s.spareId || null,
              name: String(s.name || "").trim(),
              quantity: Math.max(
                1,
                Number.isFinite(Number(s.quantity)) ? Number(s.quantity) : 1
              ),
              color: s.color ? String(s.color).trim() : "",
            }))
            .filter((s) => s.name)
        : [];

    const updated = await OldScooty.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        pmcNo: pmcNo ? String(pmcNo).trim() : "",
        purchasePrice: parsedPrice,
        withBattery: Boolean(withBattery),
        batteryCount: parsedBatteryCount,
        batteryType: batteryType ? String(batteryType).trim() : "",
        withCharger: Boolean(withCharger),
        chargerVoltageAmpere: chargerVoltageAmpere
          ? String(chargerVoltageAmpere).trim()
          : "",
        chargerType: chargerType ? String(chargerType).trim() : "",
        entryDate: new Date(entryDate),
        status: status === "ready" ? "ready" : "not-ready",
         sparesUsed: normalizedSpares,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Old scooty not found" });
    }

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating old scooty:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete an old scooty entry
// @route   DELETE /api/old-scooties/:id
const deleteOldScooty = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Old scooty id is required" });
    }
    const deleted = await OldScooty.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Old scooty not found" });
    }
    return res.status(200).json({ message: "Old scooty deleted successfully" });
  } catch (error) {
    console.error("Error deleting old scooty:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createOldScooty,
  getOldScooties,
  updateOldScooty,
  deleteOldScooty,
};
