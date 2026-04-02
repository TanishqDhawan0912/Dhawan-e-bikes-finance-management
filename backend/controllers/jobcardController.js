const Jobcard = require("../models/Jobcard");
const Spare = require("../models/Spare");
const {
  fifoDeductFromSpare,
  fifoRestoreToSpare,
} = require("../utils/spareFifo");

// Keep spare.quantity in sync with its layered stock (colorQuantity / stockEntries).
function syncSpareQuantityFromLayers(spare) {
  if (!spare) return;
  if (Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0) {
    spare.quantity = spare.colorQuantity.reduce(
      (sum, cq) => sum + (Number(cq?.quantity) || 0),
      0
    );
  } else if (Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0) {
    spare.quantity = spare.stockEntries.reduce(
      (sum, e) => sum + (Number(e?.quantity) || 0),
      0
    );
  }
}
const Battery = require("../models/Battery");
const BatteryScrap = require("../models/BatteryScrap");
const { adjustBatteryStockByUnits } = require("../utils/batteryInventoryAdjust");
const { adjustChargerStockByUnits } = require("../utils/chargerInventoryAdjust");
const Charger = require("../models/Charger");
const OldCharger = require("../models/OldCharger");
const OldChargerSummary = require("../models/OldChargerSummary");
const OldScooty = require("../models/OldScooty");
const {
  adjustOldChargerSummaryDelta,
  adjustOldChargerSummaryByStatusDelta,
  summaryKeyForVoltage,
} = require("../utils/oldChargerSummaryAdjust");

const VALID_OLD_CHARGER_INVENTORY_VOLTAGES = ["48V", "60V", "72V"];

/** Jobcard parts store the battery doc id on spareId (new battery sales); may be populated. */
function resolveBatteryInventoryIdFromPart(part) {
  if (!part) return null;
  const candidates = [
    part.batteryInventoryId,
    part.batteryId,
    part.spareId,
    part.id,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const id = typeof c === "object" && c !== null && c._id != null ? c._id : c;
    if (id) return id;
  }
  return null;
}

function parseVoltageForOldChargerJobcard(v) {
  if (!v || typeof v !== "string") return "48V";
  const s = v.trim().toUpperCase();
  if (s.includes("72") || s === "72") return "72V";
  if (s.includes("60") || s === "60") return "60V";
  return "48V";
}

function isOldChargerStockSalePartPlain(part) {
  if (!part || part.partType !== "sales") return false;
  const nameLooksOld = /^\s*old\s*charger\s*$/i.test(
    String(part.spareName || "").trim()
  );
  const st = (part.salesType || "").toString().toLowerCase();
  if (st !== "charger" && !(part.isCustom && nameLooksOld)) return false;
  if (String(part.chargerOldNew || "").toLowerCase() === "old") return true;
  if (part.isCustom === true && nameLooksOld) return true;
  return false;
}

/** Coerce snapshot fields so restore insertMany matches OldCharger schema (enum validation). */
function normalizeOldChargerAmpereForDb(amp) {
  const s = String(amp ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s/g, "");
  if (s === "3A" || s === "4A" || s === "5A") return s;
  if (s.includes("5")) return "5A";
  if (s.includes("3")) return "3A";
  return "4A";
}

function normalizeOldChargerStatusForDb(st) {
  const s = String(st || "")
    .trim()
    .toLowerCase();
  if (s === "notworking" || s.includes("not")) return "notWorking";
  return "working";
}

function normalizeBatteryTypeForOldCharger(bt) {
  const s = String(bt || "lead")
    .trim()
    .toLowerCase();
  return s === "lithium" ? "lithium" : "lead";
}

function oldChargerSnapshotToRow(snap) {
  let voltage = snap.voltage;
  if (!VALID_OLD_CHARGER_INVENTORY_VOLTAGES.includes(voltage)) {
    voltage = parseVoltageForOldChargerJobcard(String(voltage || ""));
  }
  const row = {
    voltage,
    batteryType: normalizeBatteryTypeForOldCharger(snap.batteryType),
    ampere: normalizeOldChargerAmpereForDb(snap.ampere),
    status: normalizeOldChargerStatusForDb(snap.status),
    entryDate: snap.entryDate ? new Date(snap.entryDate) : new Date(),
  };
  if (snap.jobcardNumber) row.jobcardNumber = snap.jobcardNumber;
  return row;
}

/** Count consumed snapshots per inventory voltage key (48V/60V/72V). */
function countConsumedOldChargersByInventoryVoltage(consumed) {
  const map = {};
  for (const snap of consumed || []) {
    let vk = snap.voltage;
    if (!VALID_OLD_CHARGER_INVENTORY_VOLTAGES.includes(vk)) {
      vk = parseVoltageForOldChargerJobcard(String(vk || ""));
    }
    if (!VALID_OLD_CHARGER_INVENTORY_VOLTAGES.includes(vk)) continue;
    map[vk] = (map[vk] || 0) + 1;
  }
  return map;
}

/** Total qty of old-charger stock sales per voltage (48V/60V/72V). */
function sumOldChargerStockSaleQtyByVoltage(parts) {
  const map = {};
  const list = parts || [];
  for (const raw of list) {
    const part =
      raw && typeof raw.toObject === "function" ? raw.toObject() : { ...raw };
    if (!isOldChargerStockSalePartPlain(part)) continue;
    const volRaw = (part.voltage || "").toString().trim();
    if (!volRaw) continue;
    const voltage = parseVoltageForOldChargerJobcard(volRaw);
    if (!VALID_OLD_CHARGER_INVENTORY_VOLTAGES.includes(voltage)) continue;
    const qty = Math.max(1, Number(part.quantity) || 1);
    map[voltage] = (map[voltage] || 0) + qty;
  }
  return map;
}

/**
 * After finalize, if user edits jobcard and reduces old-charger sale qty (or removes the line),
 * put units back into old charger stock using jobcard.consumedOldChargers snapshots (LIFO per voltage),
 * then bump summary for any gap (summary-only deductions).
 */
async function restoreOldChargerUnitsFromJobcardSnapshots(
  jobcard,
  voltage,
  count
) {
  if (!count || !jobcard) return;
  if (!jobcard.consumedOldChargers) jobcard.consumedOldChargers = [];
  const consumed = jobcard.consumedOldChargers;
  const snapshots = [];
  let i = consumed.length - 1;
  while (i >= 0 && snapshots.length < count) {
    if (consumed[i].voltage === voltage) {
      snapshots.unshift(consumed[i]);
      consumed.splice(i, 1);
    }
    i -= 1;
  }
  if (snapshots.length) {
    await OldCharger.insertMany(
      snapshots.map((snap) => oldChargerSnapshotToRow(snap))
    );
  }
  const summaryOnly = count - snapshots.length;
  if (summaryOnly > 0) {
    console.warn(
      `[jobcard] Old charger restore: re-inserted ${snapshots.length}/${count} for ${voltage}; summary +${summaryOnly} only`
    );
  }
  await adjustOldChargerSummaryDelta(voltage, count);
}

