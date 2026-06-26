const express = require("express");
const router = express.Router();
const {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
} = require("../controllers/patientController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

// All staff roles can view patients
router.get("/", listPatients);
router.get("/:id", getPatient);

// Admin + Receptionist can register/edit patients
router.post("/", authorize("ADMIN", "RECEPTIONIST"), createPatient);
router.put("/:id", authorize("ADMIN", "RECEPTIONIST"), updatePatient);

// Only Admin can delete patient records
router.delete("/:id", authorize("ADMIN"), deletePatient);

module.exports = router;
