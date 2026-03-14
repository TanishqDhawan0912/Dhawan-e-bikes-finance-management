const express = require("express");
const router = express.Router();
const {
  createOldScooty,
  getOldScooties,
  updateOldScooty,
  deleteOldScooty,
} = require("../controllers/oldScootyController");

router.route("/").post(createOldScooty).get(getOldScooties);
router.route("/:id").put(updateOldScooty).delete(deleteOldScooty);

module.exports = router;
