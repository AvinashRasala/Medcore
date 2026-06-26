const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/error");
const { appointmentSchema, updateAppointmentSchema } = require("../utils/validators");
const { logAudit } = require("../utils/audit");

/**
 * GET /api/appointments?doctorId=&patientId=&status=&date=&page=&limit=
 */
const listAppointments = asyncHandler(async (req, res) => {
  const { doctorId, patientId, status, date, page = "1", limit = "20" } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const take = Math.min(parseInt(limit, 10) || 20, 100);
  const skip = (pageNum - 1) * take;

  const where = {
    ...(doctorId && { doctorId }),
    ...(patientId && { patientId }),
    ...(status && { status }),
    ...(date && {
      scheduledAt: {
        gte: new Date(`${date}T00:00:00`),
        lte: new Date(`${date}T23:59:59`),
      },
    }),
  };

  // Doctors only see their own appointments unless they're also an admin
  if (req.user.role === "DOCTOR" && !doctorId) {
    const doctorProfile = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
    if (doctorProfile) where.doctorId = doctorProfile.id;
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      skip,
      take,
      include: {
        patient: true,
        doctor: { include: { user: { select: { name: true } } } },
      },
    }),
    prisma.appointment.count({ where }),
  ]);

  res.json({ appointments, pagination: { total, page: pageNum, limit: take, totalPages: Math.ceil(total / take) } });
});

/**
 * GET /api/appointments/:id
 */
const getAppointment = asyncHandler(async (req, res) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: {
      patient: true,
      doctor: { include: { user: true } },
      medicalRecord: true,
      bill: { include: { items: true } },
    },
  });
  if (!appointment) throw new ApiError(404, "Appointment not found.");
  res.json({ appointment });
});

/**
 * POST /api/appointments
 * Books a new appointment, rejecting if it conflicts with the doctor's
 * existing schedule (double-booking prevention).
 */
const createAppointment = asyncHandler(async (req, res) => {
  const data = appointmentSchema.parse(req.body);
  const scheduledAt = new Date(data.scheduledAt);
  const duration = data.durationMins || 30;

  const [patient, doctor] = await Promise.all([
    prisma.patient.findUnique({ where: { id: data.patientId } }),
    prisma.doctor.findUnique({ where: { id: data.doctorId } }),
  ]);
  if (!patient) throw new ApiError(404, "Patient not found.");
  if (!doctor) throw new ApiError(404, "Doctor not found.");

  // Conflict check: any existing non-cancelled appointment for this doctor
  // that overlaps the requested time window.
  const windowStart = scheduledAt;
  const windowEnd = new Date(scheduledAt.getTime() + duration * 60000);

  const existing = await prisma.appointment.findMany({
    where: {
      doctorId: data.doctorId,
      status: { not: "CANCELLED" },
      scheduledAt: {
        gte: new Date(windowStart.getTime() - 4 * 60 * 60000), // narrow search window
        lte: windowEnd,
      },
    },
  });

  const hasConflict = existing.some((appt) => {
    const apptStart = new Date(appt.scheduledAt);
    const apptEnd = new Date(apptStart.getTime() + appt.durationMins * 60000);
    return windowStart < apptEnd && windowEnd > apptStart;
  });

  if (hasConflict) {
    throw new ApiError(409, "This doctor already has an appointment that overlaps this time slot.");
  }

  const appointment = await prisma.appointment.create({
    data: {
      patientId: data.patientId,
      doctorId: data.doctorId,
      scheduledAt,
      durationMins: duration,
      reason: data.reason,
      notes: data.notes,
      createdById: req.user.id,
    },
    include: { patient: true, doctor: { include: { user: true } } },
  });

  await logAudit({ userId: req.user.id, action: "CREATE_APPOINTMENT", entity: "Appointment", entityId: appointment.id });
  res.status(201).json({ appointment });
});

/**
 * PUT /api/appointments/:id
 * Update status, reschedule, add notes.
 */
const updateAppointment = asyncHandler(async (req, res) => {
  const data = updateAppointmentSchema.parse(req.body);
  const updateData = { ...data };
  if (data.scheduledAt) updateData.scheduledAt = new Date(data.scheduledAt);

  const appointment = await prisma.appointment.update({
    where: { id: req.params.id },
    data: updateData,
    include: { patient: true, doctor: { include: { user: true } } },
  });

  await logAudit({ userId: req.user.id, action: "UPDATE_APPOINTMENT", entity: "Appointment", entityId: appointment.id, metadata: data });
  res.json({ appointment });
});

/**
 * DELETE /api/appointments/:id
 * Soft-cancel rather than hard delete, preserving history.
 */
const cancelAppointment = asyncHandler(async (req, res) => {
  const appointment = await prisma.appointment.update({
    where: { id: req.params.id },
    data: { status: "CANCELLED" },
  });
  await logAudit({ userId: req.user.id, action: "CANCEL_APPOINTMENT", entity: "Appointment", entityId: appointment.id });
  res.json({ appointment });
});

module.exports = { listAppointments, getAppointment, createAppointment, updateAppointment, cancelAppointment };
