const express = require("express");
const router = express.Router();
const {
  listMedicalRecords,
  getMedicalRecord,
  createMedicalRecord,
  updateMedicalRecord,
} = require("../controllers/medicalRecordController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

// All staff can view records; only Doctors + Admin can write/edit them
router.get("/", listMedicalRecords);
router.get("/:id", getMedicalRecord);
router.post("/", authorize("ADMIN", "DOCTOR"), createMedicalRecord);
router.put("/:id", authorize("ADMIN", "DOCTOR"), updateMedicalRecord);

module.exports = router;
