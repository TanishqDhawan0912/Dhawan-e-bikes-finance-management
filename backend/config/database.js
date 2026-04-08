const mongoose = require("mongoose");

/** Mask Mongo URI for logs */
function maskMongoUri(uri) {
  if (!uri || typeof uri !== "string") return "(not set)";
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
}

/** 🔥 GLOBAL CACHE (CRITICAL FOR RENDER) */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = {
    conn: null,
    promise: null,
  };
}

let listenersAttached = false;
function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on("error", (err) => {
    console.error("[MongoDB] Connection error event:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] Disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("[MongoDB] Reconnected");
  });
}

async function connectDatabase() {
  const uri = process.env.MONGO_URI?.trim();

  if (!uri) {
    const msg = "MONGO_URI is not set";
    console.error("[MongoDB] FAILED —", msg);
    throw new Error(msg);
  }

  /** ✅ RETURN EXISTING CONNECTION */
  if (cached.conn) {
    return cached.conn;
  }

  /** ✅ CREATE PROMISE ONLY ONCE */
  if (!cached.promise) {
    attachConnectionListeners();

    cached.promise = mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;

    console.log(
      "[MongoDB] Connected —",
      maskMongoUri(uri),
      "| db:",
      mongoose.connection.name
    );

    return cached.conn;
  } catch (err) {
    cached.promise = null;

    console.error("[MongoDB] Connection FAILED —", err?.message || err);
    console.error("[MongoDB] URI:", maskMongoUri(uri));

    throw err;
  }
}

async function closeDatabase() {
  if (cached.conn) {
    try {
      await mongoose.connection.close();
      cached.conn = null;
      cached.promise = null;
      console.log("[MongoDB] Connection closed");
    } catch (err) {
      console.error("[MongoDB] Error while closing:", err);
    }
  }
}

module.exports = {
  connectDatabase,
  closeDatabase,
  maskMongoUri,
};