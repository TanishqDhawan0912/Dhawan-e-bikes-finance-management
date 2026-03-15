const mongoose = require("mongoose");

const paymentEntrySchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  date: { type: String, required: true },
  time: { type: String, default: "" },
  paymentMode: { type: String, enum: ["cash", "upi"], required: true },
});

const accessoryDetailSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    name: { type: String, default: "", trim: true },
    sellingPrice: { type: Number, default: 0, min: 0 },
    sku: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    billNo: { type: String, required: true, trim: true },
    billDate: { type: String, required: true, trim: true },
    customerName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    // Model details (new scooty sold)
    modelPurchased: { type: String, required: true, trim: true },
    descriptionVariant: { type: String, default: "", trim: true },
    modelColor: { type: String, required: true, trim: true },
    // Financial
    sellingPrice: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    netAmount: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    pendingAmount: { type: Number, default: 0, min: 0 },
    paymentMode: { type: String, enum: ["cash", "upi"], default: "cash" },
    paymentHistory: [paymentEntrySchema],
    // Warranty (e.g. "Battery, Charger, Motor, Controller" or "None")
    warranty: { type: String, default: "None", trim: true },
    // Optional flags for display
    withBattery: { type: Boolean, default: true },
    withCharger: { type: Boolean, default: true },
    // Optional accessories included with this bill
    accessoryIncluded: { type: String, default: "", trim: true },
    accessoryDetails: [accessoryDetailSchema],
    // Old scooty exchange (optional)
    oldScootyExchange: { type: String, default: "", trim: true },
    oldScootyExchangePrice: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bill", billSchema);
