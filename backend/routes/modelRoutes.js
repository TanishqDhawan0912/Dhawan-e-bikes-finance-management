const express = require("express");
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
router.route("/").post(createModel).get(getModels);

router.route("/check-duplicate").get(checkDuplicateModel);

router.route("/check-duplicate-edit").get(checkDuplicateEdit);

router.route("/check-purchase-price").get(checkPurchasePrice);

router.route("/suggestions").get(getModelSuggestions);

router.route("/all-model-names").get(getAllModelNames);

router.route("/all-companies").get(getAllCompanies);

router.route("/company-suggestions").get(getCompanySuggestions);

router.route("/analytics").get(getModelAnalytics);

router.route("/:id").get(getModelById).put(updateModel).delete(deleteModel);

router.route("/:id/quantity").put(updateModelQuantity);

module.exports = router;
