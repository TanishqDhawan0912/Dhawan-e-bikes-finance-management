const { getAtlasModels } = require("../config/database");
const { getLocalModelsOrdered } = require("../config/atlasModels");

const MAX_ERRORS_IN_RESPONSE = 40;
const MAX_ERRORS_IN_SYNC_LOG = 50;
/** Batch Atlas reads to build $unset without one round-trip per document */
const ATLAS_DOC_FETCH_CHUNK = 250;

/** Top-level fields never removed on Atlas (sync + TTL semantics) */
const PROTECTED_FROM_UNSET = new Set(["_id", "createdAt", "updatedAt"]);

let syncInProgress = false;

/**
 * Persist sync summary to local synclogs collection after the run finishes.
 * Deferred via setImmediate + non-awaited create() so sync throughput is not blocked.
 */
function scheduleSyncLogPersist(result) {
  setImmediate(() => {
    try {
      const SyncLog = require("../models/SyncLog");
      const payload = {
        runAt: new Date(),
        success: Boolean(result.success),
        atlasAvailable: Boolean(result.atlasAvailable),
        totalCandidates: Number(result.totalCandidates) || 0,
        synced: Number(result.synced) || 0,
        failed: Number(result.failed) || 0,
        deletedFromAtlas: Number(result.deletedFromAtlas) || 0,
        durationMs: Number(result.durationMs) || 0,
        deletedByCollection:
          result.deletedByCollection &&
          typeof result.deletedByCollection === "object"
            ? { ...result.deletedByCollection }
            : {},
        syncErrors: Array.isArray(result.syncErrors)
          ? result.syncErrors.slice(0, MAX_ERRORS_IN_SYNC_LOG)
          : [],
      };
      SyncLog.create(payload).catch((err) => {
        console.error("[Sync] syncLogs write failed:", err.message);
      });
    } catch (err) {
      console.error("[Sync] syncLogs write failed:", err.message);
    }
  });
}

function sixMonthsAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d;
}

/**
 * createdAt within last 6 months, and needs push to Atlas:
 * never synced or local updatedAt > lastSyncedAt.
 */
function buildCandidateFilter(cutoff) {
  return {
    $and: [
      { createdAt: { $gte: cutoff } },
      {
        $or: [
          { lastSyncedAt: { $exists: false } },
          { lastSyncedAt: null },
          { $expr: { $gt: ["$updatedAt", "$lastSyncedAt"] } },
        ],
      },
    ],
  };
}

/**
 * Fields to apply with $set on Atlas. Omits _id (comes from filter on upsert), __v, and undefined.
 */
function toSetPayload(doc) {
  const o = { ...doc };
  delete o.__v;
  delete o._id;
  for (const key of Object.keys(o)) {
    if (o[key] === undefined) delete o[key];
  }
  return o;
}

/**
 * $set from local + $unset for top-level keys present on Atlas but absent from local payload.
 */
function buildAtlasUpdate(doc, atlasDoc) {
  const $set = toSetPayload(doc);
  const localKeys = new Set(Object.keys($set));
  const update = {};

  if (Object.keys($set).length > 0) {
    update.$set = $set;
  }

  if (atlasDoc) {
    const $unset = {};
    for (const key of Object.keys(atlasDoc)) {
      if (PROTECTED_FROM_UNSET.has(key)) continue;
      if (!localKeys.has(key)) {
        $unset[key] = "";
      }
    }
    if (Object.keys($unset).length > 0) {
      update.$unset = $unset;
    }
  }

  return update;
}

async function fetchAtlasDocsByIds(collection, ids) {
  const map = new Map();
  for (let i = 0; i < ids.length; i += ATLAS_DOC_FETCH_CHUNK) {
    const slice = ids.slice(i, i + ATLAS_DOC_FETCH_CHUNK);
    const rows = await collection.find({ _id: { $in: slice } }).toArray();
    for (const row of rows) {
      map.set(String(row._id), row);
    }
  }
  return map;
}

/**
 * Sync all registered collections local → Atlas ($set + $unset vs batched Atlas snapshot),
 * then remove Atlas docs with createdAt older than 6 months. Never deletes on local.
 */
