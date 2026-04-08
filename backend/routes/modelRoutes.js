const express = require("express");
const { safe } = require("./_safeHandler");
const {
  createModel,
  getModels,
  getModelById,
  updateModel,
  deleteModel,
  updateModelQuantity,
  getModelAnalytics,
  checkDuplicateModel,
  checkDuplicateEdit,
  checkPurchasePrice,
  getModelSuggestions,
  getCompanySuggestions,
  getAllCompanies,
  getAllModelNames,
} = require("../controllers/modelController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes (for now, add auth later)
// router.use(protect);

// Model routes
router.route("/").post(safe(createModel)).get(safe(getModels));

router.route("/check-duplicate").get(safe(checkDuplicateModel));

router.route("/check-duplicate-edit").get(safe(checkDuplicateEdit));

router.route("/check-purchase-price").get(safe(checkPurchasePrice));

router.route("/suggestions").get(safe(getModelSuggestions));

router.route("/all-model-names").get(safe(getAllModelNames));

router.route("/all-companies").get(safe(getAllCompanies));

router.route("/company-suggestions").get(safe(getCompanySuggestions));

router.route("/analytics").get(safe(getModelAnalytics));

router
  .route("/:id")
  .get(safe(getModelById))
  .put(safe(updateModel))
  .delete(safe(deleteModel));

router.route("/:id/quantity").put(safe(updateModelQuantity));

module.exports = router;
