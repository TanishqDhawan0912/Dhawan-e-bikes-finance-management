const Bill = require("../models/Bill");

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
      upiId: body.upiId || "",
      upiTransactionId: body.upiTransactionId || "",
      upiTransactionDate: body.upiTransactionDate || "",
      warranty: body.warranty || "None",
      withBattery: body.withBattery !== false,
      withCharger: body.withCharger !== false,
      batteryId: body.batteryId || "",
      batteryName: body.batteryName || "",
      batteryTypeForBill: body.batteryTypeForBill || "",
      batteryVoltageForBill: body.batteryVoltageForBill || "",
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
      upiId: body.upiId !== undefined ? body.upiId : bill.upiId,
      upiTransactionId:
        body.upiTransactionId !== undefined
          ? body.upiTransactionId
          : bill.upiTransactionId,
      upiTransactionDate:
        body.upiTransactionDate !== undefined
          ? body.upiTransactionDate
          : bill.upiTransactionDate,
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

    const updated = await Bill.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.json(updated);
  } catch (error) {
    console.error("Error updating bill:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteBill = async (req, res) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) return res.status(404).json({ message: "Bill not found" });
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
