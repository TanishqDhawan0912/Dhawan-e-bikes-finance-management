const express = require("express");
const { safe } = require("./_safeHandler");
const { protect } = require("../middleware/authMiddleware");
const {
  getCustomerQrToken,
  scanQrToken,
} = require("../controllers/qrController");

const router = express.Router();

router.get("/customers/:id/token", safe(getCustomerQrToken));
router.post("/scan", protect, safe(scanQrToken));

module.exports = router;
