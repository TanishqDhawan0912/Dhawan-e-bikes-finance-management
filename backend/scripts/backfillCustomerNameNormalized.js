/**
 * Backfill nameNormalized on existing customers and rebuild the Customer indexes
 * so a customer's identity is uniquely the (mobileNormalized, nameNormalized) pair
 * instead of mobileNormalized alone (which merged different people sharing a mobile
 * number, e.g. a family, into a single customer record).
 *
 * Safe to re-run.
 *
 * Usage (from backend/): node scripts/backfillCustomerNameNormalized.js
 * Or: npm run migrate:customer-identity
 */
require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});
const mongoose = require("mongoose");
const Customer = require("../models/Customer");

function normalizeName(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function run() {
  const uri = process.env.MONGO_URI?.trim();
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const cursor = Customer.find({}).cursor();
  let matched = 0;
  let modified = 0;
  for await (const doc of cursor) {
    matched += 1;
    const nameNormalized = normalizeName(doc.name);
    if (doc.nameNormalized !== nameNormalized) {
      await Customer.updateOne({ _id: doc._id }, { $set: { nameNormalized } });
      modified += 1;
    }
  }
  console.log(
    `[migrate:customer-identity] Backfilled nameNormalized: matched=${matched}, modified=${modified}`,
  );

  // Drop the old single-field unique index on mobileNormalized if present, and
  // let Mongoose create the new compound { mobileNormalized, nameNormalized } index.
  const collection = Customer.collection;
  const indexes = await collection.indexes();
  const staleIndex = indexes.find(
    (idx) =>
      idx.unique &&
      idx.key &&
      Object.keys(idx.key).length === 1 &&
      idx.key.mobileNormalized === 1,
  );
  if (staleIndex) {
    console.log(
      `[migrate:customer-identity] Dropping stale unique index: ${staleIndex.name}`,
    );
    await collection.dropIndex(staleIndex.name);
  }

  await Customer.syncIndexes();
  console.log("[migrate:customer-identity] Indexes synced.");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[migrate:customer-identity] Failed:", err);
  process.exit(1);
});
