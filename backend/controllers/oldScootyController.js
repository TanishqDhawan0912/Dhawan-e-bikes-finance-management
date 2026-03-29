const OldScooty = require("../models/OldScooty");
const Spare = require("../models/Spare");
const BatteryScrap = require("../models/BatteryScrap");
const OldCharger = require("../models/OldCharger");
const {
  adjustOldChargerSummaryByStatusDelta,
} = require("../utils/oldChargerSummaryAdjust");

const parseOldChargerVoltage = (raw) => {
  const s = String(raw || "").trim().toUpperCase();
  if (s.includes("72")) return "72V";
  if (s.includes("60")) return "60V";
  if (s.includes("48")) return "48V";
  return null;
};

const parseOldChargerAmpere = (raw) => {
  const s = String(raw || "").trim().toUpperCase().replace(/\s/g, "");
  if (s.includes("5A") || s.endsWith("5A") || s.includes("5AMP")) return "5A";
  if (s.includes("3A") || s.endsWith("3A") || s.includes("3AMP")) return "3A";
  return "4A";
};

const normalizeBatteryType = (raw) => {
  const s = String(raw || "").trim().toLowerCase();
  return s === "lithium" ? "lithium" : "lead";
};

const normalizeWorkingStatus = (raw) => {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "notworking" || s.includes("not")) return "notWorking";
  return "working";
};

const upsertBatteryAndChargerEntriesForOldScooty = async (oldScootyDoc) => {
  if (!oldScootyDoc?._id) return;

  // Remove previous linked entries (idempotent for create+edit flows).
  await BatteryScrap.deleteMany({ oldScootyId: oldScootyDoc._id });

  const prevChargers = await OldCharger.find({
    oldScootyId: oldScootyDoc._id,
  }).lean();
  if (prevChargers.length) {
    for (const row of prevChargers) {
      await adjustOldChargerSummaryByStatusDelta(
        row.voltage,
        row.status,
        -1
      );
    }
    await OldCharger.deleteMany({ oldScootyId: oldScootyDoc._id });
  }

  const entryDate = oldScootyDoc.entryDate ? new Date(oldScootyDoc.entryDate) : new Date();

  // If old scooty has old batteries, add them into scrap stock (old batteries stock).
  if (oldScootyDoc.withBattery) {
    const qty = Math.max(1, Number(oldScootyDoc.batteryCount) || 1);
    await BatteryScrap.create({
      quantity: qty,
      entryDate,
      oldScootyId: oldScootyDoc._id,
      source: "oldScooty",
    });
  }

  // If old scooty has old charger, add to old charger stock + summary.
  if (oldScootyDoc.withCharger) {
    const voltage = parseOldChargerVoltage(oldScootyDoc.chargerVoltageAmpere);
    if (voltage) {
      const batteryType = normalizeBatteryType(oldScootyDoc.chargerType);
      const ampere = parseOldChargerAmpere(oldScootyDoc.chargerVoltageAmpere);
      const status = normalizeWorkingStatus(oldScootyDoc.chargerWorking);
      const row = new OldCharger({
        voltage,
        batteryType,
        ampere,
        status,
        entryDate,
        oldScootyId: oldScootyDoc._id,
        source: "oldScooty",
      });
      await row.save();
      await adjustOldChargerSummaryByStatusDelta(voltage, status, 1);
    }
  }
};

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
      chargerWorking,
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
      chargerWorking: normalizeWorkingStatus(chargerWorking),
      entryDate: new Date(entryDate),
      status: status === "ready" ? "ready" : "not-ready",
      sparesUsed: normalizedSpares,
    });

    let created = await oldScooty.save();

    // Deduct stock spares whenever lines reference inventory (not only when "ready").
    const sparesToDeduct = normalizedSpares.filter((s) => s.spareId);
    if (sparesToDeduct.length) {
      await adjustSpareInventoryForOldScooty(sparesToDeduct, "deduct");
      created.inventoryAdjusted = true;
      created.consumedSparesUsed = sparesToDeduct.map((s) => ({
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

    // If scooty includes old battery/charger, create those inventory entries.
    await upsertBatteryAndChargerEntriesForOldScooty(created);

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
      chargerWorking,
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
    existing.chargerWorking = normalizeWorkingStatus(chargerWorking);
    existing.entryDate = new Date(entryDate);
    existing.status = status === "ready" ? "ready" : "not-ready";
    existing.sparesUsed = normalizedSpares;

    // Apply new deduction for any stock-linked spare lines (same as create — not gated on "ready").
    const sparesToDeduct = normalizedSpares.filter((s) => s.spareId);
    if (sparesToDeduct.length) {
      await adjustSpareInventoryForOldScooty(sparesToDeduct, "deduct");
      existing.inventoryAdjusted = true;
      existing.consumedSparesUsed = sparesToDeduct.map((s) => ({
        spareId: s.spareId,
        quantity: Math.max(1, Number(s.quantity) || 1),
        color: s.color ? String(s.color).trim() : "",
      }));
    } else {
      existing.inventoryAdjusted = false;
      existing.consumedSparesUsed = [];
    }

    const updated = await existing.save();

    // Keep old battery/charger linked entries in sync with edit.
    await upsertBatteryAndChargerEntriesForOldScooty(updated);

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

    // Remove linked old battery/charger entries (since the scooty is deleted).
    try {
      await BatteryScrap.deleteMany({ oldScootyId: existing._id });
      const prevChargers = await OldCharger.find({
        oldScootyId: existing._id,
      }).lean();
      if (prevChargers.length) {
        for (const row of prevChargers) {
          await adjustOldChargerSummaryByStatusDelta(
            row.voltage,
            row.status,
            -1
          );
        }
      }
      await OldCharger.deleteMany({ oldScootyId: existing._id });
    } catch (invErr) {
      console.error(
        "Error removing old battery/charger entries while deleting old scooty:",
        invErr
      );
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
