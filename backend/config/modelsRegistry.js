/**
 * Ordered list of root Mongoose models (restore-any, migrations).
 * Align with collections the application uses.
 */
const MODEL_PATHS = [
  "../models/Battery",
  "../models/BatteryScrap",
  "../models/Bill",
  "../models/Charger",
  "../models/Jobcard",
  "../models/JobcardDaySequence",
  "../models/Model",
  "../models/OldCharger",
  "../models/OldChargerScrap",
  "../models/OldChargerSummary",
  "../models/OldScooty",
  "../models/Spare",
  "../models/User",
];

function getLocalModelsOrdered() {
  return MODEL_PATHS.map((p) => require(p));
}

module.exports = {
  MODEL_PATHS,
  getLocalModelsOrdered,
};
