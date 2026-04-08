const express = require("express");
const router = express.Router();
const { safe } = require("./_safeHandler");
const {
  createOldScooty,
  getOldScooties,
  updateOldScooty,
  deleteOldScooty,
} = require("../controllers/oldScootyController");

router.route("/").post(safe(createOldScooty)).get(safe(getOldScooties));
router.route("/:id").put(safe(updateOldScooty)).delete(safe(deleteOldScooty));

module.exports = router;
