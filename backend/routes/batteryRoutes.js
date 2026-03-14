const express = require("express");
const {
  createBattery,
  getBatteries,
  getBatteryById,
  updateBattery,
  deleteBattery,
  getBatteryNameSuggestions,
  getSupplierSuggestions,
  getAmpereValueSuggestions,
  checkDuplicateBattery,
} = require("../controllers/batteryController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes (for now, add auth later)
// router.use(protect);

// Battery routes
router.route("/").post(createBattery).get(getBatteries);

// Suggestion routes (must be before /:id route)
router.get("/suggestions/name", getBatteryNameSuggestions);
router.get("/suggestions/supplier", getSupplierSuggestions);
router.get("/suggestions/ampere", getAmpereValueSuggestions);

// Duplicate check route (must be before /:id route)
router.get("/check-duplicate", checkDuplicateBattery);

// ID-based routes (must be last)
router.route("/:id").get(getBatteryById).put(updateBattery).delete(deleteBattery);

module.exports = router;

