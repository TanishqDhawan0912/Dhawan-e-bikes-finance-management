const mongoose = require("mongoose");
const softDeletePlugin = require("./plugins/softDelete");

const batterySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    ampereValue: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    batteriesPerSet: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    totalSets: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    openBatteries: {
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
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    supplierName: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    batteryType: {
      type: String,
      enum: ["lead", "lithium"],
      required: false,
      default: "",
    },
    minStockLevel: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    purchaseDate: {
      type: Date,
      required: false,
    },
    stockEntries: [
      {
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        /** Units bought in this batch; does not decrease when stock is sold (FIFO uses quantity). */
        originalQuantity: {
          type: Number,
          required: false,
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
        batteriesPerSet: {
          type: Number,
          required: false,
          min: 0,
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

batterySchema.plugin(softDeletePlugin);

// Indexing for date-range queries and lastSyncedAt bookkeeping.
batterySchema.index({ createdAt: 1 });
batterySchema.index({ updatedAt: 1 });

// Helper to recalculate total sets and open batteries from stock entries
batterySchema.methods.recalculateFromStockEntries = function () {
  if (!Array.isArray(this.stockEntries) || this.stockEntries.length === 0) {
    return;
  }

  const totalQuantity = this.stockEntries.reduce(
    (total, entry) => total + (entry.quantity || 0),
    0
  );

  const perSet = this.batteriesPerSet || 0;
  if (perSet > 0) {
    this.totalSets = Math.floor(totalQuantity / perSet);
    this.openBatteries = totalQuantity % perSet;
  } else {
    // If batteriesPerSet is not set, treat everything as open batteries
    this.totalSets = 0;
    this.openBatteries = totalQuantity;
  }
};

module.exports = mongoose.model("Battery", batterySchema);
