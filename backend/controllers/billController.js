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
    const discount = Number(body.discount) || 0;
    const paidAmount = Number(body.paidAmount) || 0;
    const netAmount = sellingPrice - discount;
    const pendingAmount = Math.max(0, netAmount - paidAmount);

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
      warranty: body.warranty || "None",
      withBattery: body.withBattery !== false,
      withCharger: body.withCharger !== false,
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

    const sellingPrice = Number(body.sellingPrice) !== undefined ? Number(body.sellingPrice) : bill.sellingPrice;
    const discount = Number(body.discount) !== undefined ? Number(body.discount) : bill.discount;
    const paidAmount = Number(body.paidAmount) !== undefined ? Number(body.paidAmount) : bill.paidAmount;
    const netAmount = sellingPrice - discount;
    const pendingAmount = Math.max(0, netAmount - paidAmount);

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
      withBattery: body.withBattery !== undefined ? body.withBattery : bill.withBattery,
      withCharger: body.withCharger !== undefined ? body.withCharger : bill.withCharger,
    };
    if (Array.isArray(body.paymentHistory)) updates.paymentHistory = body.paymentHistory;

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
