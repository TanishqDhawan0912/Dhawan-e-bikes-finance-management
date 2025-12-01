const express = require("express");
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getProfitAnalytics,
} = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes (for now, add auth later)
// router.use(protect);

// Order routes
router.route("/").post(createOrder).get(getOrders);

router.route("/analytics/profit").get(getProfitAnalytics);

router.route("/:id").get(getOrderById);

router.route("/:id/status").put(updateOrderStatus);

module.exports = router;
