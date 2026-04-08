const express = require("express");
const { safe } = require("./_safeHandler");
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
router.route("/").post(safe(createBattery)).get(safe(getBatteries));

// Suggestion routes (must be before /:id route)
router.get("/suggestions/name", safe(getBatteryNameSuggestions));
router.get("/suggestions/supplier", safe(getSupplierSuggestions));
router.get("/suggestions/ampere", safe(getAmpereValueSuggestions));

// Duplicate check route (must be before /:id route)
router.get("/check-duplicate", safe(checkDuplicateBattery));

// ID-based routes (must be last)
router
  .route("/:id")
  .get(safe(getBatteryById))
  .put(safe(updateBattery))
  .delete(safe(deleteBattery));

module.exports = router;

