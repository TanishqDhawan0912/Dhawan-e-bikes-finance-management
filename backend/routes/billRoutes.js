const express = require("express");
const {
  getBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
} = require("../controllers/billController");

const router = express.Router();

router.route("/").get(getBills).post(createBill);
router.route("/:id").get(getBillById).put(updateBill).delete(deleteBill);

module.exports = router;
