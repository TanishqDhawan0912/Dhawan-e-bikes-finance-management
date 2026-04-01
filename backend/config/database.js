const mongoose = require("mongoose");
const { registerAtlasModels } = require("./atlasModels");

/** Redact user:password in mongodb:// or mongodb+srv:// URIs for logs */
function maskMongoUri(uri) {
  if (!uri || typeof uri !== "string") return "(not set)";
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
}

let atlasConnection = null;
/** @type {Record<string, import("mongoose").Model> | null} */
let atlasModels = null;

/**
 * Primary: local MongoDB via mongoose.connect (all existing models).
 * Secondary: MongoDB Atlas — cloned schemas for every registered model (see atlasModels.js).
 * Atlas is skipped when MONGO_ATLAS_URI is unset. Primary requires MONGO_LOCAL_URI.
 */
async function connectMongoDatabases() {
  const localUri = process.env.MONGO_LOCAL_URI?.trim();
  if (!localUri) {
    const msg = "MONGO_LOCAL_URI is not set";
    console.error("[MongoDB] Local (primary): connection FAILED —", msg);
    throw new Error(msg);
  }

  try {
    await mongoose.connect(localUri);
    console.log(
      "[MongoDB] Local (primary): connected successfully —",
      maskMongoUri(localUri)
    );
  } catch (err) {
    console.error(
      "[MongoDB] Local (primary): connection FAILED —",
      err.message
    );
    console.error("[MongoDB] Local URI (masked):", maskMongoUri(localUri));
    throw err;
  }

  const atlasUri = process.env.MONGO_ATLAS_URI?.trim();
  if (!atlasUri) {
    console.warn(
      "[MongoDB] Atlas (secondary): skipped — MONGO_ATLAS_URI is not set"
    );
    atlasConnection = null;
    atlasModels = null;
    return { atlasConnection: null, atlasModels: null };
  }

  try {
    atlasConnection = mongoose.createConnection(atlasUri);
    await atlasConnection.asPromise();
    atlasModels = registerAtlasModels(atlasConnection);
    console.log(
      "[MongoDB] Atlas (secondary): connected successfully —",
      maskMongoUri(atlasUri)
    );
  } catch (err) {
    console.error(
      "[MongoDB] Atlas (secondary): connection FAILED —",
      err.message
    );
    console.error("[MongoDB] Atlas URI (masked):", maskMongoUri(atlasUri));
    if (atlasConnection) {
      try {
        await atlasConnection.close();
      } catch (_) {
        /* ignore */
      }
    }
    atlasConnection = null;
    atlasModels = null;
  }

  return { atlasConnection, atlasModels };
}

function getAtlasConnection() {
  return atlasConnection;
}

function getAtlasModels() {
  return atlasModels;
}

function getJobcardAtlas() {
  return atlasModels && atlasModels.Jobcard;
}

module.exports = {
  connectMongoDatabases,
  getAtlasConnection,
  getAtlasModels,
  getJobcardAtlas,
  maskMongoUri,
};
