const mongoose = require("mongoose");

/**
 * One row per calendar day (YYYY-MM-DD): last issued jobcard suffix for that day.
 * Updated only via allocateNextJobcardSuffix (atomic pipeline) — never set seq manually.
 */
const jobcardDaySequenceSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true },
  },
  { collection: "jobcard_day_sequences" }
);

module.exports =
  mongoose.models.JobcardDaySequence ||
  mongoose.model("JobcardDaySequence", jobcardDaySequenceSchema);
