const Bill = require("../models/Bill");
const Model = require("../models/Model");
const Battery = require("../models/Battery");
const Charger = require("../models/Charger");
const Spare = require("../models/Spare");
const OldScooty = require("../models/OldScooty");
const BatteryScrap = require("../models/BatteryScrap");
const OldCharger = require("../models/OldCharger");
const mongoose = require("mongoose");
const {
  fifoDeductFromSpare,
  fifoRestoreToSpare,
} = require("../utils/spareFifo");
const { adjustChargerStockByUnits } = require("../utils/chargerInventoryAdjust");
const { adjustBatteryStockByUnits } = require("../utils/batteryInventoryAdjust");
const {
  adjustOldChargerSummaryByStatusDelta,
} = require("../utils/oldChargerSummaryAdjust");

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v || ""));

const getLeadBatteryUnitsFromVoltage = (voltageRaw) => {
  const s = String(voltageRaw || "").toUpperCase();
  if (s.includes("72")) return 6;
  if (s.includes("60")) return 5;
  if (s.includes("48")) return 4;
  return 0;
};

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
  const s = String(raw || "").trim().toLowerCase();
  if (s === "notworking" || s.includes("not")) return "notWorking";
  return "working";
};

async function removeOldScootyLinkedToBill(bill) {
  const oldScootyId = String(bill?.oldScootyId || "").trim();
  if (!oldScootyId || !isObjectId(oldScootyId)) return;

  await BatteryScrap.deleteMany({ oldScootyId });

  const prevChargers = await OldCharger.find({ oldScootyId }).lean();
  if (prevChargers.length) {
    for (const row of prevChargers) {
      await adjustOldChargerSummaryByStatusDelta(row.voltage, row.status, -1);
    }
    await OldCharger.deleteMany({ oldScootyId });
  }

  await OldScooty.deleteOne({ _id: oldScootyId });
}

async function upsertOldScootyFromBill(bill, body) {
  if (!bill) return;
  const hasOldScooty =
    body?.oldScootyAvailable === "yes" ||
    Boolean(body?.oldScootyExchange?.trim()) ||
    (Number(body?.oldScootyExchangePrice) || 0) > 0 ||
    Boolean(body?.oldScootyPmcNo?.trim());
  if (!hasOldScooty) {
    await removeOldScootyLinkedToBill(bill);
    bill.oldScootyId = "";
    return;
  }

  const pmcNo = String(body.oldScootyPmcNo || "").trim();
  const withBattery = String(body.oldScootyWithBattery || "no") === "yes";
  const batteryType = normalizeBatteryType(body.oldScootyBatteryType);
  const batteryCount = withBattery
    ? Math.max(0, Number(body.oldScootyBatteryCount) || 0)
    : 0;
  const withCharger = String(body.oldScootyWithCharger || "no") === "yes";
  const chargerType = normalizeBatteryType(body.oldScootyChargerType);
  const chargerWorking = normalizeWorkingStatus(body.oldScootyChargerWorking);
  const chargerVoltageAmpereRaw = withCharger
    ? String(body.oldScootyChargerVoltageAmpere || "").trim()
    : "";

  const entryDate = bill.billDate ? new Date(`${bill.billDate}T12:00:00.000Z`) : new Date();

  let doc = null;
  const existingId = String(bill.oldScootyId || "").trim();
  if (existingId && isObjectId(existingId)) {
    doc = await OldScooty.findById(existingId);
  }
  if (!doc) {
    doc = new OldScooty({
      name: "Old scooty exchange",
      pmcNo,
      purchasePrice: Math.max(0, Number(bill.oldScootyExchangePrice) || 0),
      withBattery,
      batteryType: withBattery ? batteryType : "",
      batteryCount,
      withCharger,
      chargerVoltageAmpere: chargerVoltageAmpereRaw,
      chargerType: withCharger ? chargerType : "",
      chargerWorking,
      entryDate,
      status: "not-ready",
      sparesUsed: [],
    });
  } else {
    doc.pmcNo = pmcNo;
    doc.purchasePrice = Math.max(0, Number(bill.oldScootyExchangePrice) || 0);
    doc.withBattery = withBattery;
    doc.batteryType = withBattery ? batteryType : "";
    doc.batteryCount = batteryCount;
    doc.withCharger = withCharger;
    doc.chargerVoltageAmpere = chargerVoltageAmpereRaw;
    doc.chargerType = withCharger ? chargerType : "";
    doc.chargerWorking = chargerWorking;
    doc.entryDate = entryDate;
  }

  const saved = await doc.save();
  bill.oldScootyId = String(saved._id);

  // Idempotent: replace linked scrap + old-charger rows based on this old scooty.
  await BatteryScrap.deleteMany({ oldScootyId: saved._id });
  const prevChargers = await OldCharger.find({ oldScootyId: saved._id }).lean();
  if (prevChargers.length) {
    for (const row of prevChargers) {
      await adjustOldChargerSummaryByStatusDelta(row.voltage, row.status, -1);
    }
    await OldCharger.deleteMany({ oldScootyId: saved._id });
  }

  if (withBattery && batteryCount > 0) {
    await BatteryScrap.create({
      quantity: Math.max(1, Number(batteryCount) || 1),
      entryDate,
      oldScootyId: saved._id,
      source: "oldScooty",
    });
  }
  if (withCharger) {
    const voltage = parseOldChargerVoltage(chargerVoltageAmpereRaw);
    if (voltage) {
      const row = new OldCharger({
        voltage,
        batteryType: chargerType,
        ampere: parseOldChargerAmpere(chargerVoltageAmpereRaw),
        status: chargerWorking,
        entryDate,
        oldScootyId: saved._id,
        source: "oldScooty",
      });
      await row.save();
      await adjustOldChargerSummaryByStatusDelta(voltage, chargerWorking, 1);
    }
  }
}

