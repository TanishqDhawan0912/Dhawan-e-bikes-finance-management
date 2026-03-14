const express = require("express");
const {
  createSpare,
  getSpares,
  getSpareById,
  updateSpare,
  updateSpareStock,
  deleteSpare,
  getStockAnalytics,
  getSpareNameSuggestions,
  getModelSuggestions,
  getSupplierSuggestions,
  checkDuplicateSpare,
} = require("../controllers/spareController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes (for now, add auth later)
// router.use(protect);

// Spare routes
router.route("/").post(createSpare).get(getSpares);

router.route("/analytics/stock").get(getStockAnalytics);

// Suggestion routes (must be before /:id route)
router.get("/suggestions/names", getSpareNameSuggestions);
router.get("/suggestions/models", getModelSuggestions);
router.get("/suggestions/suppliers", getSupplierSuggestions);

// Duplicate check route (must be before /:id route)
router.get("/check-duplicate", checkDuplicateSpare);

// ID-based routes (must be last)
router.route("/:id").get(getSpareById).put(updateSpare).delete(deleteSpare);

router.route("/:id/stock").put(updateSpareStock);

module.exports = router;
