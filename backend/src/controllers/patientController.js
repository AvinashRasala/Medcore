const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/error");
const { patientSchema } = require("../utils/validators");
const { generatePatientCode } = require("../utils/codeGenerator");
const { logAudit } = require("../utils/audit");

/**
 * GET /api/patients?search=&page=&limit=
 * Supports search by name, phone, or patient code.
 */
const listPatients = asyncHandler(async (req, res) => {
  const { search = "", page = "1", limit = "20" } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const take = Math.min(parseInt(limit, 10) || 20, 100);
  const skip = (pageNum - 1) * take;

  const where = search
    ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { patientCode: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.patient.count({ where }),
  ]);

  res.json({ patients, pagination: { total, page: pageNum, limit: take, totalPages: Math.ceil(total / take) } });
});

/**
 * GET /api/patients/:id
 */
const getPatient = asyncHandler(async (req, res) => {
  const patient = await prisma.patient.findUnique({
    where: { id: req.params.id },
    include: {
      appointments: { orderBy: { scheduledAt: "desc" }, include: { doctor: { include: { user: true } } } },
      medicalRecords: { orderBy: { visitDate: "desc" }, include: { doctor: { include: { user: true } } } },
      bills: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!patient) throw new ApiError(404, "Patient not found.");
  res.json({ patient });
});

/**
 * POST /api/patients
 */
const createPatient = asyncHandler(async (req, res) => {
  const data = patientSchema.parse(req.body);
  const patientCode = await generatePatientCode();

  const patient = await prisma.patient.create({
    data: {
      ...data,
      dateOfBirth: new Date(data.dateOfBirth),
      email: data.email || null,
      patientCode,
    },
  });

  await logAudit({ userId: req.user.id, action: "CREATE_PATIENT", entity: "Patient", entityId: patient.id });
  res.status(201).json({ patient });
});

/**
 * PUT /api/patients/:id
 */
const updatePatient = asyncHandler(async (req, res) => {
  const data = patientSchema.partial().parse(req.body);
  const updateData = { ...data };
  if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);

  const patient = await prisma.patient.update({
    where: { id: req.params.id },
    data: updateData,
  });

  await logAudit({ userId: req.user.id, action: "UPDATE_PATIENT", entity: "Patient", entityId: patient.id });
  res.json({ patient });
});

/**
 * DELETE /api/patients/:id
 */
const deletePatient = asyncHandler(async (req, res) => {
  await prisma.patient.delete({ where: { id: req.params.id } });
  await logAudit({ userId: req.user.id, action: "DELETE_PATIENT", entity: "Patient", entityId: req.params.id });
  res.status(204).send();
});

module.exports = { listPatients, getPatient, createPatient, updatePatient, deletePatient };
