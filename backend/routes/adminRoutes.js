const express = require("express");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

// @desc    Authenticate admin with security key
// @route   POST /api/admin/auth
// @access  Public
router.post("/auth", adminAuth, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Admin authentication successful",
    authenticated: true,
  });
});

module.exports = router;
