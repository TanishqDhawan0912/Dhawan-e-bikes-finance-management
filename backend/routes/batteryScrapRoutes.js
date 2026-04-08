const express = require("express");
const router = express.Router();
const { safe } = require("./_safeHandler");
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

router.route("/").post(safe(createBatteryScrap)).get(safe(getBatteryScraps));
// Must be before /:id so "upsert" is not treated as an ObjectId
router.route("/upsert").post(safe(upsertBatteryScrap));
router.route("/:id").put(safe(updateBatteryScrap)).delete(safe(deleteBatteryScrap));

module.exports = router;