async function restoreOldChargerInventoryAfterJobcardEdit(
  existingJobcard,
  newParts
) {
  if (!existingJobcard || !existingJobcard.inventoryAdjusted) return;
  const beforeMap = sumOldChargerStockSaleQtyByVoltage(existingJobcard.parts);
  const afterMap = sumOldChargerStockSaleQtyByVoltage(newParts);
  const volts = new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)]);
  for (const voltage of volts) {
    const prev = beforeMap[voltage] || 0;
    const next = afterMap[voltage] || 0;
    if (next >= prev) continue;
    await restoreOldChargerUnitsFromJobcardSnapshots(
      existingJobcard,
      voltage,
      prev - next
    );
  }
}

// Helper: adjust main spare stock for parts on a jobcard that come from the
// spare inventory.
// - Applies to:
//   - Service parts: part.partType === "service"
//   - Sales spares: part.partType === "sales" && part.salesType === "spare"
//   - Controller/motor replacements taken from spares:
//       part.partType === "replacement" &&
//       part.replacementType in ["controller", "motor"]
// - Only parts that are NOT custom (isCustom !== true) and have a spareId
// - When mode === "deduct": subtract quantity from stock
// - When mode === "restore": add quantity back to stock
const adjustSpareInventoryForJobcard = async (jobcard, mode = "deduct") => {
  if (!jobcard || !Array.isArray(jobcard.parts) || jobcard.parts.length === 0) {
    return;
  }

  for (const part of jobcard.parts) {
    if (!part || part.isCustom === true || !part.spareId) {
      continue;
    }

    const isService = part.partType === "service";
    const isSpareSales =
      part.partType === "sales" && part.salesType === "spare";
    const isControllerOrMotorReplacement =
      part.partType === "replacement" &&
      (part.replacementType === "controller" ||
        part.replacementType === "motor");

    if (!isService && !isSpareSales && !isControllerOrMotorReplacement) {
      continue;
    }

    const qty = Math.floor(Number(part.quantity) || 0);
    if (qty <= 0) continue;

    const spare = await Spare.findById(part.spareId);
    if (!spare) continue;

    const colorKeyRaw = (part.selectedColor || "").trim();
    const useColorFifo =
      spare.hasColors === true &&
      Array.isArray(spare.colorQuantity) &&
      spare.colorQuantity.length > 0 &&
      colorKeyRaw;

    if (mode === "deduct") {
      let totalCost = 0;
      let deducted = 0;
      if (useColorFifo) {
        const first = fifoDeductFromSpare(spare, qty, {
          colorKey: colorKeyRaw,
        });
        totalCost += first.totalCost;
        deducted += first.deducted;
        if (deducted < qty) {
          const second = fifoDeductFromSpare(spare, qty - deducted, {
            colorKey: null,
          });
          totalCost += second.totalCost;
          deducted += second.deducted;
        }
      } else {
        const r = fifoDeductFromSpare(spare, qty, { colorKey: null });
        totalCost = r.totalCost;
        deducted = r.deducted;
      }
      part.fifoLinePurchaseCost = totalCost;
      if (deducted < qty) {
        console.warn(
          `[jobcard] FIFO short spare ${spare._id}: need ${qty}, deducted ${deducted}`
        );
      }
    } else {
      fifoRestoreToSpare(spare, qty, {
        colorKey: useColorFifo ? colorKeyRaw : null,
      });
    }

    await spare.save();
  }

  if (mode === "deduct" && typeof jobcard.markModified === "function") {
    jobcard.markModified("parts");
  }
};

const normalizePmcNoForMatch = (v) =>
  String(v || "")
    .trim()
    .toLowerCase()
    .replace(/^pmc-?/i, "")
    .replace(/\s+/g, "");