async function syncAllLocalToAtlas() {
  if (syncInProgress) {
    console.warn("[Sync] Skipped — previous run still in progress");
    return {
      success: false,
      skipped: true,
      atlasAvailable: !!getAtlasModels(),
      totalCandidates: 0,
      synced: 0,
      failed: 0,
      deletedFromAtlas: 0,
      deletedByCollection: {},
      durationMs: 0,
      syncErrors: [
        {
          collectionName: "",
          id: "",
          message: "Sync already in progress",
        },
      ],
    };
  }

  syncInProgress = true;
  const started = Date.now();
  const cutoff = sixMonthsAgo();
  const atlasModels = getAtlasModels();
  const localModels = getLocalModelsOrdered();

  const result = {
    success: true,
    atlasAvailable: !!atlasModels,
    totalCandidates: 0,
    synced: 0,
    failed: 0,
    deletedFromAtlas: 0,
    deletedByCollection: {},
    durationMs: 0,
    syncErrors: [],
  };

  try {
    if (!atlasModels) {
      result.success = false;
      console.error(
        "[Sync] FAILURE: Atlas models not available — set MONGO_ATLAS_URI and ensure connection succeeds."
      );
      result.durationMs = Date.now() - started;
      scheduleSyncLogPersist(result);
      return result;
    }

    const syncTime = new Date();
    const candidateFilter = buildCandidateFilter(cutoff);

    for (const LocalModel of localModels) {
      const name = LocalModel.modelName;
      const AtlasModel = atlasModels[name];
      if (!AtlasModel) {
        console.error(`[Sync] Atlas model missing for ${name}, skipping.`);
        continue;
      }

      let candidates;
      try {
        candidates = await LocalModel.find(candidateFilter).lean();
      } catch (err) {
        console.error(`[Sync] FAILURE querying local ${name}:`, err.message);
        result.success = false;
        result.failed += 1;
        if (result.syncErrors.length < MAX_ERRORS_IN_RESPONSE) {
          result.syncErrors.push({
            collectionName: name,
            id: "",
            message: `find failed: ${err.message}`,
          });
        }
        continue;
      }

      result.totalCandidates += candidates.length;
      if (candidates.length > 0) {
        console.log(
          `[Sync] ${name}: ${candidates.length} candidate(s) (createdAt ≥ cutoff, pending Atlas push)`
        );
      }

      const ids = candidates.map((d) => d._id);
      let atlasById = new Map();
      if (ids.length > 0) {
        try {
          atlasById = await fetchAtlasDocsByIds(AtlasModel.collection, ids);
        } catch (err) {
          console.error(`[Sync] FAILURE prefetch Atlas ${name}:`, err.message);
          result.success = false;
          result.failed += 1;
          if (result.syncErrors.length < MAX_ERRORS_IN_RESPONSE) {
            result.syncErrors.push({
              collectionName: name,
              id: "",
              message: `Atlas prefetch: ${err.message}`,
            });
          }
          continue;
        }
      }

      for (const doc of candidates) {
        const atlasDoc = atlasById.get(String(doc._id)) || null;
        const update = buildAtlasUpdate(doc, atlasDoc);

        if (
          !atlasDoc &&
          (!update.$set || Object.keys(update.$set).length === 0)
        ) {
          console.warn(
            `[Sync] Skip ${name} ${doc._id}: empty local payload for new Atlas upsert`
          );
          continue;
        }

        if (Object.keys(update).length === 0) {
          continue;
        }

        try {
          await AtlasModel.collection.updateOne(
            { _id: doc._id },
            update,
            { upsert: true }
          );
          await LocalModel.collection.updateOne(
            { _id: doc._id },
            { $set: { lastSyncedAt: syncTime } }
          );
          result.synced += 1;
        } catch (err) {
          result.failed += 1;
          result.success = false;
          const idStr = String(doc._id);
          console.error(`[Sync] FAILURE ${name} ${idStr}:`, err.message);
          if (result.syncErrors.length < MAX_ERRORS_IN_RESPONSE) {
            result.syncErrors.push({
              collectionName: name,
              id: idStr,
              message: err.message,
            });
          }
        }
      }
    }

    console.log(
      `[Sync] Upsert phase done: totalCandidates=${result.totalCandidates}, synced=${result.synced}, failed=${result.failed}`
    );

    for (const LocalModel of localModels) {
      const name = LocalModel.modelName;
      const AtlasModel = atlasModels[name];
      if (!AtlasModel) continue;
      try {
        const del = await AtlasModel.deleteMany({
          createdAt: { $lt: cutoff },
        });
        const n = del.deletedCount || 0;
        if (n > 0) {
          result.deletedByCollection[name] = n;
          result.deletedFromAtlas += n;
          console.log(
            `[Sync] Atlas cleanup ${name}: deleted ${n} doc(s) with createdAt < cutoff`
          );
        }
      } catch (err) {
        result.success = false;
        console.error(`[Sync] FAILURE Atlas cleanup ${name}:`, err.message);
        if (result.syncErrors.length < MAX_ERRORS_IN_RESPONSE) {
          result.syncErrors.push({
            collectionName: name,
            id: "",
            message: `Atlas cleanup: ${err.message}`,
          });
        }
      }
    }

    result.durationMs = Date.now() - started;
    if (result.failed === 0 && result.success) {
      console.log(
        `[Sync] SUCCESS in ${result.durationMs}ms (deletedFromAtlas=${result.deletedFromAtlas})`
      );
    } else {
      console.error(
        `[Sync] Finished with issues in ${result.durationMs}ms — synced=${result.synced}, failed=${result.failed}, deletedFromAtlas=${result.deletedFromAtlas}`
      );
    }

    scheduleSyncLogPersist(result);
    return result;
  } finally {
    syncInProgress = false;
  }
}

module.exports = {
  syncAllLocalToAtlas,
  buildCandidateFilter,
  sixMonthsAgo,
  buildAtlasUpdate,
  toSetPayload,
};
