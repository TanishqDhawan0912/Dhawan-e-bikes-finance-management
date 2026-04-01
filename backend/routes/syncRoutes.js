const express = require("express");
const { syncNow } = require("../controllers/syncController");

const router = express.Router();

router.post("/sync-now", syncNow);

module.exports = router;