// Old scooty sales inventory effects:
// - Remove sold old scooty entry from old scooty section (by PMC No. match)
// - Deduct ONLY newly added spares in jobcard old scooty sale (fromOldScooty !== true)
//   because spares that came from old scooty master are already deducted there.
const adjustOldScootyInventoryForSales = async (jobcard, mode = "deduct") => {
  if (!jobcard || !Array.isArray(jobcard.parts) || jobcard.parts.length === 0) {
    return;
  }

  const oldScootyNewBatteryUnits = (part) => {
    // Lead scooty uses 4/5/6 individual batteries; lithium is treated as 1 pack.
    const chem = String(part?.batteryChemistry || "").trim().toLowerCase();
    if (chem !== "lead") return 1;
    const v = String(part?.batteryVoltage || "").trim();
    if (v === "48") return 4;
    if (v === "60") return 5;
    if (v === "72") return 6;
    return 1;
  };

  if (mode === "restore") {
    // 1) Reinsert removed old scooty rows
    const consumedRows = Array.isArray(jobcard.consumedOldScooties)
      ? jobcard.consumedOldScooties
      : [];
    for (const snap of consumedRows) {
      if (!snap || typeof snap !== "object") continue;
      const row = { ...snap };
      delete row._id; // let Mongo create new id safely
      try {
        await OldScooty.create(row);
      } catch (e) {
        console.error("[jobcard] old scooty restore create failed:", e.message);
      }
    }
    jobcard.consumedOldScooties = [];

    // 2) Restore spare stock consumed from newly added old scooty sale spares
    const consumedSpares = Array.isArray(jobcard.consumedOldScootySaleSpares)
      ? jobcard.consumedOldScootySaleSpares
      : [];
    for (const s of consumedSpares) {
      if (!s?.spareId) continue;
      const qty = Math.max(1, Number(s.quantity) || 1);
      const spare = await Spare.findById(s.spareId);
      if (!spare) continue;

      const colorKeyRaw = String(s.color || "").trim();
      const useColorFifo =
        spare.hasColors === true &&
        Array.isArray(spare.colorQuantity) &&
        spare.colorQuantity.length > 0 &&
        colorKeyRaw;

      fifoRestoreToSpare(spare, qty, {
        colorKey: useColorFifo ? colorKeyRaw.toLowerCase() : null,
      });
      syncSpareQuantityFromLayers(spare);
      if (Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0) {
        spare.markModified("stockEntries");
      }
      if (Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0) {
        spare.markModified("colorQuantity");
      }
      await spare.save();
    }
    jobcard.consumedOldScootySaleSpares = [];

    // 3) Restore new-battery and new-charger stock consumed by old-scooty sale lines.
    for (const part of jobcard.parts) {
      if (!part || part.partType !== "sales" || part.salesType !== "oldScooty") {
        continue;
      }
      if (part.batteryType === "newBattery" && part.batteryInventoryId) {
        const batteryId = String(part.batteryInventoryId);
        const battery = await Battery.findById(batteryId);
        if (battery) {
          adjustBatteryStockByUnits(battery, oldScootyNewBatteryUnits(part), "restore");
          if (
            Array.isArray(battery.stockEntries) &&
            battery.stockEntries.length > 0
          ) {
            battery.markModified("stockEntries");
          }
          await battery.save();
        }
      }
      if (part.chargerType === "newCharger" && part.chargerInventoryId) {
        const chargerId = String(part.chargerInventoryId);
        const charger = await Charger.findById(chargerId);
        if (charger) {
          adjustChargerStockByUnits(charger, 1, "restore");
          if (
            Array.isArray(charger.stockEntries) &&
            charger.stockEntries.length > 0
          ) {
            charger.markModified("stockEntries");
          }
          await charger.save();
        }
      }
    }
    return;
  }

  // mode === "deduct"
  if (!Array.isArray(jobcard.consumedOldScooties)) jobcard.consumedOldScooties = [];
  if (!Array.isArray(jobcard.consumedOldScootySaleSpares))
    jobcard.consumedOldScootySaleSpares = [];
  if (!Array.isArray(jobcard.consumedOldChargers)) jobcard.consumedOldChargers = [];

  for (const part of jobcard.parts) {
    if (!part || part.partType !== "sales" || part.salesType !== "oldScooty") {
      continue;
    }

    // A) Remove sold old scooty entry from old scooty section
    const pmcRaw = part.pmcNo || "";
    const pmcKey = normalizePmcNoForMatch(pmcRaw);
    let scooty = null;
    if (pmcKey) {
      const all = await OldScooty.find({}).lean();
      scooty = all.find(
        (row) => normalizePmcNoForMatch(row?.pmcNo || "") === pmcKey
      );
      if (scooty) {
        await OldScooty.updateOne(
          { _id: scooty._id },
          { $set: { isDeleted: true } }
        );
        console.log("[soft-delete] OldScooty (jobcard sale):", String(scooty._id));
        jobcard.consumedOldScooties.push(scooty);
      }
    }

    // B) Deduct only newly added spares in this sale line
    const saleSpares = Array.isArray(part.sparesUsed) ? part.sparesUsed : [];
    const newlyAdded = saleSpares.filter((s) => !s?.fromOldScooty);
    for (const s of newlyAdded) {
      if (!s?.spareId) continue;
      const qty = Math.max(1, Number(s.quantity) || 1);
      const spare = await Spare.findById(s.spareId);
      if (!spare) continue;

      const colorKeyRaw = String(s.color || "").trim();
      const useColorFifo =
        spare.hasColors === true &&
        Array.isArray(spare.colorQuantity) &&
        spare.colorQuantity.length > 0 &&
        colorKeyRaw;

      if (useColorFifo) {
        const first = fifoDeductFromSpare(spare, qty, {
          colorKey: colorKeyRaw.toLowerCase(),
        });
        let deducted = first.deducted;
        if (deducted < qty) {
          const second = fifoDeductFromSpare(spare, qty - deducted, {
            colorKey: null,
          });
          deducted += second.deducted;
        }
        if (deducted < qty) {
          console.warn(
            `[jobcard-oldScooty] FIFO short spare ${spare._id}: need ${qty}, deducted ${deducted}`
          );
        }
      } else {
        fifoDeductFromSpare(spare, qty, { colorKey: null });
      }

      syncSpareQuantityFromLayers(spare);
      if (Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0) {
        spare.markModified("stockEntries");
      }
      if (Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0) {
        spare.markModified("colorQuantity");
      }

      await spare.save();
      jobcard.consumedOldScootySaleSpares.push({
        spareId: s.spareId,
        quantity: qty,
        color: s.color || "",
      });
    }

    // C) Adjust NEW battery and NEW charger inventory for this old-scooty sale line.
    // We reuse the same FIFO helpers/logic as normal new battery / charger sales,
    // but scoped only to this part.

    // New battery from Battery stock
    if (
      part.batteryType === "newBattery" &&
      part.batteryInventoryId &&
      mode === "deduct"
    ) {
      const batteryId = String(part.batteryInventoryId);
      const qtyUnits = oldScootyNewBatteryUnits(part);
      const battery = await Battery.findById(batteryId);
      if (battery) {
        const r = adjustBatteryStockByUnits(battery, qtyUnits, "deduct");
        const cost = Math.max(0, Number(r.totalCost) || 0);
        part.oldScootyBatteryFifoCost = cost;
        part.fifoLinePurchaseCost = (part.fifoLinePurchaseCost || 0) + cost;
        if (
          Array.isArray(battery.stockEntries) &&
          battery.stockEntries.length > 0
        ) {
          battery.markModified("stockEntries");
        }
        await battery.save();
      }
    } else if (
      part.batteryType === "newBattery" &&
      part.batteryInventoryId &&
      mode === "restore"
    ) {
      const batteryId = String(part.batteryInventoryId);
      const battery = await Battery.findById(batteryId);
      if (battery) {
        adjustBatteryStockByUnits(battery, oldScootyNewBatteryUnits(part), "restore");
        if (
          Array.isArray(battery.stockEntries) &&
          battery.stockEntries.length > 0
        ) {
          battery.markModified("stockEntries");
        }
        await battery.save();
      }
    }

    // New charger from Charger stock
    if (
      part.chargerType === "newCharger" &&
      part.chargerInventoryId &&
      mode === "deduct"
    ) {
      const chargerId = String(part.chargerInventoryId);
      const charger = await Charger.findById(chargerId);
      if (charger) {
        const r = adjustChargerStockByUnits(charger, 1, "deduct");
        const cost = Math.max(0, Number(r.totalCost) || 0);
        part.oldScootyChargerFifoCost = cost;
        part.fifoLinePurchaseCost = (part.fifoLinePurchaseCost || 0) + cost;
        if (
          Array.isArray(charger.stockEntries) &&
          charger.stockEntries.length > 0
        ) {
          charger.markModified("stockEntries");
        }
        await charger.save();
      }
    } else if (
      part.chargerType === "newCharger" &&
      part.chargerInventoryId &&
      mode === "restore"
    ) {
      const chargerId = String(part.chargerInventoryId);
      const charger = await Charger.findById(chargerId);
      if (charger) {
        adjustChargerStockByUnits(charger, 1, "restore");
        if (
          Array.isArray(charger.stockEntries) &&
          charger.stockEntries.length > 0
        ) {
          charger.markModified("stockEntries");
        }
        await charger.save();
      }
    }

    // Old charger from OldCharger stock (working units only; FIFO by entryDate).
    if (part.chargerType === "oldCharger" && mode === "deduct") {
      const volRaw = String(part.chargerVoltage || "").trim();
      const voltage = parseVoltageForOldChargerJobcard(volRaw || "");
      const batteryType = normalizeBatteryTypeForOldCharger(part.chargerChemistry);
      if (VALID_OLD_CHARGER_INVENTORY_VOLTAGES.includes(voltage)) {
        const row = await OldCharger.findOne({
          voltage,
          batteryType,
          status: "working",
        })
          .sort({ entryDate: 1, createdAt: 1 })
          .lean();
        if (row) {
          await OldCharger.updateOne(
            { _id: row._id },
            { $set: { isDeleted: true } }
          );
          console.log("[soft-delete] OldCharger (jobcard sale):", String(row._id));
          jobcard.consumedOldChargers.push({
            voltage: row.voltage,
            batteryType: row.batteryType,
            ampere: row.ampere || "4A",
            status: row.status || "working",
            entryDate: row.entryDate ? new Date(row.entryDate) : new Date(),
            jobcardNumber: jobcard.jobcardNumber || null,
          });
          if (typeof jobcard.markModified === "function") {
            jobcard.markModified("consumedOldChargers");
          }
          await adjustOldChargerSummaryByStatusDelta(voltage, "working", -1);
        } else {
          console.warn(
            `[jobcard-oldScooty] No working old charger row for ${voltage} (${batteryType})`
          );
        }
      }
    }
  }

  // Persist any per-line fields we updated (FIFO costs, etc.)
  if (mode === "deduct" && typeof jobcard.markModified === "function") {
    jobcard.markModified("parts");
  }
};

