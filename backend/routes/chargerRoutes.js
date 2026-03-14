const express = require("express");
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
router.route("/").post(createCharger).get(getChargers);

// Suggestion routes (must be before /:id route)
router.get("/suggestions/name", getChargerNameSuggestions);
router.get("/suggestions/supplier", getSupplierSuggestions);
router.get("/suggestions/batteryType", getBatteryTypeSuggestions);
router.get("/suggestions/voltage", getVoltageSuggestions);

// Duplicate check route (must be before /:id route)
router.get("/check-duplicate", checkDuplicateCharger);

// ID-based routes (must be last)
router.route("/:id").get(getChargerById).put(updateCharger).delete(deleteCharger);

module.exports = router;


