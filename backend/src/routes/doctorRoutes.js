const express = require("express");
const router = express.Router();
const {
  listDoctors,
  getDoctor,
  updateDoctor,
  updateDoctorStatus,
  addSchedule,
  removeSchedule,
  getAvailability,
} = require("../controllers/doctorController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

router.get("/", listDoctors);
router.get("/:id", getDoctor);
router.get("/:id/availability", getAvailability);

router.put("/:id", authorize("ADMIN", "DOCTOR"), updateDoctor);
router.put("/:id/status", authorize("ADMIN", "RECEPTIONIST"), updateDoctorStatus);
router.post("/:id/schedules", authorize("ADMIN", "DOCTOR"), addSchedule);
router.delete("/:id/schedules/:scheduleId", authorize("ADMIN", "DOCTOR"), removeSchedule);

module.exports = router;