// Helper: adjust battery inventory for replacement batteries.
// - part.partType === "replacement"
// - part.replacementType === "battery"
// - part.batteryInventoryId points to Battery document
// mode: "deduct" when applying, "restore" when rolling back (on delete)
const adjustBatteryInventoryForReplacements = async (
  jobcard,
  mode = "deduct"
) => {
  if (!jobcard || !Array.isArray(jobcard.parts) || jobcard.parts.length === 0) {
    return;
  }

  const stockMode = mode === "restore" ? "restore" : "deduct";

  for (const part of jobcard.parts) {
    if (
      !part ||
      part.partType !== "replacement" ||
      part.replacementType !== "battery"
    ) {
      continue;
    }

    const batteryId = resolveBatteryInventoryIdFromPart(part);
    if (!batteryId) {
      continue;
    }

    const qtyUnits =
      Number(
        part.selectedQuantity !== undefined && part.selectedQuantity !== null
          ? part.selectedQuantity
          : part.quantity
      ) || 0;
    if (qtyUnits <= 0) {
      continue;
    }

    const battery = await Battery.findById(batteryId);
    if (!battery) {
      continue;
    }

    if (mode === "deduct") {
      const r = adjustBatteryStockByUnits(battery, qtyUnits, stockMode);
      part.fifoLinePurchaseCost = Math.max(0, Number(r.totalCost) || 0);
    } else {
      adjustBatteryStockByUnits(battery, qtyUnits, stockMode);
    }
    if (
      Array.isArray(battery.stockEntries) &&
      battery.stockEntries.length > 0
    ) {
      battery.markModified("stockEntries");
    }
    await battery.save();
  }

  if (mode === "deduct" && typeof jobcard.markModified === "function") {
    jobcard.markModified("parts");
  }
};

// Helper: adjust battery inventory for NEW battery sales.
// - part.partType === "sales"
// - part.salesType === "battery"
// - part.batteryOldNew === "new"
// Deduct/restore individual battery units, same as replacement logic.
const adjustBatteryInventoryForNewBatterySales = async (
  jobcard,
  mode = "deduct"
) => {
  if (!jobcard || !Array.isArray(jobcard.parts) || jobcard.parts.length === 0) {
    return;
  }

  const stockMode = mode === "restore" ? "restore" : "deduct";

  for (const part of jobcard.parts) {
    if (
      !part ||
      part.partType !== "sales" ||
      part.salesType !== "battery" ||
      String(part.batteryOldNew || "").toLowerCase() !== "new"
    ) {
      continue;
    }

    const batteryId = resolveBatteryInventoryIdFromPart(part);
    if (!batteryId) continue;

    const qtyUnits =
      Number(
        part.selectedQuantity !== undefined && part.selectedQuantity !== null
          ? part.selectedQuantity
          : part.quantity
      ) || 0;
    if (qtyUnits <= 0) continue;

    const battery = await Battery.findById(batteryId);
    if (!battery) continue;

    if (mode === "deduct") {
      const r = adjustBatteryStockByUnits(battery, qtyUnits, stockMode);
      part.fifoLinePurchaseCost = Math.max(0, Number(r.totalCost) || 0);
    } else {
      adjustBatteryStockByUnits(battery, qtyUnits, stockMode);
    }
    if (
      Array.isArray(battery.stockEntries) &&
      battery.stockEntries.length > 0
    ) {
      battery.markModified("stockEntries");
    }
    await battery.save();
  }

  if (mode === "deduct" && typeof jobcard.markModified === "function") {
    jobcard.markModified("parts");
  }
};

// Helper: adjust charger inventory for replacement chargers.
// Deduct/restore charger stock (FIFO on stockEntries when present).
const adjustChargerInventoryForReplacements = async (
  jobcard,
  mode = "deduct"
) => {
  if (!jobcard || !Array.isArray(jobcard.parts) || jobcard.parts.length === 0) {
    return;
  }

  const stockMode = mode === "restore" ? "restore" : "deduct";

  for (const part of jobcard.parts) {
    if (
      !part ||
      part.partType !== "replacement" ||
      part.replacementType !== "charger"
    ) {
      continue;
    }

    const chargerId =
      part.chargerInventoryId ||
      part.chargerId ||
      part.spareId ||
      part.id ||
      null;
    if (!chargerId) continue;

    const qty =
      Number(
        part.quantity !== undefined && part.quantity !== null
          ? part.quantity
          : part.selectedQuantity
      ) || 0;
    if (qty <= 0) continue;

    const charger = await Charger.findById(chargerId);
    if (!charger) continue;

    if (mode === "deduct") {
      const r = adjustChargerStockByUnits(charger, qty, stockMode);
      part.fifoLinePurchaseCost = Math.max(0, Number(r.totalCost) || 0);
    } else {
      adjustChargerStockByUnits(charger, qty, stockMode);
    }
    if (
      Array.isArray(charger.stockEntries) &&
      charger.stockEntries.length > 0
    ) {
      charger.markModified("stockEntries");
    }
    await charger.save();
  }

  if (mode === "deduct" && typeof jobcard.markModified === "function") {
    jobcard.markModified("parts");
  }
};

// Helper: adjust charger inventory for NEW charger sales.
// - part.partType === "sales"
// - part.salesType === "charger"
// - part.chargerOldNew === "new" (or missing/other non-"old" value)
// Deduct/restore charger stock (FIFO on stockEntries when present).
const adjustChargerInventoryForNewChargerSales = async (
  jobcard,
  mode = "deduct"
) => {
  if (!jobcard || !Array.isArray(jobcard.parts) || jobcard.parts.length === 0) {
    return;
  }

  const stockMode = mode === "restore" ? "restore" : "deduct";

  for (const part of jobcard.parts) {
    if (!part || part.partType !== "sales" || part.salesType !== "charger") {
      continue;
    }
    // Old charger sales are handled by old-charger inventory logic, not Charger stock.
    if (String(part.chargerOldNew || "").toLowerCase() === "old") {
      continue;
    }

    const chargerId =
      part.chargerInventoryId ||
      part.chargerId ||
      part.spareId ||
      part.id ||
      null;
    if (!chargerId) continue;

    const qty =
      Number(
        part.selectedQuantity !== undefined && part.selectedQuantity !== null
          ? part.selectedQuantity
          : part.quantity
      ) || 0;
    if (qty <= 0) continue;

    const charger = await Charger.findById(chargerId);
    if (!charger) continue;

    if (mode === "deduct") {
      const r = adjustChargerStockByUnits(charger, qty, stockMode);
      part.fifoLinePurchaseCost = Math.max(0, Number(r.totalCost) || 0);
    } else {
      adjustChargerStockByUnits(charger, qty, stockMode);
    }
    if (
      Array.isArray(charger.stockEntries) &&
      charger.stockEntries.length > 0
    ) {
      charger.markModified("stockEntries");
    }
    await charger.save();
  }

  if (mode === "deduct" && typeof jobcard.markModified === "function") {
    jobcard.markModified("parts");
  }
};

