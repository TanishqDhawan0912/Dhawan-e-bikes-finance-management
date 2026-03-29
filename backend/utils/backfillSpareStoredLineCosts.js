const mongoose = require("mongoose");
const Bill = require("../models/Bill");
const Jobcard = require("../models/Jobcard");
const { estimateSpareUnitPurchaseCost } = require("./sparePurchaseCostEstimate");

/**
 * Bills and jobcards store FIFO cost at transaction time. If purchase prices were
 * missing (stored as 0), later correcting spare layer prices should update those
 * lines so finance/profit uses the new estimate.
 *
 * Only updates rows where stored cost is still 0 (does not overwrite non-zero FIFO).
 */
async function backfillZeroStoredCostsForSpare(spareId, spareDoc) {
  const oid =
    spareId instanceof mongoose.Types.ObjectId
      ? spareId
      : new mongoose.Types.ObjectId(String(spareId));
  const idStr = oid.toString();
  const unit = estimateSpareUnitPurchaseCost(spareDoc);
  if (!(unit > 0)) {
    return {
      billsTouched: 0,
      jobcardsTouched: 0,
      billLines: 0,
      jobcardLines: 0,
    };
  }

  let billsTouched = 0;
  let billLines = 0;
  const bills = await Bill.find({
    accessoryDetails: { $elemMatch: { id: idStr } },
  });

  for (const bill of bills) {
    let modified = false;
    for (const a of bill.accessoryDetails || []) {
      if (String(a.id || "") !== idStr) continue;
      const u = Number(a.unitPurchaseCost) || 0;
      if (u > 0) continue;
      a.unitPurchaseCost = unit;
      billLines++;
      modified = true;
    }
    if (modified) {
      bill.markModified("accessoryDetails");
      await bill.save();
      billsTouched++;
    }
  }

  let jobcardsTouched = 0;
  let jobcardLines = 0;
  const jobcards = await Jobcard.find({ "parts.spareId": oid });

  for (const jc of jobcards) {
    let modified = false;
    for (const p of jc.parts || []) {
      if (!p.spareId || String(p.spareId) !== idStr) continue;
      if (String(p.partType || "").toLowerCase() !== "service") continue;
      const u = Number(p.fifoLinePurchaseCost) || 0;
      if (u > 0) continue;
      const qty = Math.max(1, Number(p.quantity) || 1);
      p.fifoLinePurchaseCost = Math.round(unit * qty * 10000) / 10000;
      jobcardLines++;
      modified = true;
    }
    if (modified) {
      jc.markModified("parts");
      await jc.save();
      jobcardsTouched++;
    }
  }

  return {
    billsTouched,
    jobcardsTouched,
    billLines,
    jobcardLines,
  };
}

module.exports = { backfillZeroStoredCostsForSpare };
