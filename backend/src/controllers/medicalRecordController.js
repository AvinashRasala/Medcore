const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/error");
const { medicalRecordSchema } = require("../utils/validators");
const { logAudit } = require("../utils/audit");

/**
 * GET /api/medical-records?patientId=&doctorId=&page=&limit=
 */
const listMedicalRecords = asyncHandler(async (req, res) => {
  const { patientId, doctorId, page = "1", limit = "20" } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const take = Math.min(parseInt(limit, 10) || 20, 100);
  const skip = (pageNum - 1) * take;

  const where = {
    ...(patientId && { patientId }),
    ...(doctorId && { doctorId }),
  };

  const [records, total] = await Promise.all([
    prisma.medicalRecord.findMany({
      where,
      orderBy: { visitDate: "desc" },
      skip,
      take,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
    }),
    prisma.medicalRecord.count({ where }),
  ]);

  res.json({ records, pagination: { total, page: pageNum, limit: take, totalPages: Math.ceil(total / take) } });
});

/**
 * GET /api/medical-records/:id
 */
const getMedicalRecord = asyncHandler(async (req, res) => {
  const record = await prisma.medicalRecord.findUnique({
    where: { id: req.params.id },
    include: {
      patient: true,
      doctor: { include: { user: true } },
      appointment: true,
    },
  });
  if (!record) throw new ApiError(404, "Medical record not found.");
  res.json({ record });
});

/**
 * POST /api/medical-records
 * Only Doctors (and Admins) should write medical records — enforced at the route level.
 */
const createMedicalRecord = asyncHandler(async (req, res) => {
  const data = medicalRecordSchema.parse(req.body);

  const record = await prisma.medicalRecord.create({
    data: {
      patientId: data.patientId,
      doctorId: data.doctorId,
      appointmentId: data.appointmentId || null,
      authorId: req.user.id,
      diagnosis: data.diagnosis,
      symptoms: data.symptoms,
      prescription: data.prescription,
      labTests: data.labTests,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      notes: data.notes,
    },
    include: { patient: true, doctor: { include: { user: true } } },
  });

  // If linked to an appointment, mark it completed automatically
  if (data.appointmentId) {
    await prisma.appointment.update({
      where: { id: data.appointmentId },
      data: { status: "COMPLETED" },
    });
  }

  await logAudit({ userId: req.user.id, action: "CREATE_MEDICAL_RECORD", entity: "MedicalRecord", entityId: record.id });
  res.status(201).json({ record });
});

/**
 * PUT /api/medical-records/:id
 */
const updateMedicalRecord = asyncHandler(async (req, res) => {
  const data = medicalRecordSchema.partial().parse(req.body);
  const updateData = { ...data };
  if (data.followUpDate) updateData.followUpDate = new Date(data.followUpDate);

  const record = await prisma.medicalRecord.update({
    where: { id: req.params.id },
    data: updateData,
  });

  await logAudit({ userId: req.user.id, action: "UPDATE_MEDICAL_RECORD", entity: "MedicalRecord", entityId: record.id });
  res.json({ record });
});

module.exports = { listMedicalRecords, getMedicalRecord, createMedicalRecord, updateMedicalRecord };
