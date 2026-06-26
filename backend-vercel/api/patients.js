const prisma = require("../lib/db");
const { patientSchema } = require("../lib/validators");
const { generatePatientCode } = require("../lib/codeGenerator");
const { logAudit } = require("../lib/audit");
const { getAuthUser, requireRole, withErrorHandling } = require("../lib/auth");
const { applyCors } = require("../lib/cors");

/**
 * GET    /api/patients              -> list (search, page, limit)
 * POST   /api/patients              -> create
 * GET    /api/patients?id=xxx       -> get one (with full history)
 * PUT    /api/patients?id=xxx       -> update
 * DELETE /api/patients?id=xxx       -> delete
 *
 * Routing is by presence of ?id= rather than separate files/paths, to
 * keep this as a single serverless function (Vercel Hobby plan caps at
 * 12 functions total across the whole project).
 */
module.exports = withErrorHandling(async (req, res) => {
  if (applyCors(req, res)) return;
  const authUser = getAuthUser(req);
  const { id } = req.query;

  // ---------- single patient: GET / PUT / DELETE ----------
  if (id) {
    if (req.method === "GET") {
      const patient = await prisma.patient.findUnique({
        where: { id },
        include: {
          appointments: { orderBy: { scheduledAt: "desc" }, include: { doctor: { include: { user: true } } } },
          medicalRecords: { orderBy: { visitDate: "desc" }, include: { doctor: { include: { user: true } } } },
          bills: { orderBy: { createdAt: "desc" } },
        },
      });
      if (!patient) {
        const err = new Error("Patient not found.");
        err.statusCode = 404;
        throw err;
      }
      return res.json({ patient });
    }

    if (req.method === "PUT") {
      requireRole(authUser, "ADMIN", "RECEPTIONIST");
      const data = patientSchema.partial().parse(req.body);
      const updateData = { ...data };
      if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);

      const patient = await prisma.patient.update({ where: { id }, data: updateData });
      await logAudit({ userId: authUser.id, action: "UPDATE_PATIENT", entity: "Patient", entityId: patient.id });
      return res.json({ patient });
    }

    if (req.method === "DELETE") {
      requireRole(authUser, "ADMIN");
      await prisma.patient.delete({ where: { id } });
      await logAudit({ userId: authUser.id, action: "DELETE_PATIENT", entity: "Patient", entityId: id });
      return res.status(204).end();
    }

    return res.status(405).json({ error: "Method not allowed." });
  }

  // ---------- collection: GET (list) / POST (create) ----------
  if (req.method === "GET") {
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

    return res.json({
      patients,
      pagination: { total, page: pageNum, limit: take, totalPages: Math.ceil(total / take) },
    });
  }

  if (req.method === "POST") {
    requireRole(authUser, "ADMIN", "RECEPTIONIST");
    const data = patientSchema.parse(req.body);
    const patientCode = await generatePatientCode();

    const patient = await prisma.patient.create({
      data: { ...data, dateOfBirth: new Date(data.dateOfBirth), email: data.email || null, patientCode },
    });

    await logAudit({ userId: authUser.id, action: "CREATE_PATIENT", entity: "Patient", entityId: patient.id });
    return res.status(201).json({ patient });
  }

  return res.status(405).json({ error: "Method not allowed." });
});
