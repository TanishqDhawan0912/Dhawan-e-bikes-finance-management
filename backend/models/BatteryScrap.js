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
    entryDate: {
      // Explicit date chosen by user (date-only, but we store full Date)
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("BatteryScrap", batteryScrapSchema);


