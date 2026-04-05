const mongoose = require("mongoose");

/** Redact user:password in mongodb:// or mongodb+srv:// URIs for logs */
function maskMongoUri(uri) {
  if (!uri || typeof uri !== "string") return "(not set)";
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
}

/**
 * Single database connection (MongoDB Atlas or any URI).
 * Uses mongoose.connect(process.env.MONGO_URI).
 */
async function connectDatabase() {
  const uri = process.env.MONGO_URI?.trim();
  if (!uri) {
    const msg = "MONGO_URI is not set";
    console.error("[MongoDB] Connection FAILED —", msg);
    throw new Error(msg);
  }

  try {
    await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    });
    console.log(
      "[MongoDB] Connected successfully —",
      maskMongoUri(uri),
      "| db:",
      mongoose.connection.name
    );

    mongoose.connection.on("error", (err) => {
      console.error("[MongoDB] Runtime connection error:", err?.message || err);
    });
    mongoose.connection.on("disconnected", () => {
      console.warn("[MongoDB] Disconnected from cluster");
    });
  } catch (err) {
    console.error("[MongoDB] Initial connection FAILED —", err?.message || err);
    if (err?.name) console.error("[MongoDB] Error name:", err.name);
    console.error("[MongoDB] URI (masked):", maskMongoUri(uri));
    throw err;
  }
}

async function closeDatabase() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
}

module.exports = {
  connectDatabase,
  closeDatabase,
  maskMongoUri,
};
