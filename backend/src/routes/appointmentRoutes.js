const express = require("express");
const router = express.Router();
const {
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  cancelAppointment,
} = require("../controllers/appointmentController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

router.get("/", listAppointments);
router.get("/:id", getAppointment);

// Admin + Receptionist book appointments; Doctors update status/notes
router.post("/", authorize("ADMIN", "RECEPTIONIST"), createAppointment);
router.put("/:id", authorize("ADMIN", "RECEPTIONIST", "DOCTOR"), updateAppointment);
router.delete("/:id", authorize("ADMIN", "RECEPTIONIST"), cancelAppointment);

module.exports = router;
