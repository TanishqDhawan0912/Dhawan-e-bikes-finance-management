const express = require("express");
const { safe } = require("./_safeHandler");
const {
  createJobcard,
  getJobcards,
  getJobcardById,
  updateJobcard,
  finalizeJobcard,
  settleJobcard,
  deleteJobcard,
  markJobcardSynced,
  setJobcardPartManualUnitCost,
} = require("../controllers/jobcardController");
// const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes (for now, add auth later)
// router.use(protect);

// Jobcard routes
router.route("/").post(safe(createJobcard)).get(safe(getJobcards));

router
  .route("/:id")
  .get(safe(getJobcardById))
  .put(safe(updateJobcard))
  .delete(safe(deleteJobcard));

router.route("/:id/finalize").put(safe(finalizeJobcard));

router.route("/:id/settle").put(safe(settleJobcard));

// Jobcard sync: sets lastSyncedAt on the Jobcard document (collection jobcards)
router.route("/:id/synced").patch(safe(markJobcardSynced));

// Manual unit purchase cost override for a jobcard part (profit calc)
router
  .route("/:id/parts/:partId/manual-unit-cost")
  .patch(safe(setJobcardPartManualUnitCost));

module.exports = router;


