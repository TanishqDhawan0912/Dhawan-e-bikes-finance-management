const Bill = require("../models/Bill");
const Model = require("../models/Model");
const Battery = require("../models/Battery");
const Charger = require("../models/Charger");
const Spare = require("../models/Spare");
const mongoose = require("mongoose");

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v || ""));

const getLeadBatteryUnitsFromVoltage = (voltageRaw) => {
  const s = String(voltageRaw || "").toUpperCase();
  if (s.includes("72")) return 6;
  if (s.includes("60")) return 5;
  if (s.includes("48")) return 4;
  return 0;
};

const adjustSpareStockForAccessory = (spare, units, mode) => {
  if (!spare || units <= 0) return;
  const factor = mode === "restore" ? 1 : -1;
  const delta = factor * units;

  if (Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0) {
    if (delta < 0) {
      let toDeduct = Math.abs(delta);
      for (const cq of spare.colorQuantity) {
        if (!cq || toDeduct <= 0) continue;
        const current = Number(cq.quantity) || 0;
        const take = Math.min(current, toDeduct);
        cq.quantity = current - take;
        toDeduct -= take;
      }
    } else {
      const first = spare.colorQuantity[0];
      if (first) {
        first.quantity = Math.max(0, (Number(first.quantity) || 0) + delta);
      }
    }
    return;
  }

  spare.quantity = Math.max(0, (Number(spare.quantity) || 0) + delta);
};

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

  // 2) Battery stock
  if (billLike.withBattery && isObjectId(billLike.batteryId)) {
    const battery = await Battery.findById(billLike.batteryId);
    if (battery) {
      const type = String(billLike.batteryTypeForBill || "").toLowerCase();
      const units =
        type === "lead"
          ? getLeadBatteryUnitsFromVoltage(billLike.batteryVoltageForBill)
          : 1;
      if (units > 0) {
        const perSet = Number(battery.batteriesPerSet) || 0;
        const totalUnitsBefore =
          (Number(battery.totalSets) || 0) * (perSet || 0) +
          (Number(battery.openBatteries) || 0);
        let totalUnitsAfter = totalUnitsBefore + factor * units;
        if (totalUnitsAfter < 0) totalUnitsAfter = 0;
        if (perSet > 0) {
          battery.totalSets = Math.floor(totalUnitsAfter / perSet);
          battery.openBatteries = totalUnitsAfter % perSet;
        } else {
          battery.totalSets = 0;
          battery.openBatteries = totalUnitsAfter;
        }
        await battery.save();
      }
    }
  }

  // 3) Charger stock (one charger per bill)
  if (billLike.withCharger && isObjectId(billLike.chargerId)) {
    const charger = await Charger.findById(billLike.chargerId);
    if (charger) {
      charger.quantity = Math.max(0, (Number(charger.quantity) || 0) + factor * 1);
      await charger.save();
    }
  }

  // 4) Accessory spare stock
  if (Array.isArray(billLike.accessoryDetails) && billLike.accessoryDetails.length > 0) {
    const accessoryCounts = new Map();
    for (const item of billLike.accessoryDetails) {
      const id = String(item?.id || "").trim();
      if (!isObjectId(id)) continue;
      accessoryCounts.set(id, (accessoryCounts.get(id) || 0) + 1);
    }

    for (const [spareId, units] of accessoryCounts.entries()) {
      const spare = await Spare.findById(spareId);
      if (!spare) continue;
      adjustSpareStockForAccessory(spare, units, mode);
      await spare.save();
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
    });
    await adjustBillInventory(bill, "deduct");
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
