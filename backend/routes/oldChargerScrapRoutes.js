const express = require("express");
const router = express.Router();
const {
  createOldChargerScrap,
  getOldChargerScraps,
  deleteOldChargerScrap,
} = require("../controllers/oldChargerScrapController");

router.route("/").post(createOldChargerScrap).get(getOldChargerScraps);
router.route("/:id").delete(deleteOldChargerScrap);

module.exports = router;
