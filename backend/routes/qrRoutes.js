const express = require("express");
const { safe } = require("./_safeHandler");
const { protect } = require("../middleware/authMiddleware");
const {
  getCustomerQrToken,
  getCustomerQrImage,
  scanQrToken,
} = require("../controllers/qrController");

const router = express.Router();

router.get("/customers/:id/token", safe(getCustomerQrToken));
router.get("/customers/:id/image", safe(getCustomerQrImage));
router.post("/scan", protect, safe(scanQrToken));

module.exports = router;
