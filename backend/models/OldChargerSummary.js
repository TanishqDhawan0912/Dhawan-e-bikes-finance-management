const mongoose = require("mongoose");

const oldChargerSummarySchema = new mongoose.Schema(
  {
    id: { type: String, default: "default", unique: true },
    // summary: { "48V": { total, working, notWorking }, "60V": ..., "72V": ..., "Other": ... }
    summary: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        "48V": { total: 0, working: 0, notWorking: 0 },
        "60V": { total: 0, working: 0, notWorking: 0 },
        "72V": { total: 0, working: 0, notWorking: 0 },
        Other: { total: 0, working: 0, notWorking: 0 },
      }),
    },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

// Atlas/local sync: createdAt range + updatedAt vs lastSyncedAt in candidate filter.
oldChargerSummarySchema.index({ createdAt: 1 });
oldChargerSummarySchema.index({ updatedAt: 1 });

module.exports = mongoose.model("OldChargerSummary", oldChargerSummarySchema);
