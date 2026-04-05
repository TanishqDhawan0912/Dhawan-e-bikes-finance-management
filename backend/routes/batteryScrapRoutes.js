const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  createBatteryScrap,
  getBatteryScraps,
  updateBatteryScrap,
  deleteBatteryScrap,
  upsertBatteryScrap,
} = require("../controllers/batteryScrapController");

// Public routes (same as battery routes - no auth required)
// router.use(protect);

router.route("/").post(createBatteryScrap).get(getBatteryScraps);
// Must be before /:id so "upsert" is not treated as an ObjectId
router.route("/upsert").post(upsertBatteryScrap);
router.route("/:id").put(updateBatteryScrap).delete(deleteBatteryScrap);

module.exports = router;


