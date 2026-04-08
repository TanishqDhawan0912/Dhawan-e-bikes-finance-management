const express = require("express");
const { restoreAny } = require("../controllers/restoreController");
const { safe } = require("./_safeHandler");

const router = express.Router();

router.patch("/restore/:id", safe(restoreAny));

module.exports = router;

