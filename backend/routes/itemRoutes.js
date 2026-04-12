const express = require("express");
const { safe } = require("./_safeHandler");
const { searchItemsByVoice } = require("../controllers/itemController");

const router = express.Router();

router.post("/search-by-voice", safe(searchItemsByVoice));

module.exports = router;
