const mongoose = require("mongoose");
const { getLocalModelsOrdered } = require("../config/atlasModels");

function parseId(idParam) {
  const raw = String(idParam || "").trim();
  if (mongoose.Types.ObjectId.isValid(raw)) {
    return new mongoose.Types.ObjectId(raw);
  }
  return raw;
}

/**
 * PATCH /restore/:id
 * Tries to restore (isDeleted=false) across known main models.
 * Returns the first model that matched.
 */
const restoreAny = async (req, res) => {
  const idRaw = req.params.id;
  const id = parseId(idRaw);
  const models = getLocalModelsOrdered();

  for (const M of models) {
    try {
      const r = await M.collection.updateOne(
        { _id: id, isDeleted: true },
        { $set: { isDeleted: false } }
      );
      if (r && r.matchedCount > 0) {
        console.log("[restore] Restored", M.modelName, ":", String(idRaw));
        return res.status(200).json({ message: "Restored", model: M.modelName, id: idRaw });
      }
    } catch (e) {
      // Ignore cast / collection mismatch and continue trying other models.
    }
  }

  return res.status(404).json({ message: "No deleted record found for id", id: idRaw });
};

module.exports = { restoreAny };

