const express = require("express");
const router = express.Router();
const { listBills, getBill, createBill, recordPayment, updateBill } = require("../controllers/billingController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

router.get("/", listBills);
router.get("/:id", getBill);

router.post("/", authorize("ADMIN", "RECEPTIONIST"), createBill);
router.put("/:id", authorize("ADMIN", "RECEPTIONIST"), updateBill);
router.post("/:id/payments", authorize("ADMIN", "RECEPTIONIST"), recordPayment);

module.exports = router;
