/**
 * Smoke test: connect, count candidates per collection, run full Atlas sync.
 * Usage (from backend/): node scripts/verifySync.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { connectMongoDatabases, getAtlasConnection } = require("../config/database");
const { getLocalModelsOrdered } = require("../config/atlasModels");
const {
  buildCandidateFilter,
  syncAllLocalToAtlas,
  sixMonthsAgo,
} = require("../services/atlasSync");

(async () => {
  try {
    await connectMongoDatabases();
    const cutoff = sixMonthsAgo();
    const filter = buildCandidateFilter(cutoff);
    const locals = getLocalModelsOrdered();
    let total = 0;
    for (const M of locals) {
      const n = await M.countDocuments(filter);
      if (n) console.log(`[verifySync] ${M.modelName} candidates:`, n);
      total += n;
    }
    console.log("[verifySync] totalCandidates (sum):", total);
    const stats = await syncAllLocalToAtlas();
    console.log("[verifySync] Result:", JSON.stringify(stats, null, 2));
    await mongoose.disconnect();
    const ac = getAtlasConnection();
    if (ac?.readyState === 1) await ac.close();
    process.exit(0);
  } catch (e) {
    console.error("[verifySync] FAILED:", e.message);
    process.exit(1);
  }
})();
