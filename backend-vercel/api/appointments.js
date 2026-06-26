const prisma = require("../lib/db");
const { appointmentSchema, updateAppointmentSchema } = require("../lib/validators");
const { logAudit } = require("../lib/audit");
const { getAuthUser, requireRole, withErrorHandling } = require("../lib/auth");
const { applyCors } = require("../lib/cors");

/**
 * GET    /api/appointments          -> list (filters via query params)
 * POST   /api/appointments          -> create (with conflict checking)
 * GET    /api/appointments?id=xxx   -> get one
 * PUT    /api/appointments?id=xxx   -> update / change status
 * DELETE /api/appointments?id=xxx   -> cancel (soft delete)
 */
module.exports = withErrorHandling(async (req, res) => {
  if (applyCors(req, res)) return;
  const authUser = getAuthUser(req);
  const { id } = req.query;

  // ---------- single appointment ----------
  if (id) {
    if (req.method === "GET") {
      const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
          patient: true,
          doctor: { include: { user: true } },
          medicalRecord: true,
          bill: { include: { items: true } },
        },
      });
      if (!appointment) { const e = new Error("Appointment not found."); e.statusCode = 404; throw e; }
      return res.json({ appointment });
    }

    if (req.method === "PUT") {
      requireRole(authUser, "ADMIN", "RECEPTIONIST", "DOCTOR");
      const data = updateAppointmentSchema.parse(req.body);
      const updateData = { ...data };
      if (data.scheduledAt) updateData.scheduledAt = new Date(data.scheduledAt);

      const appointment = await prisma.appointment.update({
        where: { id },
        data: updateData,
        include: { patient: true, doctor: { include: { user: true } } },
      });

      await logAudit({ userId: authUser.id, action: "UPDATE_APPOINTMENT", entity: "Appointment", entityId: appointment.id, metadata: data });
      return res.json({ appointment });
    }

    if (req.method === "DELETE") {
      requireRole(authUser, "ADMIN", "RECEPTIONIST");
      const appointment = await prisma.appointment.update({ where: { id }, data: { status: "CANCELLED" } });
      await logAudit({ userId: authUser.id, action: "CANCEL_APPOINTMENT", entity: "Appointment", entityId: appointment.id });
      return res.json({ appointment });
    }

    return res.status(405).json({ error: "Method not allowed." });
  }

  // ---------- collection ----------
  if (req.method === "GET") {
    const { doctorId, patientId, status, date, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (pageNum - 1) * take;

    const where = {
      ...(doctorId && { doctorId }),
      ...(patientId && { patientId }),
      ...(status && { status }),
      ...(date && {
        scheduledAt: { gte: new Date(`${date}T00:00:00`), lte: new Date(`${date}T23:59:59`) },
      }),
    };

    if (authUser.role === "DOCTOR" && !doctorId) {
      const doctorProfile = await prisma.doctor.findUnique({ where: { userId: authUser.id } });
      if (doctorProfile) where.doctorId = doctorProfile.id;
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        orderBy: { scheduledAt: "asc" },
        skip,
        take,
        include: { patient: true, doctor: { include: { user: { select: { name: true } } } } },
      }),
      prisma.appointment.count({ where }),
    ]);

    return res.json({
      appointments,
      pagination: { total, page: pageNum, limit: take, totalPages: Math.ceil(total / take) },
    });
  }

  if (req.method === "POST") {
    requireRole(authUser, "ADMIN", "RECEPTIONIST");
    const data = appointmentSchema.parse(req.body);
    const scheduledAt = new Date(data.scheduledAt);
    const duration = data.durationMins || 30;

    const [patient, doctor] = await Promise.all([
      prisma.patient.findUnique({ where: { id: data.patientId } }),
      prisma.doctor.findUnique({ where: { id: data.doctorId } }),
    ]);
    if (!patient) { const e = new Error("Patient not found."); e.statusCode = 404; throw e; }
    if (!doctor) { const e = new Error("Doctor not found."); e.statusCode = 404; throw e; }

    const windowStart = scheduledAt;
    const windowEnd = new Date(scheduledAt.getTime() + duration * 60000);

    const existing = await prisma.appointment.findMany({
      where: {
        doctorId: data.doctorId,
        status: { not: "CANCELLED" },
        scheduledAt: { gte: new Date(windowStart.getTime() - 4 * 60 * 60000), lte: windowEnd },
      },
    });

    const hasConflict = existing.some((appt) => {
      const apptStart = new Date(appt.scheduledAt);
      const apptEnd = new Date(apptStart.getTime() + appt.durationMins * 60000);
      return windowStart < apptEnd && windowEnd > apptStart;
    });

    if (hasConflict) {
      const e = new Error("This doctor already has an appointment that overlaps this time slot.");
      e.statusCode = 409;
      throw e;
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId,
        scheduledAt,
        durationMins: duration,
        reason: data.reason,
        notes: data.notes,
        createdById: authUser.id,
      },
      include: { patient: true, doctor: { include: { user: true } } },
    });

    await logAudit({ userId: authUser.id, action: "CREATE_APPOINTMENT", entity: "Appointment", entityId: appointment.id });
    return res.status(201).json({ appointment });
  }

  return res.status(405).json({ error: "Method not allowed." });
});
