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
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("OldChargerSummary", oldChargerSummarySchema);
