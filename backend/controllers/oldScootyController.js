const OldScooty = require("../models/OldScooty");
const Spare = require("../models/Spare");

const adjustSpareInventoryForOldScooty = async (spares, mode = "deduct") => {
  const list = Array.isArray(spares) ? spares : [];
  if (!list.length) return;

  const factor = mode === "restore" ? 1 : -1;

  for (const s of list) {
    if (!s || !s.spareId) continue;
    const qty = Number(s.quantity) || 0;
    if (qty <= 0) continue;

    const spare = await Spare.findById(s.spareId);
    if (!spare) continue;

    const qtyDelta = factor * qty;
    const colorKey = String(s.color || "")
      .trim()
      .toLowerCase();

    if (spare.hasColors && Array.isArray(spare.colorQuantity) && colorKey) {
      const colorEntry = spare.colorQuantity.find(
        (cq) =>
          cq &&
          typeof cq.color === "string" &&
          cq.color.trim().toLowerCase() === colorKey
      );
      if (colorEntry) {
        colorEntry.quantity = Math.max(
          0,
          (Number(colorEntry.quantity) || 0) + qtyDelta
        );
      } else {
        spare.quantity = Math.max(0, (Number(spare.quantity) || 0) + qtyDelta);
      }
    } else {
      spare.quantity = Math.max(0, (Number(spare.quantity) || 0) + qtyDelta);
    }

    await spare.save();
  }
};

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

    let created = await oldScooty.save();

    // Deduct spares from inventory if scooty is marked ready.
    if (created.status === "ready" && normalizedSpares.length) {
      await adjustSpareInventoryForOldScooty(normalizedSpares, "deduct");
      created.inventoryAdjusted = true;
      created.consumedSparesUsed = normalizedSpares
        .filter((s) => s.spareId)
        .map((s) => ({
          spareId: s.spareId,
          quantity: Math.max(1, Number(s.quantity) || 1),
          color: s.color ? String(s.color).trim() : "",
        }));
      created = await created.save();
    } else {
      created.inventoryAdjusted = false;
      created.consumedSparesUsed = [];
      created = await created.save();
    }

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

    const existing = await OldScooty.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Old scooty not found" });
    }

    // Restore previous deduction first (if any), to avoid double count.
    if (existing.inventoryAdjusted && existing.consumedSparesUsed?.length) {
      await adjustSpareInventoryForOldScooty(
        existing.consumedSparesUsed,
        "restore"
      );
    }

    existing.name = name.trim();
    existing.pmcNo = pmcNo ? String(pmcNo).trim() : "";
    existing.purchasePrice = parsedPrice;
    existing.withBattery = Boolean(withBattery);
    existing.batteryCount = parsedBatteryCount;
    existing.batteryType = batteryType ? String(batteryType).trim() : "";
    existing.withCharger = Boolean(withCharger);
    existing.chargerVoltageAmpere = chargerVoltageAmpere
      ? String(chargerVoltageAmpere).trim()
      : "";
    existing.chargerType = chargerType ? String(chargerType).trim() : "";
    existing.entryDate = new Date(entryDate);
    existing.status = status === "ready" ? "ready" : "not-ready";
    existing.sparesUsed = normalizedSpares;

    // Apply new deduction only if marked ready.
    if (existing.status === "ready" && normalizedSpares.length) {
      await adjustSpareInventoryForOldScooty(normalizedSpares, "deduct");
      existing.inventoryAdjusted = true;
      existing.consumedSparesUsed = normalizedSpares
        .filter((s) => s.spareId)
        .map((s) => ({
          spareId: s.spareId,
          quantity: Math.max(1, Number(s.quantity) || 1),
          color: s.color ? String(s.color).trim() : "",
        }));
    } else {
      existing.inventoryAdjusted = false;
      existing.consumedSparesUsed = [];
    }

    const updated = await existing.save();

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
    const existing = await OldScooty.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Old scooty not found" });
    }

    if (existing.inventoryAdjusted && existing.consumedSparesUsed?.length) {
      try {
        await adjustSpareInventoryForOldScooty(
          existing.consumedSparesUsed,
          "restore"
        );
      } catch (invErr) {
        console.error(
          "Error restoring spare inventory while deleting old scooty:",
          invErr
        );
      }
    }

    await existing.deleteOne();
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
