/**
 * Backfill missing root-level createdAt on all registered collections.
 * Uses aggregation pipeline update: createdAt = updatedAt if present, else server "now".
 * Safe to re-run: only touches docs where createdAt is missing or null.
 *
 * Usage (from backend/): node scripts/backfillCreatedAt.js
 * Or: npm run migrate:created-at
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { getLocalModelsOrdered } = require("../config/atlasModels");

async function backfillCollection(collection, modelName) {
  const filter = {
    $or: [{ createdAt: { $exists: false } }, { createdAt: null }],
  };

  const pipeline = [
    {
      $set: {
        createdAt: { $ifNull: ["$updatedAt", "$$NOW"] },
      },
    },
  ];

  try {
    const result = await collection.updateMany(filter, pipeline);
    return {
      modelName,
      collectionName: collection.collectionName,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    };
  } catch (err) {
    if (err.message && err.message.toLowerCase().includes("pipeline")) {
      console.warn(
        `[migrate:created-at] Pipeline update not supported for ${modelName}, using cursor fallback.`
      );
      return backfillCollectionCursor(collection, modelName, filter);
    }
    throw err;
  }
}

async function backfillCollectionCursor(collection, modelName, filter) {
  let modifiedCount = 0;
  let matchedCount = 0;
  const now = new Date();
  const cursor = collection.find(filter);
  for await (const doc of cursor) {
    matchedCount += 1;
    const createdAt =
      doc.updatedAt instanceof Date ? doc.updatedAt : doc.updatedAt ? new Date(doc.updatedAt) : now;
    await collection.updateOne(
      { _id: doc._id },
      { $set: { createdAt } }
    );
    modifiedCount += 1;
  }
  return {
    modelName,
    collectionName: collection.collectionName,
    matchedCount,
    modifiedCount,
  };
}

(async function main() {
  const uri = process.env.MONGO_LOCAL_URI?.trim();
  if (!uri) {
    console.error("[migrate:created-at] MONGO_LOCAL_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const models = getLocalModelsOrdered();
  let totalModified = 0;
  let totalMatched = 0;

  console.log("[migrate:created-at] Backfilling missing createdAt on primary DB…");

  for (const M of models) {
    if (!M.schema.path("createdAt") || !M.schema.path("updatedAt")) {
      console.error(
        `[migrate:created-at] ${M.modelName} must use { timestamps: true } on the root schema.`
      );
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  for (const M of models) {
    const r = await backfillCollection(M.collection, M.modelName);
    totalMatched += r.matchedCount;
    totalModified += r.modifiedCount;
    if (r.matchedCount > 0) {
      console.log(
        `  ${r.modelName} (${r.collectionName}): matched ${r.matchedCount}, modified ${r.modifiedCount}`
      );
    }
  }

  console.log(
    `[migrate:created-at] Done. Total matched ${totalMatched}, modified ${totalModified}.`
  );
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error("[migrate:created-at] FAILED:", e.message);
  process.exit(1);
});
