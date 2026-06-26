const prisma = require("../lib/db");
const { medicalRecordSchema } = require("../lib/validators");
const { logAudit } = require("../lib/audit");
const { getAuthUser, requireRole, withErrorHandling } = require("../lib/auth");
const { applyCors } = require("../lib/cors");

/**
 * GET    /api/medical-records           -> list (filters via query params)
 * POST   /api/medical-records           -> create
 * GET    /api/medical-records?id=xxx    -> get one
 * PUT    /api/medical-records?id=xxx    -> update
 */
module.exports = withErrorHandling(async (req, res) => {
  if (applyCors(req, res)) return;
  const authUser = getAuthUser(req);
  const { id } = req.query;

  if (id) {
    if (req.method === "GET") {
      const record = await prisma.medicalRecord.findUnique({
        where: { id },
        include: { patient: true, doctor: { include: { user: true } }, appointment: true },
      });
      if (!record) { const e = new Error("Medical record not found."); e.statusCode = 404; throw e; }
      return res.json({ record });
    }

    if (req.method === "PUT") {
      requireRole(authUser, "ADMIN", "DOCTOR");
      const data = medicalRecordSchema.partial().parse(req.body);
      const updateData = { ...data };
      if (data.followUpDate) updateData.followUpDate = new Date(data.followUpDate);

      const record = await prisma.medicalRecord.update({ where: { id }, data: updateData });
      await logAudit({ userId: authUser.id, action: "UPDATE_MEDICAL_RECORD", entity: "MedicalRecord", entityId: record.id });
      return res.json({ record });
    }

    return res.status(405).json({ error: "Method not allowed." });
  }

  if (req.method === "GET") {
    const { patientId, doctorId, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (pageNum - 1) * take;

    const where = { ...(patientId && { patientId }), ...(doctorId && { doctorId }) };

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

    return res.json({
      records,
      pagination: { total, page: pageNum, limit: take, totalPages: Math.ceil(total / take) },
    });
  }

  if (req.method === "POST") {
    requireRole(authUser, "ADMIN", "DOCTOR");
    const data = medicalRecordSchema.parse(req.body);

    const record = await prisma.medicalRecord.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId,
        appointmentId: data.appointmentId || null,
        authorId: authUser.id,
        diagnosis: data.diagnosis,
        symptoms: data.symptoms,
        prescription: data.prescription,
        labTests: data.labTests,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        notes: data.notes,
      },
      include: { patient: true, doctor: { include: { user: true } } },
    });

    if (data.appointmentId) {
      await prisma.appointment.update({ where: { id: data.appointmentId }, data: { status: "COMPLETED" } });
    }

    await logAudit({ userId: authUser.id, action: "CREATE_MEDICAL_RECORD", entity: "MedicalRecord", entityId: record.id });
    return res.status(201).json({ record });
  }

  return res.status(405).json({ error: "Method not allowed." });
});