// Helper: adjust battery scrap stock for jobcard.
// - Old battery sale: deduct sold quantity from scrap stock (FIFO across BatteryScrap entries)
// - Battery replacement (not from company): add scrap stock (one unit per replaced battery)
// - Any battery line with scrapAvailable/scrapQuantity: add scrap stock as a new entry
const adjustBatteryScrapInventoryForOldBatterySales = async (
  jobcard,
  mode = "deduct"
) => {
  if (!jobcard || !Array.isArray(jobcard.parts) || jobcard.parts.length === 0) {
    return;
  }

  const jobcardNumber = jobcard.jobcardNumber || null;
  const parseJobcardDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (typeof dateStr !== "string") return new Date(dateStr);
    const iso = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00.000Z`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  if (mode === "restore") {
    // 1) Remove entries that were added by this jobcard through scrapAvailable.
    if (jobcardNumber) {
      await BatteryScrap.updateMany(
        { jobcardNumber },
        { $set: { isDeleted: true } }
      );
      console.log("[soft-delete] BatteryScrap (jobcard restore):", jobcardNumber);
    }

    // 2) Re-add units that were consumed from existing scrap stock.
    const consumed = jobcard.consumedBatteryScraps || [];
    if (consumed.length) {
      await BatteryScrap.insertMany(
        consumed.map((snap) => ({
          quantity: Math.max(1, Number(snap.quantity) || 1),
          entryDate: snap.entryDate ? new Date(snap.entryDate) : new Date(),
        }))
      );
    }
    return;
  }

  // mode === "deduct"
  if (!jobcard.consumedBatteryScraps) jobcard.consumedBatteryScraps = [];
  const getPartQty = (part) =>
    Math.max(
      1,
      Number(
        part.quantity !== undefined && part.quantity !== null
          ? part.quantity
          : part.selectedQuantity
      ) || 1
    );
  const getOldScootyBatteryUnitCount = (part) => {
    const baseQty = getPartQty(part);
    const v = String(part?.batteryVoltage || "").trim();
    if (v === "48") return baseQty * 4;
    if (v === "60") return baseQty * 5;
    if (v === "72") return baseQty * 6;
    return baseQty;
  };
  const isBatterySalesPart = (part) =>
    part && part.partType === "sales" && part.salesType === "battery";
  const isOldScootyOldBatteryPart = (part) =>
    part &&
    part.partType === "sales" &&
    part.salesType === "oldScooty" &&
    String(part.batteryType || "").toLowerCase() === "oldbattery";
  const isBatteryReplacementPart = (part) =>
    part && part.partType === "replacement" && part.replacementType === "battery";
  const isOldBatteryLine = (part) =>
    String(part?.batteryOldNew || "").toLowerCase() === "old";

  for (const part of jobcard.parts) {
    if (!part) continue;

    // 0) Battery replacement (not from company) adds scrap stock.
    if (isBatteryReplacementPart(part)) {
      const addQty = getPartQty(part);
      if (addQty > 0) {
        await BatteryScrap.create({
          quantity: addQty,
          entryDate: parseJobcardDate(jobcard.date),
          jobcardNumber,
          source: "jobcard",
        });
      }
    }

    // 1) Old battery sale consumes scrap stock.
    //    Includes both normal battery sales (batteryOldNew === "old")
    //    and old-scooty sales where the scooter is sold with an old battery.
    const isOldBatterySaleLine =
      (isBatterySalesPart(part) && isOldBatteryLine(part)) ||
      isOldScootyOldBatteryPart(part);

    if (!isOldBatterySaleLine) {
      // Still allow scrapAvailable on non-old-battery battery lines below.
    } else {
      const soldQty = isOldScootyOldBatteryPart(part)
        ? getOldScootyBatteryUnitCount(part)
        : getPartQty(part);
      let remaining = soldQty;
      const docs = await BatteryScrap.find({})
        .sort({ entryDate: 1, createdAt: 1 })
        .select("_id quantity entryDate")
        .lean();

      for (const d of docs) {
        if (remaining <= 0) break;
        const cur = Math.max(0, Number(d.quantity) || 0);
        if (cur <= 0) continue;
        const take = Math.min(cur, remaining);
        remaining -= take;

        const left = cur - take;
        if (left <= 0) {
          await BatteryScrap.updateOne(
            { _id: d._id },
            { $set: { isDeleted: true } }
          );
          console.log("[soft-delete] BatteryScrap (consumed):", String(d._id));
        } else {
          await BatteryScrap.updateOne(
            { _id: d._id },
            { $set: { quantity: left } }
          );
        }

        jobcard.consumedBatteryScraps.push({
          quantity: take,
          entryDate: d.entryDate || new Date(),
        });
      }
      if (remaining > 0) {
        console.warn(
          `[jobcard] Battery scrap sale: requested ${soldQty}, consumed ${
            soldQty - remaining
          } (insufficient stock)`
        );
      }
    }

    // 2) If scrap is available from customer, add it as new scrap entry (sales battery lines).
    if (part.scrapAvailable) {
      const addQty = Math.max(0, Number(part.scrapQuantity) || 0);
      if (addQty > 0) {
        await BatteryScrap.create({
          quantity: addQty,
          entryDate: parseJobcardDate(jobcard.date),
          jobcardNumber,
          source: "jobcard",
        });
      }
    }
  }
};

// Helper: old charger inventory tied to jobcards.
// - Deduct: replacement charger "old arrived" + new-charger sale trade-in -> create OldCharger rows (jobcardNumber).
// - Deduct: sales chargerOldNew "old" -> remove working OldCharger rows (FIFO) + decrement summary; snapshots on jobcard for restore.
// - Restore (delete jobcard): remove rows tagged with jobcardNumber; re-insert consumed snapshots; bump summary back.
const adjustOldChargerEntriesForReplacementChargers = async (
  jobcard,
  mode = "deduct"
) => {
  if (!jobcard || !Array.isArray(jobcard.parts) || jobcard.parts.length === 0) {
    return;
  }

  const jobcardNumber = jobcard.jobcardNumber || null;

  const validVoltages = VALID_OLD_CHARGER_INVENTORY_VOLTAGES;
  const validBatteryTypes = ["lead", "lithium"];
  const validStatuses = ["working", "notWorking"];

  const parseVoltage = parseVoltageForOldChargerJobcard;

  const parseJobcardDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (typeof dateStr !== "string") return new Date(dateStr);
    const iso = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00.000Z`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const normalizeStatus = (raw) => {
    if (!raw || typeof raw !== "string") return "working";
    const s = raw.toString().trim().toLowerCase();
    if (validStatuses.includes(s)) return s;
    if (s.includes("not")) return "notWorking";
    return "working";
  };

  if (mode === "restore") {
    if (jobcardNumber) {
      const tagged = await OldCharger.find({ jobcardNumber }).lean();
      for (const row of tagged) {
        const vk = summaryKeyForVoltage(row.voltage);
        await adjustOldChargerSummaryByStatusDelta(vk, row.status, -1);
      }
      await OldCharger.updateMany(
        { jobcardNumber },
        { $set: { isDeleted: true } }
      );
      console.log("[soft-delete] OldCharger (jobcard restore):", jobcardNumber);
    }

    const consumed = jobcard.consumedOldChargers || [];
    if (consumed.length) {
      try {
        await OldCharger.insertMany(consumed.map((snap) => oldChargerSnapshotToRow(snap)));
      } catch (insErr) {
        console.error(
          "[jobcard] Old charger restore insertMany failed:",
          insErr.message
        );
        throw insErr;
      }
      const byVolt = countConsumedOldChargersByInventoryVoltage(consumed);
      for (const [vk, n] of Object.entries(byVolt)) {
        await adjustOldChargerSummaryDelta(vk, n);
      }
    }

    // Stock sale may have decreased summary only (no rows / no snapshots). Restore that gap.
    const plainPartsRestore = Array.isArray(jobcard.parts)
      ? jobcard.parts.map((p) =>
          p && typeof p.toObject === "function" ? p.toObject() : { ...p }
        )
      : [];
    const soldMap = sumOldChargerStockSaleQtyByVoltage(plainPartsRestore);
    const reinsertedByVolt =
      countConsumedOldChargersByInventoryVoltage(consumed);
    for (const voltage of Object.keys(soldMap)) {
      const sold = soldMap[voltage] || 0;
      const fromSnapshots = reinsertedByVolt[voltage] || 0;
      const summaryOnlyGap = sold - fromSnapshots;
      if (summaryOnlyGap > 0) {
        await adjustOldChargerSummaryDelta(voltage, summaryOnlyGap);
      }
    }
    return;
  }

  // mode === "deduct"

  const plainParts = jobcard.parts.map((p) =>
    p && typeof p.toObject === "function" ? p.toObject() : { ...p }
  );

  // 0) Sell old charger from stock: remove working units + summary.
  // Match by voltage only (summary/UI counts working per voltage, not per battery chemistry).
  for (const part of plainParts) {
    if (!isOldChargerStockSalePartPlain(part)) continue;

    const qty = Math.max(1, Number(part.quantity) || 1);
    const volRaw = (part.voltage || "").toString().trim();
    if (!volRaw) {
      console.warn(
        "[jobcard] Old charger sale line skipped: missing voltage on part",
        part.spareName
      );
      continue;
    }

    const voltage = parseVoltage(volRaw);
    if (!validVoltages.includes(voltage)) continue;

    const docs = await OldCharger.find({
      voltage,
      status: { $regex: /^working$/i },
    })
      .sort({ entryDate: 1, createdAt: 1 })
      .limit(qty)
      .lean();

    if (docs.length) {
      await OldCharger.updateMany(
        { _id: { $in: docs.map((d) => d._id) } },
        { $set: { isDeleted: true } }
      );
      console.log(
        "[soft-delete] OldCharger (stock sale consumed):",
        docs.length
      );

      if (!jobcard.consumedOldChargers) jobcard.consumedOldChargers = [];
      for (const d of docs) {
        jobcard.consumedOldChargers.push({
          voltage: d.voltage,
          batteryType: d.batteryType,
          ampere: d.ampere,
          status: d.status,
          entryDate: d.entryDate,
          jobcardNumber: d.jobcardNumber || null,
        });
      }

      await adjustOldChargerSummaryDelta(voltage, -docs.length);
    } else {
      const sumDoc = await OldChargerSummary.findOne({ id: "default" }).lean();
      const s = sumDoc?.summary?.[voltage] || { working: 0, total: 0 };
      const w = Math.max(0, Number(s.working) || 0);
      const dec = Math.min(qty, w);
      if (dec > 0) {
        await adjustOldChargerSummaryDelta(voltage, -dec);
        console.warn(
          `[jobcard] Old charger sale: no OldCharger rows for ${voltage}; decreased summary working by ${dec} only`
        );
      } else {
        console.warn(
          `[jobcard] Old charger sale: no rows and no summary working for ${voltage} (qty ${qty})`
        );
      }
    }
  }

  if (!jobcardNumber) return;

  // 1) Replacement charger parts: old charger arrived -> add stock
  for (const part of jobcard.parts) {
    if (
      !part ||
      part.partType !== "replacement" ||
      part.replacementType !== "charger"
    ) {
      continue;
    }

    const hasOldChargerArrived =
      (part.oldChargerName && String(part.oldChargerName).trim()) ||
      (part.oldChargerVoltage && String(part.oldChargerVoltage).trim());
    if (!hasOldChargerArrived) continue;

    const voltage = parseVoltage(part.oldChargerVoltage || part.voltage);
    if (!validVoltages.includes(voltage)) continue;

    let batteryType = (part.batteryType || "lead")
      .toString()
      .trim()
      .toLowerCase();
    if (!validBatteryTypes.includes(batteryType)) batteryType = "lead";

    const ampere = "4A";
    const statusNorm = normalizeStatus(part.oldChargerWorking);
    const entryDate = parseJobcardDate(jobcard.date);

    const oldCharger = new OldCharger({
      voltage,
      batteryType,
      ampere,
      status: statusNorm,
      entryDate,
      jobcardNumber,
      source: "jobcard",
    });
    await oldCharger.save();
    await adjustOldChargerSummaryByStatusDelta(voltage, statusNorm, 1);
  }

  // 2) New charger sale with customer old charger trade-in -> add stock (one row per unit sold, same as before)
  for (const part of jobcard.parts) {
    if (!part || part.partType !== "sales" || part.salesType !== "charger") {
      continue;
    }
    if (!part.oldChargerAvailable) continue;

    const volRaw = (part.oldChargerVoltage || part.voltage || "")
      .toString()
      .trim();
    if (!volRaw) continue;

    const voltage = parseVoltage(volRaw);
    if (!validVoltages.includes(voltage)) continue;

    let batteryType = (part.batteryType || "lead")
      .toString()
      .trim()
      .toLowerCase();
    if (!validBatteryTypes.includes(batteryType)) batteryType = "lead";

    const ampere = "4A";
    const statusNorm = normalizeStatus(part.oldChargerWorking);
    const entryDate = parseJobcardDate(jobcard.date);
    const tradeQty = Math.max(1, Number(part.quantity) || 1);

    for (let i = 0; i < tradeQty; i++) {
      const oldCharger = new OldCharger({
        voltage,
        batteryType,
        ampere,
        status: statusNorm,
        entryDate,
        jobcardNumber,
        source: "jobcard",
      });
      await oldCharger.save();
      await adjustOldChargerSummaryByStatusDelta(voltage, statusNorm, 1);
    }
  }
};

