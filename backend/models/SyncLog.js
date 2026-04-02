const mongoose = require("mongoose");

const syncLogErrorSchema = new mongoose.Schema(
  {
    collectionName: { type: String, default: "" },
    id: { type: String, default: "" },
    message: { type: String, default: "" },
  },
  { _id: false }
);

/**
 * Local-only audit trail for POST /sync-now (not mirrored to Atlas).
 * Written asynchronously after each run so sync latency is unaffected.
 */
const syncLogSchema = new mongoose.Schema(
  {
    runAt: { type: Date, default: Date.now, required: true },
    success: { type: Boolean, required: true },
    atlasAvailable: { type: Boolean, required: true },
    totalCandidates: { type: Number, default: 0 },
    synced: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    deletedFromAtlas: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    deletedByCollection: { type: mongoose.Schema.Types.Mixed, default: {} },
    syncErrors: { type: [syncLogErrorSchema], default: [] },
  },
  { timestamps: false, versionKey: false }
);

/** Seconds in 30 days — MongoDB deletes the document after this interval past runAt. */
const SYNC_LOG_TTL_SECONDS = 60 * 60 * 24 * 30;

// TTL on runAt: only rows with runAt older than 30 days are removed; recent logs stay.
syncLogSchema.index({ runAt: 1 }, { expireAfterSeconds: SYNC_LOG_TTL_SECONDS });

module.exports = mongoose.model("SyncLog", syncLogSchema);

