const express = require("express");
const { safe } = require("./_safeHandler");
const {
  getBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
} = require("../controllers/billController");

const router = express.Router();

router.route("/").get(safe(getBills)).post(safe(createBill));
router
  .route("/:id")
  .get(safe(getBillById))
  .put(safe(updateBill))
  .delete(safe(deleteBill));

module.exports = router;