// Always use latest parts from DB (avoids stale in-memory doc missing sales fields).
const refreshJobcardPartsFromDb = async (jobcard) => {
  if (!jobcard?._id) return;
  const latest = await Jobcard.findById(jobcard._id).select("parts");
  if (latest && Array.isArray(latest.parts)) {
    jobcard.parts = latest.parts;
  }
};

// Run stock deductions once (finalize and/or first settle must both trigger this).
const applyJobcardInventoryDeductionOnce = async (jobcard) => {
  if (!jobcard || jobcard.inventoryAdjusted) return;
  await refreshJobcardPartsFromDb(jobcard);
  await adjustSpareInventoryForJobcard(jobcard, "deduct");
  await adjustBatteryInventoryForReplacements(jobcard, "deduct");
  await adjustBatteryInventoryForNewBatterySales(jobcard, "deduct");
  await adjustChargerInventoryForReplacements(jobcard, "deduct");
  await adjustChargerInventoryForNewChargerSales(jobcard, "deduct");
  await adjustOldScootyInventoryForSales(jobcard, "deduct");
  await adjustBatteryScrapInventoryForOldBatterySales(jobcard, "deduct");
  await adjustOldChargerEntriesForReplacementChargers(jobcard, "deduct");
  jobcard.inventoryAdjusted = true;
};

