const express = require("express");
const router = express.Router();
const {
  createOldCharger,
  getOldChargers,
  deleteOldCharger,
  getOldChargerSummary,
  updateOldChargerSummary,
} = require("../controllers/oldChargerController");

router.route("/").post(createOldCharger).get(getOldChargers);
router.route("/summary").get(getOldChargerSummary).put(updateOldChargerSummary);
router.route("/:id").delete(deleteOldCharger);

module.exports = router;







