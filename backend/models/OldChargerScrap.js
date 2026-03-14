const mongoose = require("mongoose");

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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("OldChargerScrap", oldChargerScrapSchema);
