const mongoose = require("mongoose");

/** Redact user:password in mongodb:// or mongodb+srv:// URIs for logs */
function maskMongoUri(uri) {
  if (!uri || typeof uri !== "string") return "(not set)";
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
}

let listenersAttached = false;
function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on("error", (err) => {
    // Do not throw here; keep the process alive and let the app handle DB outages.
    console.error("[MongoDB] Connection error event:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] Disconnected");
  });

  // Fires when Mongoose successfully reconnects after being disconnected
  mongoose.connection.on("reconnected", () => {
    console.log("[MongoDB] Reconnected");
  });
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
    attachConnectionListeners();
    await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
    });
    console.log(
      "[MongoDB] Connected successfully —",
      maskMongoUri(uri),
      "| db:",
      mongoose.connection.name
    );
  } catch (err) {
    console.error("[MongoDB] Initial connection FAILED —", err?.message || err);
    if (err?.name) console.error("[MongoDB] Error name:", err.name);
    console.error("[MongoDB] URI (masked):", maskMongoUri(uri));
    throw err;
  }
}

async function closeDatabase() {
  if (mongoose.connection.readyState === 0) return;
  try {
    await mongoose.connection.close();
    console.log("[MongoDB] Connection closed");
  } catch (err) {
    // Never crash during shutdown
    console.error("[MongoDB] Error while closing connection:", err);
  }
}

module.exports = {
  connectDatabase,
  closeDatabase,
  maskMongoUri,
};
