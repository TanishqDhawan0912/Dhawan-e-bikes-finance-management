/**
 * All Mongoose models mirrored to Atlas (same schema clone per connection).
 * Order is stable for logging; sync iterates this list.
 * Each root schema must use `{ timestamps: true }` so createdAt/updatedAt exist for sync and migrations.
 */
const MODEL_PATHS = [
  "../models/Battery",
  "../models/BatteryScrap",
  "../models/Bill",
  "../models/Charger",
  "../models/Jobcard",
  "../models/Model",
  "../models/OldCharger",
  "../models/OldChargerScrap",
  "../models/OldChargerSummary",
  "../models/OldScooty",
  "../models/Order",
  "../models/Spare",
  "../models/User",
];

/**
 * @param {import("mongoose").Connection} atlasConnection
 * @returns {Record<string, import("mongoose").Model>}
 */
function registerAtlasModels(atlasConnection) {
  const models = {};
  for (const relPath of MODEL_PATHS) {
    const LocalModel = require(relPath);
    const name = LocalModel.modelName;
    if (!name) continue;
    models[name] =
      atlasConnection.models[name] ||
      atlasConnection.model(name, LocalModel.schema.clone());
  }
  return models;
}

function getLocalModelsOrdered() {
  return MODEL_PATHS.map((p) => require(p));
}

module.exports = {
  MODEL_PATHS,
  registerAtlasModels,
  getLocalModelsOrdered,
};
