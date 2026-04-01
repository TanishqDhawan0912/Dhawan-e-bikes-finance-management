const mongoose = require("mongoose");

const batteryScrapSchema = new mongoose.Schema(
  {
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    // Present when this entry was created from a finalized jobcard flow.
    jobcardNumber: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    // Present when this entry was created from an old scooty entry (with battery).
    oldScootyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      default: null,
      index: true,
    },
    source: {
      type: String,
      enum: ["manual", "jobcard", "oldScooty"],
      default: "manual",
      index: true,
    },
    entryDate: {
      // Explicit date chosen by user (date-only, but we store full Date)
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

// Atlas/local sync: createdAt range + updatedAt vs lastSyncedAt in candidate filter.
batteryScrapSchema.index({ createdAt: 1 });
batteryScrapSchema.index({ updatedAt: 1 });

module.exports = mongoose.model("BatteryScrap", batteryScrapSchema);


