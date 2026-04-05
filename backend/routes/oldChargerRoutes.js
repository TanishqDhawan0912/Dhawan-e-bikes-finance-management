const express = require("express");
const router = express.Router();
const {
  createOldCharger,
  getOldChargers,
  deleteOldCharger,
  updateOldCharger,
  getOldChargerSummary,
  updateOldChargerSummary,
} = require("../controllers/oldChargerController");

router.route("/").post(createOldCharger).get(getOldChargers);
router.route("/summary").get(getOldChargerSummary).put(updateOldChargerSummary);
router.route("/:id").put(updateOldCharger).delete(deleteOldCharger);

module.exports = router;







