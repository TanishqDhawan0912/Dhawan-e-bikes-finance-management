const { syncAllLocalToAtlas } = require("../services/atlasSync");

/**
 * POST /sync-now — full Atlas sync (all collections) + Atlas-only cleanup.
 */
const syncNow = async (req, res) => {
  try {
    const stats = await syncAllLocalToAtlas();

    const body = {
      success: stats.success,
      skipped: Boolean(stats.skipped),
      atlasAvailable: stats.atlasAvailable,
      totalCandidates: stats.totalCandidates,
      synced: stats.synced,
      failed: stats.failed,
      deletedFromAtlas: stats.deletedFromAtlas,
      deletedByCollection: stats.deletedByCollection,
      durationMs: stats.durationMs,
      syncErrors: stats.syncErrors,
    };

    if (!stats.atlasAvailable) {
      return res.status(503).json(body);
    }

    if (stats.skipped) {
      return res.status(200).json(body);
    }

    if (stats.failed > 0 && stats.synced === 0) {
      return res.status(500).json(body);
    }

    return res.status(200).json(body);
  } catch (err) {
    console.error("[Sync] FAILURE (unexpected):", err.message);
    return res.status(500).json({
      success: false,
      atlasAvailable: true,
      totalCandidates: 0,
      synced: 0,
      failed: 0,
      deletedFromAtlas: 0,
      deletedByCollection: {},
      durationMs: 0,
      syncErrors: [{ collectionName: "", id: "", message: err.message }],
    });
  }
};

module.exports = { syncNow };
