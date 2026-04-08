const express = require("express");
const router = express.Router();
const { safe } = require("./_safeHandler");
const {
  createOldChargerScrap,
  getOldChargerScraps,
  deleteOldChargerScrap,
} = require("../controllers/oldChargerScrapController");

router.route("/").post(safe(createOldChargerScrap)).get(safe(getOldChargerScraps));
router.route("/:id").delete(safe(deleteOldChargerScrap));

module.exports = router;