const adjustBillInventory = async (billLike, mode = "deduct") => {
  if (!billLike) return;
  const factor = mode === "restore" ? 1 : -1;

  // 1) Model stock (one scooty per bill)
  let modelDoc = null;
  const modelId = String(billLike.modelId || "").trim();
  if (isObjectId(modelId)) {
    modelDoc = await Model.findById(modelId);
  }
  if (!modelDoc && billLike.modelPurchased) {
    modelDoc = await Model.findOne({ modelName: billLike.modelPurchased });
  }
  if (modelDoc) {
    const colorKey = String(billLike.modelColor || "")
      .trim()
      .toLowerCase();
    if (Array.isArray(modelDoc.colorQuantities) && colorKey) {
      const colorEntry = modelDoc.colorQuantities.find(
        (cq) =>
          cq &&
          typeof cq.color === "string" &&
          cq.color.trim().toLowerCase() === colorKey
      );
      if (colorEntry) {
        colorEntry.quantity = Math.max(
          0,
          (Number(colorEntry.quantity) || 0) + factor * 1
        );
      }
    }
    // Keep stockEntries aligned so Model pre-save quantity recalculation remains correct.
    if (Array.isArray(modelDoc.stockEntries) && modelDoc.stockEntries.length > 0 && colorKey) {
      for (const entry of modelDoc.stockEntries) {
        if (!Array.isArray(entry.colorQuantities)) continue;
        const cq = entry.colorQuantities.find(
          (x) =>
            x &&
            typeof x.color === "string" &&
            x.color.trim().toLowerCase() === colorKey
        );
        if (cq) {
          cq.quantity = Math.max(0, (Number(cq.quantity) || 0) + factor * 1);
          break;
        }
      }
    }
    modelDoc.quantity = Math.max(
      0,
      (Number(modelDoc.quantity) || 0) + factor * 1
    );
    await modelDoc.save();
  }

  const resolveId = (v) => {
    if (!v) return "";
    if (typeof v === "object" && v._id != null) return String(v._id);
    return String(v);
  };

  // 2) Battery stock
  const batteryId = resolveId(billLike.batteryId).trim();
  if (billLike.withBattery && isObjectId(batteryId)) {
    const battery = await Battery.findById(batteryId);
    if (battery) {
      const type = String(billLike.batteryTypeForBill || "").toLowerCase();
      const units =
        type === "lead"
          ? getLeadBatteryUnitsFromVoltage(billLike.batteryVoltageForBill)
          : 1;
      if (units > 0) {
        const stockMode = mode === "deduct" ? "deduct" : "restore";
        adjustBatteryStockByUnits(battery, units, stockMode);
        if (
          Array.isArray(battery.stockEntries) &&
          battery.stockEntries.length > 0
        ) {
          battery.markModified("stockEntries");
        }
        await battery.save();
      }
    } else {
      console.warn(`[bill] batteryId not found: ${batteryId}`);
    }
  } else if (billLike.withBattery && batteryId) {
    console.warn(`[bill] skipping battery adjust: invalid batteryId "${batteryId}"`);
  }

  // 3) Charger stock (one charger per bill)
  const chargerId = resolveId(billLike.chargerId).trim();
  let chargerDoc = null;
  if (billLike.withCharger && isObjectId(chargerId)) {
    chargerDoc = await Charger.findById(chargerId);
  }
  if (
    billLike.withCharger &&
    !chargerDoc &&
    billLike.chargerName &&
    String(billLike.chargerName).trim() &&
    String(billLike.chargerName).trim().toLowerCase() !== "custom"
  ) {
    const name = String(billLike.chargerName).trim();
    const volt = String(billLike.chargerVoltageForBill || "").trim();
    chargerDoc = await Charger.findOne({
      name,
      ...(volt ? { voltage: volt } : {}),
    });
  }
  if (billLike.withCharger && chargerDoc) {
    const stockMode = mode === "deduct" ? "deduct" : "restore";
    adjustChargerStockByUnits(chargerDoc, 1, stockMode);
    if (
      Array.isArray(chargerDoc.stockEntries) &&
      chargerDoc.stockEntries.length > 0
    ) {
      chargerDoc.markModified("stockEntries");
    }
    await chargerDoc.save();
  } else if (billLike.withCharger) {
    console.warn(
      `[bill] skipping charger adjust: charger not resolved (chargerId="${chargerId}", name="${String(
        billLike.chargerName || ""
      )}")`
    );
  }

  // 4) Accessory spare stock — one unit per accessory line, FIFO by purchase date.
  // Bills do not specify color; FIFO runs across all colorQuantity layers when used.
  if (Array.isArray(billLike.accessoryDetails) && billLike.accessoryDetails.length > 0) {
    for (const item of billLike.accessoryDetails) {
      const spareId = String(item?.id || "").trim();
      if (!isObjectId(spareId)) continue;
      const spare = await Spare.findById(spareId);
      if (!spare) continue;
      if (mode === "deduct") {
        const { totalCost, deducted } = fifoDeductFromSpare(spare, 1, {
          colorKey: null,
        });
        item.unitPurchaseCost = deducted > 0 ? totalCost : 0;
      } else {
        fifoRestoreToSpare(spare, 1, { colorKey: null });
      }
      await spare.save();
    }
    if (typeof billLike.markModified === "function") {
      billLike.markModified("accessoryDetails");
    }
  }
};

