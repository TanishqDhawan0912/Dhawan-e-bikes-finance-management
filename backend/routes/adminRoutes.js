const express = require("express");
const crypto = require("crypto");
const adminAuth = require("../middleware/adminAuth");
const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");

const router = express.Router();

// @desc    Authenticate admin with security key
// @route   POST /api/admin/auth
// @access  Public
router.post("/auth", adminAuth, async (req, res, next) => {
  try {
    let user = process.env.ADMIN_USER_ID
      ? await User.findById(process.env.ADMIN_USER_ID).select("-password")
      : await User.findOne({ role: "admin" }).select("-password");

    if (!user) {
      user = await User.create({
        name: process.env.ADMIN_USER_NAME || "Dhawan E-Bikes Admin",
        email: process.env.ADMIN_USER_EMAIL || "admin@dhawanebikes.com",
        password: crypto.randomBytes(32).toString("hex"),
        role: "admin",
        isActive: true,
      });
    }

    if (!user || !user.isActive || user.role !== "admin") {
      return next(new ErrorResponse("Admin access is not authorized", 401));
    }

    const token = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      message: "Admin authentication successful",
      authenticated: true,
      token,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