// @desc    Create a new jobcard
// @route   POST /api/jobcards
// @access  Public (add auth later)
const createJobcard = async (req, res) => {
  try {
    const jobcardData = req.body;

    // Calculate total amount from parts, excluding replacement parts from billing
    // (only service + sales parts should contribute to the bill)
    const totalAmount = Array.isArray(jobcardData.parts)
      ? jobcardData.parts.reduce((sum, part) => {
          if (part.partType === "replacement" || part.replacementType) {
            return sum;
          }
          return sum + (part.price || 0) * (part.quantity || 1);
        }, 0)
      : 0;

    const jobcard = new Jobcard({
      ...jobcardData,
      totalAmount,
      status: "pending", // Always create as pending
    });

    const createdJobcard = await jobcard.save();
    res.status(201).json(createdJobcard);
  } catch (error) {
    console.error("Error creating jobcard:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    List Jobcards (optional query: status, jobcardType, updatedSince for incremental sync)
// @route   GET /api/jobcards
// @access  Public
const getJobcards = async (req, res) => {
  try {
    const { status, jobcardType, updatedSince } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (jobcardType) {
      // Match jobcards where jobcardType contains the filter (handles "service, replacement" etc.)
      const escaped = String(jobcardType).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      filter.jobcardType = new RegExp(`\\b${escaped}\\b`, "i");
    }

    if (updatedSince !== undefined && updatedSince !== "") {
      const since = new Date(String(updatedSince));
      if (Number.isNaN(since.getTime())) {
        return res.status(400).json({
          message: "Invalid updatedSince; use an ISO 8601 date string",
        });
      }
      filter.updatedAt = { $gte: since };
    }

    const jobcards = await Jobcard.find(filter)
      .sort({ createdAt: -1 })
      .populate("parts.spareId", "name sku");

    res.json(jobcards);
  } catch (error) {
    console.error("Error getting jobcards:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get jobcard by ID
// @route   GET /api/jobcards/:id
// @access  Public
const getJobcardById = async (req, res) => {
  try {
    const jobcard = await Jobcard.findById(req.params.id).populate(
      "parts.spareId",
      "name sku price quantity hasColors colorQuantity"
    );

    if (!jobcard) {
      return res.status(404).json({ message: "Jobcard not found" });
    }

    res.json(jobcard);
  } catch (error) {
    console.error("Error getting jobcard:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update jobcard
// @route   PUT /api/jobcards/:id
// @access  Public
const updateJobcard = async (req, res) => {
  try {
    const jobcardData = req.body;

    const existing = await Jobcard.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Jobcard not found" });
    }

    // Calculate total amount from parts if parts are provided
    // Exclude replacement parts from billing total (only service + sales count)
    if (Array.isArray(jobcardData.parts)) {
      jobcardData.totalAmount = jobcardData.parts.reduce((sum, part) => {
        if (part.partType === "replacement" || part.replacementType) {
          return sum;
        }
        return sum + (part.price || 0) * (part.quantity || 1);
      }, 0);

      // If stock was already deducted on finalize/settle, lowering old-charger sale qty restores stock.
      if (existing.inventoryAdjusted) {
        await restoreOldChargerInventoryAfterJobcardEdit(
          existing,
          jobcardData.parts
        );
        jobcardData.consumedOldChargers = existing.consumedOldChargers;
      }
    }

    const jobcard = await Jobcard.findByIdAndUpdate(
      req.params.id,
      jobcardData,
      { new: true, runValidators: true }
    ).populate("parts.spareId", "name sku");

    if (!jobcard) {
      return res.status(404).json({ message: "Jobcard not found" });
    }

    res.json(jobcard);
  } catch (error) {
    console.error("Error updating jobcard:", error);
    // Return more specific error message
    const errorMessage = error.message || "Unknown error occurred";
    res.status(500).json({
      message: "Server error",
      error: errorMessage,
      details: error.name === "ValidationError" ? error.errors : undefined,
    });
  }
};

// @desc    Finalize jobcard (move from pending to finalized)
// @route   PUT /api/jobcards/:id/finalize
// @access  Public
const finalizeJobcard = async (req, res) => {
  try {
    const {
      labour,
      discount,
      paidAmount,
      totalAmount,
      paymentMode,
      pendingAmount,
      forceFinalize,
      paymentDate,
    } = req.body;
    const jobcard = await Jobcard.findById(req.params.id);

    if (!jobcard) {
      return res.status(404).json({ message: "Jobcard not found" });
    }

    if (jobcard.status === "finalized") {
      return res.status(400).json({ message: "Jobcard is already finalized" });
    }

    // Update jobcard with finalization data
    if (labour !== undefined) jobcard.labour = labour || 0;
    if (discount !== undefined) jobcard.discount = discount || 0;
    // Always recompute totalAmount from parts + labour - discount (ignore client drift).
    // Client may send totalAmount, but we treat it as informational.
    if (paymentMode !== undefined) jobcard.paymentMode = paymentMode || "cash";

    // Save initial payment to payment history if paidAmount is provided.
    // NOTE: For force-finalize we must NOT add a new payment entry, otherwise it duplicates totals.
    if (forceFinalize !== true && paidAmount !== undefined && paidAmount > 0) {
      // Initialize payment history if it doesn't exist
      if (!jobcard.paymentHistory || jobcard.paymentHistory.length === 0) {
        jobcard.paymentHistory = [];
      }

      // Determine the payment date string (dd/mm/yyyy).
      // Prefer the date sent from the frontend; if not provided, use today's date.
      let paymentDateString;
      if (paymentDate) {
        // If already in dd/mm/yyyy, use as is
        if (typeof paymentDate === "string" && paymentDate.includes("/")) {
          paymentDateString = paymentDate;
        } else {
          const d = new Date(paymentDate);
          const day = String(d.getDate()).padStart(2, "0");
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const year = d.getFullYear();
          paymentDateString = `${day}/${month}/${year}`;
        }
      } else {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();
        paymentDateString = `${day}/${month}/${year}`;
      }

      // Get current time in HH:mm AM/PM format
      const now = new Date();
      const paymentTime = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Check if this payment already exists in history (to avoid duplicates)
      const paymentExists = jobcard.paymentHistory.some(
        (p) =>
          p.amount === paidAmount &&
          p.date === paymentDateString &&
          p.paymentMode === (paymentMode || "cash")
      );
      // Add initial payment to history if it doesn't exist
      if (!paymentExists) {
        jobcard.paymentHistory.push({
          amount: paidAmount,
          date: paymentDateString,
          time: paymentTime,
          paymentMode: paymentMode || "cash",
        });
      }
      // Update paidAmount to match total in payment history
      const totalPaid = jobcard.paymentHistory.reduce(
        (sum, payment) => sum + (payment.amount || 0),
        0
      );
      jobcard.paidAmount = totalPaid;
    }

    const calculateBillTotalFromJobcard = (jc) => {
      const parts = Array.isArray(jc?.parts) ? jc.parts : [];
      const partsTotal = parts.reduce((sum, part) => {
        if (!part) return sum;
        if (part.partType === "replacement" || part.replacementType) return sum;
        const qty = Number(part.quantity) || 1;
        const price = Number(part.price) || 0;
        return sum + price * qty;
      }, 0);
      const labour = Number(jc?.labour) || 0;
      const discount = Number(jc?.discount) || 0;
      return Math.max(0, partsTotal + labour - discount);
    };

    jobcard.totalAmount = calculateBillTotalFromJobcard(jobcard);

    // Always derive pending amount from bill total - total paid.
    // This prevents drift if older records or frontend sent incorrect pendingAmount.
    const totalPaidNow = jobcard.paymentHistory?.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    ) || jobcard.paidAmount || 0;
    jobcard.pendingAmount = Math.max(
      0,
      (Number(jobcard.totalAmount) || 0) - totalPaidNow
    );

    // Force finalize: mark finalized and clear pending (Option B).
    if (forceFinalize === true) {
      jobcard.pendingAmount = 0;
      jobcard.status = "finalized";
    }

    // Adjust inventory once, the first time this jobcard is finalized/saved.
    // This applies even if the jobcard remains in "pending" status due to unpaid amount.
    await applyJobcardInventoryDeductionOnce(jobcard);

    // Only mark as finalized if there's no pending amount.
    // If pendingAmount > 0, keep status as "pending".
    if (jobcard.pendingAmount === 0) {
      jobcard.status = "finalized";
    }
    // Otherwise, keep status as "pending" (already pending, so no change needed)

    const savedJobcard = await jobcard.save();

    res.json(savedJobcard);
  } catch (error) {
    console.error("Error finalizing jobcard:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Settle payment for jobcard
// @route   PUT /api/jobcards/:id/settle
// @access  Public
const settleJobcard = async (req, res) => {
  try {
    const { amount, paymentMode, paymentDate } = req.body;
    const jobcard = await Jobcard.findById(req.params.id);

    if (!jobcard) {
      return res.status(404).json({ message: "Jobcard not found" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid payment amount" });
    }

    const calculateBillTotalFromJobcard = (jc) => {
      const parts = Array.isArray(jc?.parts) ? jc.parts : [];
      const partsTotal = parts.reduce((sum, part) => {
        if (!part) return sum;
        if (part.partType === "replacement" || part.replacementType) return sum;
        const qty = Number(part.quantity) || 1;
        const price = Number(part.price) || 0;
        return sum + price * qty;
      }, 0);
      const labour = Number(jc?.labour) || 0;
      const discount = Number(jc?.discount) || 0;
      return Math.max(0, partsTotal + labour - discount);
    };

    const totalPaidBefore =
      jobcard.paymentHistory?.reduce(
        (sum, payment) => sum + (payment.amount || 0),
        0
      ) || jobcard.paidAmount || 0;
    const billTotal = calculateBillTotalFromJobcard(jobcard);
    const currentPending = Math.max(0, billTotal - totalPaidBefore);
    if (amount > currentPending) {
      return res.status(400).json({
        message: `Payment amount (₹${amount}) cannot exceed pending amount (₹${currentPending})`,
      });
    }

    // Initialize payment history if it doesn't exist
    if (!jobcard.paymentHistory) {
      jobcard.paymentHistory = [];
      // If there's an initial paidAmount, add it to history
      if (jobcard.paidAmount && jobcard.paidAmount > 0) {
        const initialTime = new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        jobcard.paymentHistory.push({
          amount: jobcard.paidAmount,
          date: jobcard.date || new Date().toISOString().split("T")[0],
          time: initialTime,
          paymentMode: jobcard.paymentMode || "cash",
        });
      }
    }

    // Get current time in HH:mm AM/PM format
    const now = new Date();
    const paymentTime = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Format payment date
    let paymentDateString;
    if (paymentDate) {
      // If already in dd/mm/yyyy, use as is
      if (typeof paymentDate === "string" && paymentDate.includes("/")) {
        paymentDateString = paymentDate;
      } else {
        const d = new Date(paymentDate);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        paymentDateString = `${day}/${month}/${year}`;
      }
    } else {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, "0");
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const year = today.getFullYear();
      paymentDateString = `${day}/${month}/${year}`;
    }

    // Add new payment to history
    jobcard.paymentHistory.push({
      amount: amount,
      date: paymentDateString,
      time: paymentTime,
      paymentMode: paymentMode || "cash",
    });

    // Update total paid amount
    const totalPaid = jobcard.paymentHistory.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    );
    jobcard.paidAmount = totalPaid;

    // Update pending amount (always derived)
    // Also persist totalAmount as the true bill total so future reads are consistent.
    jobcard.totalAmount = billTotal;
    jobcard.pendingAmount = Math.max(0, billTotal - totalPaid);

    // If pending amount is now 0, finalize the jobcard
    if (jobcard.pendingAmount === 0) {
      jobcard.status = "finalized";
    }

    // Same as /finalize: many users only record payments via /settle and never hit finalize.
    await applyJobcardInventoryDeductionOnce(jobcard);

    const savedJobcard = await jobcard.save();

    res.json(savedJobcard);
  } catch (error) {
    console.error("Error settling payment:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete jobcard
// @route   DELETE /api/jobcards/:id
// @access  Public
const deleteJobcard = async (req, res) => {
  try {
    const jobcard = await Jobcard.findById(req.params.id);

    if (!jobcard) {
      return res.status(404).json({ message: "Jobcard not found" });
    }

    // If inventory was previously adjusted for this jobcard, restore stock.
    if (jobcard.inventoryAdjusted) {
      try {
        await refreshJobcardPartsFromDb(jobcard);
        await adjustSpareInventoryForJobcard(jobcard, "restore");
        await adjustBatteryInventoryForReplacements(jobcard, "restore");
        await adjustBatteryInventoryForNewBatterySales(jobcard, "restore");
        await adjustChargerInventoryForReplacements(jobcard, "restore");
        await adjustChargerInventoryForNewChargerSales(jobcard, "restore");
        await adjustOldScootyInventoryForSales(jobcard, "restore");
        await adjustBatteryScrapInventoryForOldBatterySales(jobcard, "restore");
        await adjustOldChargerEntriesForReplacementChargers(jobcard, "restore");
        jobcard.inventoryAdjusted = false;
      } catch (invErr) {
        console.error(
          "Error restoring inventory while deleting jobcard:",
          invErr
        );
        // Continue with delete even if inventory restore fails
      }
    }

    await Jobcard.updateOne(
      { _id: req.params.id },
      { $set: { isDeleted: true, inventoryAdjusted: false } }
    );
    console.log("[soft-delete] Jobcard:", req.params.id);
    res.json({ message: "Jobcard soft deleted successfully" });
  } catch (error) {
    console.error("Error deleting jobcard:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update Jobcard.lastSyncedAt after successful cloud sync
// @route   PATCH /api/jobcards/:id/synced
// @access  Public (add auth later)
const markJobcardSynced = async (req, res) => {
  try {
    const { lastSyncedAt } = req.body || {};
    const ts =
      lastSyncedAt != null && String(lastSyncedAt).trim() !== ""
        ? new Date(lastSyncedAt)
        : new Date();
    if (Number.isNaN(ts.getTime())) {
      return res.status(400).json({ message: "Invalid lastSyncedAt date" });
    }

    const jobcard = await Jobcard.findByIdAndUpdate(
      req.params.id,
      { lastSyncedAt: ts },
      { new: true, runValidators: true }
    ).populate("parts.spareId", "name sku");

    if (!jobcard) {
      return res.status(404).json({ message: "Jobcard not found" });
    }

    res.json(jobcard);
  } catch (error) {
    console.error("Error updating Jobcard lastSyncedAt:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createJobcard,
  getJobcards,
  getJobcardById,
  updateJobcard,
  finalizeJobcard,
  settleJobcard,
  deleteJobcard,
  markJobcardSynced,
};
