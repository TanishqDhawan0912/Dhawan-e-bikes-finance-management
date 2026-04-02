const express = require("express");
const { restoreAny } = require("../controllers/restoreController");

const router = express.Router();

router.patch("/restore/:id", restoreAny);

module.exports = router;

