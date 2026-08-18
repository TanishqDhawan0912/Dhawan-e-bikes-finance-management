const express = require("express");
const { safe } = require("./_safeHandler");
const {
  upsertCustomer,
  getCustomers,
  getCustomerHistoryById,
} = require("../controllers/customerController");

const router = express.Router();

router.route("/").post(safe(upsertCustomer)).get(safe(getCustomers));
router.route("/:id/history").get(safe(getCustomerHistoryById));

module.exports = router;
