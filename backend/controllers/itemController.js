const Spare = require("../models/Spare");
const { fuzzySoundScore } = require("../utils/stringSimilarity");

/** Final ranked results cap */
const MAX_RESULTS = 300;
/** Per-query limit so one broad branch cannot starve another (union dedupes by _id). */
const PER_BRANCH_LIMIT = 2500;

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function queryTokens(query) {
  return String(query)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/gi, ""))
    .filter((t) => t.length >= 2);
}

function relevanceScore(doc, rawQuery, tokens) {
  const n = String(doc.name || "").toLowerCase();
  const sup = String(doc.supplierName || "").toLowerCase();
  const q = String(rawQuery || "").trim().toLowerCase();
  let score = 0;
  if (q.length >= 2) {
    if (n.includes(q)) score += 25;
    else if (sup.includes(q)) score += 15;
  }
  for (const t of tokens) {
    if (t.length >= 2) {
      if (n.includes(t)) score += 8;
      if (sup.includes(t)) score += 4;
    }
  }
  if (q.length === 1 && (n.includes(q) || sup.includes(q))) {
    score += 5;
  }
  return score;
}

function totalMatchScore(doc, rawQuery, tokens) {
  return relevanceScore(doc, rawQuery, tokens) + fuzzySoundScore(doc, tokens);
}

/**
 * Run several smaller finds and merge by _id so a single huge $or + .limit()
 * does not drop valid rows (e.g. 13 “Throttal” lines while only 12 fit in cap).
 */
async function gatherVoiceCandidates(query, tokens, escapedFull) {
  const map = new Map();
  const add = (docs) => {
    for (const d of docs) {
      map.set(String(d._id), d);
    }
  };

  const tasks = [];

  tasks.push(
    Spare.find({ name: { $regex: escapedFull, $options: "i" } })
      .limit(PER_BRANCH_LIMIT)
      .lean()
  );
  tasks.push(
    Spare.find({ supplierName: { $regex: escapedFull, $options: "i" } })
      .limit(PER_BRANCH_LIMIT)
      .lean()
  );

  for (const t of tokens) {
    const esc = escapeRegex(t);
    tasks.push(
      Spare.find({ name: { $regex: esc, $options: "i" } })
        .limit(PER_BRANCH_LIMIT)
        .lean()
    );
    tasks.push(
      Spare.find({ supplierName: { $regex: esc, $options: "i" } })
        .limit(PER_BRANCH_LIMIT)
        .lean()
    );
    if (t.length >= 4) {
      const f4 = escapeRegex(t.slice(0, 4));
      tasks.push(
        Spare.find({ name: { $regex: f4, $options: "i" } })
          .limit(PER_BRANCH_LIMIT)
          .lean()
      );
      tasks.push(
        Spare.find({ supplierName: { $regex: f4, $options: "i" } })
          .limit(PER_BRANCH_LIMIT)
          .lean()
      );
    }
    if (t.length >= 5) {
      const f3 = escapeRegex(t.slice(0, 3));
      tasks.push(
        Spare.find({ name: { $regex: f3, $options: "i" } })
          .limit(PER_BRANCH_LIMIT)
          .lean()
      );
      tasks.push(
        Spare.find({ supplierName: { $regex: f3, $options: "i" } })
          .limit(PER_BRANCH_LIMIT)
          .lean()
      );
    }
  }

  const batches = await Promise.all(tasks);
  for (const batch of batches) add(batch);
  return [...map.values()];
}

/**
 * Voice / text search — union of targeted branch queries + fuzzy word score.
 */
const searchItemsByVoice = async (req, res) => {
  try {
    const raw = req.body && req.body.query;
    const query = raw != null ? String(raw).trim() : "";
    if (!query) {
      return res.status(400).json({
        message: "query is required",
        items: [],
      });
    }

    const escapedFull = escapeRegex(query);
    const tokens = queryTokens(query);

    const candidates = await gatherVoiceCandidates(query, tokens, escapedFull);

    const scored = candidates.map((doc) => ({
      doc,
      score: totalMatchScore(doc, query, tokens),
    }));

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.doc.name || "").localeCompare(String(b.doc.name || ""));
    });

    const items = scored
      .filter((x) => x.score > 0)
      .slice(0, MAX_RESULTS)
      .map((x) => x.doc);

    res.json({ items, total: items.length, query });
  } catch (error) {
    console.error("searchItemsByVoice:", error);
    res.status(500).json({
      message: error.message || "Server error",
      items: [],
    });
  }
};

module.exports = {
  searchItemsByVoice,
};
