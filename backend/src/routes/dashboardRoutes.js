const express = require("express");
const router = express.Router();
const {
  getSummary,
  getAppointmentsTrend,
  getRevenueTrend,
  getDoctorLoad,
} = require("../controllers/dashboardController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);
router.use(authorize("ADMIN")); // dashboard analytics are admin-only

router.get("/summary", getSummary);
router.get("/appointments-trend", getAppointmentsTrend);
router.get("/revenue-trend", getRevenueTrend);
router.get("/doctor-load", getDoctorLoad);

module.exports = router;
