const mongoose = require("mongoose");
const softDeletePlugin = require("./plugins/softDelete");

const oldChargerScrapSchema = new mongoose.Schema(
  {
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    entryDate: {
      type: Date,
      required: true,
    },
    lastSyncedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

oldChargerScrapSchema.plugin(softDeletePlugin);

// Atlas/local sync: createdAt range + updatedAt vs lastSyncedAt in candidate filter.
oldChargerScrapSchema.index({ createdAt: 1 });
oldChargerScrapSchema.index({ updatedAt: 1 });

module.exports = mongoose.model("OldChargerScrap", oldChargerScrapSchema);
