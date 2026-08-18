const crypto = require("crypto");
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const QRRecord = require("../models/QRRecord");
const Jobcard = require("../models/Jobcard");

function serializeCustomer(customer) {
  return {
    id: String(customer._id),
    name: customer.name,
    place: customer.place,
    phoneNumber: customer.mobile,
  };
}

async function getOrCreateQrRecord(customerId) {
  let record = await QRRecord.findOne({ customer: customerId });
  if (record) return record;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await QRRecord.create({
        customer: customerId,
        qrToken: crypto.randomBytes(32).toString("base64url"),
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      record = await QRRecord.findOne({ customer: customerId });
      if (record) return record;
    }
  }

  throw new Error("Unable to create customer QR token");
}

const getCustomerQrToken = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res
      .status(404)
      .json({ success: false, message: "Customer not found" });
  }

  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    return res
      .status(404)
      .json({ success: false, message: "Customer not found" });
  }

  const record = await getOrCreateQrRecord(customer._id);
  return res.json({ success: true, qrToken: record.qrToken });
};

const scanQrToken = async (req, res) => {
  const qrToken = String(req.body?.qrToken || "").trim();
  if (!qrToken || qrToken.length > 200) {
    return res.status(400).json({ success: false, message: "Invalid QR code" });
  }

  const record = await QRRecord.findOne({ qrToken }).populate("customer");
  if (!record?.customer) {
    return res
      .status(404)
      .json({ success: false, message: "Customer QR code not found" });
  }

  const jobcards = await Jobcard.find({ customer: record.customer._id })
    .sort({ createdAt: -1 })
    .select("jobcardNumber date jobcardType status totalAmount pendingAmount");

  return res.json({
    success: true,
    customer: serializeCustomer(record.customer),
    jobcards,
  });
};

module.exports = { getCustomerQrToken, scanQrToken };
