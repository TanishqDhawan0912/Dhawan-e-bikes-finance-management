const express = require("express");
const { safe } = require("./_safeHandler");
const {
  createSpare,
  getSpares,
  getSpareById,
  updateSpare,
  updateSpareStock,
  setSparePurchasePrice,
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
router.route("/").post(safe(createSpare)).get(safe(getSpares));

router.route("/analytics/stock").get(safe(getStockAnalytics));

// Suggestion routes (must be before /:id route)
router.get("/suggestions/names", safe(getSpareNameSuggestions));
router.get("/suggestions/models", safe(getModelSuggestions));
router.get("/suggestions/suppliers", safe(getSupplierSuggestions));

// Duplicate check route (must be before /:id route)
router.get("/check-duplicate", safe(checkDuplicateSpare));

// ID-based routes (must be last)
router
  .route("/:id")
  .get(safe(getSpareById))
  .put(safe(updateSpare))
  .delete(safe(deleteSpare));

router.route("/:id/stock").put(safe(updateSpareStock));

router.route("/:id/purchase-price").patch(safe(setSparePurchasePrice));

module.exports = router;
