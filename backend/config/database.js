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
    console.log("[MongoDB] Connected —", maskMongoUri(uri));
  } catch (err) {
    console.error("[MongoDB] Connection FAILED —", err.message);
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
