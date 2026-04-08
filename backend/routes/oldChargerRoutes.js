const express = require("express");
const router = express.Router();
const { safe } = require("./_safeHandler");
const {
  createOldCharger,
  getOldChargers,
  deleteOldCharger,
  updateOldCharger,
  getOldChargerSummary,
  updateOldChargerSummary,
} = require("../controllers/oldChargerController");

router.route("/").post(safe(createOldCharger)).get(safe(getOldChargers));
router
  .route("/summary")
  .get(safe(getOldChargerSummary))
  .put(safe(updateOldChargerSummary));
router.route("/:id").put(safe(updateOldCharger)).delete(safe(deleteOldCharger));

module.exports = router;







