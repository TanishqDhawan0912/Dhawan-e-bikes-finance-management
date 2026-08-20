const express = require("express");
const { safe } = require("./_safeHandler");
const {
  upsertCustomer,
  updateCustomer,
  getCustomers,
  getCustomerHistoryById,
  updateCustomerType,
} = require("../controllers/customerController");

const router = express.Router();

router.route("/").post(safe(upsertCustomer)).get(safe(getCustomers));
router.route("/:id").put(safe(updateCustomer));
router.route("/:id/history").get(safe(getCustomerHistoryById));
router.route("/:id/type").patch(safe(updateCustomerType));

module.exports = router;
