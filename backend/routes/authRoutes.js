const express = require("express");
const { safe } = require("./_safeHandler");
const {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updateDetails,
  updatePassword,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", safe(register));
router.post("/login", safe(login));
router.get("/logout", safe(logout));
router.get("/me", protect, safe(getMe));
router.put("/updatedetails", protect, safe(updateDetails));
router.put("/updatepassword", protect, safe(updatePassword));
router.post("/forgotpassword", safe(forgotPassword));
router.put("/resetpassword/:resettoken", safe(resetPassword));

module.exports = router;
