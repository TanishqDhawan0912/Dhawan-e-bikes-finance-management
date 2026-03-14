const express = require("express");
const router = express.Router();
const {
  createOldChargerScrap,
  getOldChargerScraps,
} = require("../controllers/oldChargerScrapController");

router.route("/").post(createOldChargerScrap).get(getOldChargerScraps);

module.exports = router;
