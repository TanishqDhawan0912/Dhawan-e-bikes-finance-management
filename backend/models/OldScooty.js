const mongoose = require("mongoose");

const oldScootySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    pmcNo: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    purchasePrice: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    withBattery: {
      type: Boolean,
      default: false,
    },
    batteryType: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    batteryCount: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    withCharger: {
      type: Boolean,
      default: false,
    },
    chargerVoltageAmpere: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    chargerType: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    entryDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["ready", "not-ready"],
      default: "not-ready",
    },
    sparesUsed: [
      {
        spareId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Spare",
          required: false,
          default: null,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        color: {
          type: String,
          required: false,
          trim: true,
          default: "",
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("OldScooty", oldScootySchema);
