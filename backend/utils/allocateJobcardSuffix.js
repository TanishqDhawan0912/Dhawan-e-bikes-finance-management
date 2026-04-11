const mongoose = require("mongoose");
require("../models/JobcardDaySequence"); // register model

/**
 * Serialize allocation per calendar day so two concurrent requests never use the same
 * "max from DB" snapshot before either updates the sequence document.
 * (Multi-process: still rely on atomic findOneAndUpdate + optional duplicate-key retry on Jobcard insert.)
 */
const serialChains = new Map();

function runSerialForDate(jobcardDate, fn) {
  const prev = serialChains.get(jobcardDate) || Promise.resolve();
  const next = prev.then(() => fn());
  serialChains.set(
    jobcardDate,
    next.catch(() => {
      /* keep chain alive */
    })
  );
  return next;
}

/**
 * Max (...N) suffix from all jobcard rows for this date (raw collection, includes soft-deleted).
 */
async function getMaxJobcardSuffixFromDb(jobcardDate) {
  const jobcardsCol = mongoose.connection.db.collection("jobcards");
  const rows = await jobcardsCol
    .find({ date: jobcardDate })
    .project({ jobcardNumber: 1 })
    .toArray();
  let maxNum = 0;
  for (const row of rows) {
    const m = /\((\d+)\)\s*$/.exec(row.jobcardNumber || "");
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return maxNum;
}

/**
 * Atomically allocate the next jobcard numeric suffix for a calendar day (YYYY-MM-DD).
 * Uses one findOneAndUpdate pipeline (no $lookup — not allowed in updates on MongoDB Atlas)
 * plus per-date JS serialization so the max-from-jobcards read stays consistent with the update.
 *
 * @param {string} jobcardDate — e.g. "2026-04-11"
 * @returns {Promise<number>}
 */
async function allocateNextJobcardSuffix(jobcardDate) {
  if (!jobcardDate || typeof jobcardDate !== "string") {
    throw new Error("allocateNextJobcardSuffix: invalid jobcardDate");
  }

  return runSerialForDate(jobcardDate, async () => {
    const maxFromJc = await getMaxJobcardSuffixFromDb(jobcardDate);
    const JobcardDaySequence = mongoose.model("JobcardDaySequence");
    const col = JobcardDaySequence.collection;

    const pipeline = [
      {
        $set: {
          seq: {
            $add: [
              {
                $max: [
                  { $ifNull: ["$seq", 0] },
                  maxFromJc,
                ],
              },
              1,
            ],
          },
        },
      },
    ];

    const result = await col.findOneAndUpdate(
      { _id: jobcardDate },
      pipeline,
      { upsert: true, returnDocument: "after" }
    );

    const doc = result?.value != null ? result.value : result;
    const seq = doc && typeof doc.seq === "number" ? doc.seq : null;
    if (seq == null || !Number.isFinite(seq) || seq < 1) {
      throw new Error("allocateNextJobcardSuffix: failed to allocate sequence");
    }
    return seq;
  });
}

module.exports = { allocateNextJobcardSuffix };