const getBills = async (req, res) => {
  try {
    const bills = await Bill.find({}).sort({ createdAt: -1 });
    res.json(bills);
  } catch (error) {
    console.error("Error getting bills:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    res.json(bill);
  } catch (error) {
    console.error("Error getting bill:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const createBill = async (req, res) => {
  try {
    const body = req.body;
    const sellingPrice = Number(body.sellingPrice) || 0;
    const paidAmount = Number(body.paidAmount) || 0;
    const pendingAmountFromBody =
      body.pendingAmount !== undefined ? Number(body.pendingAmount) || 0 : 0;
    const oldScootyPrice = Number(body.oldScootyExchangePrice) || 0;
    const netAmountFromBody =
      body.netAmount !== undefined
        ? Number(body.netAmount) || 0
        : paidAmount + pendingAmountFromBody - oldScootyPrice;
    const netAmount =
      netAmountFromBody ||
      paidAmount + pendingAmountFromBody - oldScootyPrice;
    const discount =
      body.discount !== undefined
        ? Number(body.discount) || 0
        : Math.max(0, sellingPrice - netAmount);
    const pendingAmount =
      body.pendingAmount !== undefined
        ? pendingAmountFromBody
        : Math.max(0, netAmount - paidAmount - oldScootyPrice);

    const sanitizedServices = Array.isArray(body.services)
      ? body.services
          .slice(0, 3)
          .map((s) => ({
            serviceNumber: (s?.serviceNumber ?? s?.serviceNo ?? "").toString().trim(),
            date: (s?.date ?? "").toString().trim(),
          }))
          .filter((s) => s.date)
      : [];

    const bill = new Bill({
      modelId: body.modelId || "",
      billNo: body.billNo || "",
      billDate: body.billDate || "",
      customerName: body.customerName || "",
      mobile: body.mobile || "",
      address: body.address || "",
      modelPurchased: body.modelPurchased || "",
      descriptionVariant: body.descriptionVariant || "",
      modelColor: body.modelColor || "",
      sellingPrice,
      discount,
      netAmount,
      paidAmount,
      pendingAmount,
      paymentMode: body.paymentMode || "cash",
      paymentHistory: Array.isArray(body.paymentHistory) ? body.paymentHistory : paidAmount > 0 ? [{ amount: paidAmount, date: body.billDate || new Date().toISOString().split("T")[0], time: "", paymentMode: body.paymentMode || "cash" }] : [],
      bankDetail: body.bankDetail || "",
      warranty: body.warranty || "None",
      withBattery: body.withBattery !== false,
      withCharger: body.withCharger !== false,
      batteryId: body.batteryId || "",
      batteryName: body.batteryName || "",
      batteryTypeForBill: body.batteryTypeForBill || "",
      batteryVoltageForBill: body.batteryVoltageForBill || "",
      batteryNumbersForBill: body.batteryNumbersForBill || "",
      chargerId: body.chargerId || "",
      chargerName: body.chargerName || "",
      chargerTypeForBill: body.chargerTypeForBill || "",
      chargerVoltageForBill: body.chargerVoltageForBill || "",
      accessoryIncluded: body.accessoryIncluded || "",
      accessoryDetails: Array.isArray(body.accessoryDetails) ? body.accessoryDetails : [],
      oldScootyExchange: body.oldScootyExchange || "",
      oldScootyExchangePrice: Number(body.oldScootyExchangePrice) || 0,
      services: sanitizedServices,
      oldScootyPmcNo: body.oldScootyPmcNo || "",
      oldScootyWithBattery: String(body.oldScootyWithBattery || "no") === "yes",
      oldScootyBatteryType: body.oldScootyBatteryType || "",
      oldScootyBatteryCount: Number(body.oldScootyBatteryCount) || 0,
      oldScootyWithCharger: String(body.oldScootyWithCharger || "no") === "yes",
      oldScootyChargerType: body.oldScootyChargerType || "",
      oldScootyChargerVoltageAmpere: body.oldScootyChargerVoltageAmpere || "",
      oldScootyChargerWorking: body.oldScootyChargerWorking || "working",
    });
    await adjustBillInventory(bill, "deduct");
    await upsertOldScootyFromBill(bill, body);
    const created = await bill.save();
    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating bill:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateBill = async (req, res) => {
  try {
    const body = req.body;
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    await adjustBillInventory(bill, "restore");

    const sellingPrice =
      body.sellingPrice !== undefined
        ? Number(body.sellingPrice) || 0
        : bill.sellingPrice;
    const paidAmount =
      body.paidAmount !== undefined
        ? Number(body.paidAmount) || 0
        : bill.paidAmount;
    const oldScootyPrice =
      body.oldScootyExchangePrice !== undefined
        ? Number(body.oldScootyExchangePrice) || 0
        : bill.oldScootyExchangePrice || 0;
    const pendingAmountFromBody =
      body.pendingAmount !== undefined
        ? Number(body.pendingAmount) || 0
        : bill.pendingAmount || 0;
    const netAmountFromBody =
      body.netAmount !== undefined
        ? Number(body.netAmount) || 0
        : bill.netAmount ||
          paidAmount + pendingAmountFromBody - oldScootyPrice;
    const netAmount =
      netAmountFromBody ||
      paidAmount + pendingAmountFromBody - oldScootyPrice;
    const discount =
      body.discount !== undefined
        ? Number(body.discount) || 0
        : Math.max(0, sellingPrice - netAmount);
    const pendingAmount =
      body.pendingAmount !== undefined
        ? pendingAmountFromBody
        : Math.max(0, netAmount - paidAmount - oldScootyPrice);

    const sanitizedServices = Array.isArray(body.services)
      ? body.services
          .slice(0, 3)
          .map((s) => ({
            serviceNumber: (s?.serviceNumber ?? s?.serviceNo ?? "").toString().trim(),
            date: (s?.date ?? "").toString().trim(),
          }))
          .filter((s) => s.date)
      : [];

    const updates = {
      modelId: body.modelId !== undefined ? body.modelId : bill.modelId,
      billNo: body.billNo !== undefined ? body.billNo : bill.billNo,
      billDate: body.billDate !== undefined ? body.billDate : bill.billDate,
      customerName: body.customerName !== undefined ? body.customerName : bill.customerName,
      mobile: body.mobile !== undefined ? body.mobile : bill.mobile,
      address: body.address !== undefined ? body.address : bill.address,
      modelPurchased: body.modelPurchased !== undefined ? body.modelPurchased : bill.modelPurchased,
      descriptionVariant: body.descriptionVariant !== undefined ? body.descriptionVariant : bill.descriptionVariant,
      modelColor: body.modelColor !== undefined ? body.modelColor : bill.modelColor,
      sellingPrice,
      discount,
      netAmount,
      paidAmount,
      pendingAmount,
      paymentMode: body.paymentMode !== undefined ? body.paymentMode : bill.paymentMode,
      warranty: body.warranty !== undefined ? body.warranty : bill.warranty,
      bankDetail:
        body.bankDetail !== undefined
          ? body.bankDetail
          : bill.bankDetail,
      withBattery: body.withBattery !== undefined ? body.withBattery : bill.withBattery,
      withCharger: body.withCharger !== undefined ? body.withCharger : bill.withCharger,
      batteryId: body.batteryId !== undefined ? body.batteryId : bill.batteryId,
      batteryName: body.batteryName !== undefined ? body.batteryName : bill.batteryName,
      batteryTypeForBill:
        body.batteryTypeForBill !== undefined
          ? body.batteryTypeForBill
          : bill.batteryTypeForBill,
      batteryVoltageForBill:
        body.batteryVoltageForBill !== undefined
          ? body.batteryVoltageForBill
          : bill.batteryVoltageForBill,
      batteryNumbersForBill:
        body.batteryNumbersForBill !== undefined
          ? body.batteryNumbersForBill
          : bill.batteryNumbersForBill,
      chargerId: body.chargerId !== undefined ? body.chargerId : bill.chargerId,
      chargerName: body.chargerName !== undefined ? body.chargerName : bill.chargerName,
      chargerTypeForBill:
        body.chargerTypeForBill !== undefined
          ? body.chargerTypeForBill
          : bill.chargerTypeForBill,
      chargerVoltageForBill:
        body.chargerVoltageForBill !== undefined
          ? body.chargerVoltageForBill
          : bill.chargerVoltageForBill,
      services: body.services !== undefined ? sanitizedServices : bill.services,
    };
    if (Array.isArray(body.paymentHistory)) updates.paymentHistory = body.paymentHistory;
    if (body.accessoryIncluded !== undefined) updates.accessoryIncluded = body.accessoryIncluded;
    if (Array.isArray(body.accessoryDetails)) updates.accessoryDetails = body.accessoryDetails;
    if (body.oldScootyExchange !== undefined) updates.oldScootyExchange = body.oldScootyExchange;
    if (body.oldScootyExchangePrice !== undefined) updates.oldScootyExchangePrice = Number(body.oldScootyExchangePrice) || 0;

    const updated = await Bill.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    await adjustBillInventory(updated, "deduct");
    await upsertOldScootyFromBill(updated, body);
    await updated.save();
    res.json(updated);
  } catch (error) {
    console.error("Error updating bill:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    await adjustBillInventory(bill, "restore");
    await removeOldScootyLinkedToBill(bill);
    await Bill.findByIdAndDelete(req.params.id);
    res.json({ message: "Bill deleted" });
  } catch (error) {
    console.error("Error deleting bill:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
};
