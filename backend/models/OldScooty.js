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
    chargerWorking: {
      // Status of old charger coming with scooty
      type: String,
      enum: ["working", "notWorking"],
      default: "working",
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

    // Track whether sparesUsed has already been deducted from inventory.
    inventoryAdjusted: {
      type: Boolean,
      default: false,
    },

    // Snapshot of what was deducted (used to restore on edit/delete).
    consumedSparesUsed: [
      {
        spareId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Spare",
          required: false,
          default: null,
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
    lastSyncedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Atlas/local sync: createdAt range + updatedAt vs lastSyncedAt in candidate filter.
oldScootySchema.index({ createdAt: 1 });
oldScootySchema.index({ updatedAt: 1 });

module.exports = mongoose.model("OldScooty", oldScootySchema);
