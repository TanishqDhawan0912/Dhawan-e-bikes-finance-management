const express = require("express");
const {
  createJobcard,
  getJobcards,
  getJobcardById,
  updateJobcard,
  finalizeJobcard,
  settleJobcard,
  deleteJobcard,
} = require("../controllers/jobcardController");
// const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes (for now, add auth later)
// router.use(protect);

// Jobcard routes
router.route("/").post(createJobcard).get(getJobcards);

router.route("/:id").get(getJobcardById).put(updateJobcard).delete(deleteJobcard);

router.route("/:id/finalize").put(finalizeJobcard);

router.route("/:id/settle").put(settleJobcard);

module.exports = router;


