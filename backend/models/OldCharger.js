const mongoose = require("mongoose");
const softDeletePlugin = require("./plugins/softDelete");

const VALID_VOLTAGES = ["48V", "60V", "72V"];
const VALID_BATTERY_TYPES = ["lead", "lithium"];
const VALID_AMPERES = ["3A", "4A", "5A"];
const VALID_STATUSES = ["working", "notWorking"];

const oldChargerSchema = new mongoose.Schema(
  {
    voltage: {
      type: String,
      required: true,
      enum: VALID_VOLTAGES,
    },
    batteryType: {
      type: String,
      required: true,
      enum: VALID_BATTERY_TYPES,
    },
    ampere: {
      type: String,
      required: true,
      enum: VALID_AMPERES,
    },
    status: {
      type: String,
      required: true,
      enum: VALID_STATUSES,
    },
    entryDate: {
      type: Date,
      required: true,
    },
    // When created from a jobcard (e.g. replacement charger with old charger arrived)
    jobcardNumber: {
      type: String,
      required: false,
      trim: true,
    },
    // When created from an old scooty entry (with charger).
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
    lastSyncedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

oldChargerSchema.plugin(softDeletePlugin);

// Indexing for date-range queries and lastSyncedAt bookkeeping.
oldChargerSchema.index({ createdAt: 1 });
oldChargerSchema.index({ updatedAt: 1 });

module.exports = mongoose.model("OldCharger", oldChargerSchema);







