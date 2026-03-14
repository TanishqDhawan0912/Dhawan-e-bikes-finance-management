const mongoose = require("mongoose");

const chargerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    batteryType: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    voltage: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    quantity: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    warrantyStatus: {
      type: Boolean,
      required: false,
      default: false,
    },
    purchaseDate: {
      type: Date,
      required: false,
    },
    supplierName: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    minStockLevel: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    stockEntries: [
      {
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        purchasePrice: {
          type: Number,
          required: true,
          min: 0,
        },
        purchaseDate: {
          type: Date,
          required: true,
        },
        warrantyStatus: {
          type: Boolean,
          required: false,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Charger", chargerSchema);
