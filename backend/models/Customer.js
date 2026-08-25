const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    place: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    // Digits-only normalized phone for stable matching.
    mobileNormalized: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // Lowercased, trimmed name used with mobileNormalized to uniquely identify a customer
    // (two different people can share a mobile number, e.g. a family landline).
    nameNormalized: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    customerType: {
      type: String,
      enum: ["green", "red", "black"],
      default: "green",
    },
    warrantyStatus: {
      type: String,
      enum: ["none", "warranty"],
      default: "none",
    },
    warrantyDate: {
      type: String,
      default: "",
    },
    scootyModel: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

customerSchema.index({ name: 1, place: 1 });
customerSchema.index({ createdAt: -1 });
// A customer's identity is the combination of mobile number and name.
customerSchema.index(
  { mobileNormalized: 1, nameNormalized: 1 },
  { unique: true },
);

const Customer =
  mongoose.models.Customer || mongoose.model("Customer", customerSchema);

module.exports = Customer;
