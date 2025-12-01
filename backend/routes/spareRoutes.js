const express = require("express");
const {
  createSpare,
  getSpares,
  getSpareById,
  updateSpare,
  updateSpareStock,
  deleteSpare,
  getStockAnalytics,
} = require("../controllers/spareController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes (for now, add auth later)
// router.use(protect);

// Spare routes
router.route("/").post(createSpare).get(getSpares);

router.route("/analytics/stock").get(getStockAnalytics);

router.route("/:id").get(getSpareById).put(updateSpare).delete(deleteSpare);

router.route("/:id/stock").put(updateSpareStock);

module.exports = router;
