const express = require("express");
const { safe } = require("./_safeHandler");
const {
  createCharger,
  getChargers,
  getChargerById,
  updateCharger,
  deleteCharger,
  getChargerNameSuggestions,
  getSupplierSuggestions,
  getBatteryTypeSuggestions,
  getVoltageSuggestions,
  checkDuplicateCharger,
} = require("../controllers/chargerController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes (for now, add auth later)
// router.use(protect);

// Charger routes
router.route("/").post(safe(createCharger)).get(safe(getChargers));

// Suggestion routes (must be before /:id route)
router.get("/suggestions/name", safe(getChargerNameSuggestions));
router.get("/suggestions/supplier", safe(getSupplierSuggestions));
router.get("/suggestions/batteryType", safe(getBatteryTypeSuggestions));
router.get("/suggestions/voltage", safe(getVoltageSuggestions));

// Duplicate check route (must be before /:id route)
router.get("/check-duplicate", safe(checkDuplicateCharger));

// ID-based routes (must be last)
router
  .route("/:id")
  .get(safe(getChargerById))
  .put(safe(updateCharger))
  .delete(safe(deleteCharger));

module.exports = router;


