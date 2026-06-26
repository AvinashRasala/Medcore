const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/error");
const { doctorScheduleSchema } = require("../utils/validators");
const { logAudit } = require("../utils/audit");

/**
 * GET /api/doctors?specialization=
 */
const listDoctors = asyncHandler(async (req, res) => {
  const { specialization } = req.query;
  const where = specialization
    ? { specialization: { contains: specialization, mode: "insensitive" } }
    : {};

  const doctors = await prisma.doctor.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, isActive: true, profilePhoto: true } },
      schedules: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ doctors });
});

/**
 * GET /api/doctors/:id
 */
const getDoctor = asyncHandler(async (req, res) => {
  const doctor = await prisma.doctor.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, isActive: true, profilePhoto: true } },
      schedules: true,
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 50,
        include: { patient: true },
      },
    },
  });
  if (!doctor) throw new ApiError(404, "Doctor not found.");
  res.json({ doctor });
});

/**
 * PUT /api/doctors/:id
 * Update doctor profile fields (specialization, fee, bio, etc.)
 */
const updateDoctor = asyncHandler(async (req, res) => {
  const { specialization, qualification, consultationFee, bio } = req.body;
  const doctor = await prisma.doctor.update({
    where: { id: req.params.id },
    data: {
      ...(specialization && { specialization }),
      ...(qualification !== undefined && { qualification }),
      ...(consultationFee !== undefined && { consultationFee }),
      ...(bio !== undefined && { bio }),
    },
  });
  await logAudit({ userId: req.user.id, action: "UPDATE_DOCTOR", entity: "Doctor", entityId: doctor.id });
  res.json({ doctor });
});

/**
 * PUT /api/doctors/:id/status
 * Deactivates or reactivates a doctor's account. This blocks them from
 * logging in but deliberately does NOT touch any of their historical
 * data — past appointments, medical records they authored, and bills
 * they created all remain fully intact and queryable, since patients'
 * medical history must be preserved even after a doctor leaves.
 */
const updateDoctorStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== "boolean") {
    throw new ApiError(400, "isActive must be true or false.");
  }

  const doctor = await prisma.doctor.findUnique({ where: { id: req.params.id }, include: { user: true } });
  if (!doctor) throw new ApiError(404, "Doctor not found.");

  await prisma.user.update({
    where: { id: doctor.userId },
    data: { isActive },
  });

  await logAudit({
    userId: req.user.id,
    action: isActive ? "REACTIVATE_DOCTOR" : "DEACTIVATE_DOCTOR",
    entity: "Doctor",
    entityId: doctor.id,
  });

  const updated = await prisma.doctor.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, name: true, email: true, phone: true, isActive: true, profilePhoto: true } } },
  });

  res.json({
    doctor: updated,
    message: isActive
      ? "Doctor account reactivated."
      : "Doctor account deactivated. Their appointment and medical record history remains unchanged.",
  });
});

/**
 * POST /api/doctors/:id/schedules
 * Add a recurring weekly availability block.
 */
const addSchedule = asyncHandler(async (req, res) => {
  const data = doctorScheduleSchema.parse(req.body);
  const schedule = await prisma.doctorSchedule.create({
    data: { ...data, doctorId: req.params.id },
  });
  res.status(201).json({ schedule });
});

/**
 * DELETE /api/doctors/:id/schedules/:scheduleId
 */
const removeSchedule = asyncHandler(async (req, res) => {
  await prisma.doctorSchedule.delete({ where: { id: req.params.scheduleId } });
  res.status(204).send();
});

/**
 * GET /api/doctors/:id/availability?date=YYYY-MM-DD
 * Computes open slots for a given day based on weekly schedule minus
 * already-booked appointments.
 */
const getAvailability = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) throw new ApiError(400, "Query param 'date' (YYYY-MM-DD) is required.");

  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();

  const schedules = await prisma.doctorSchedule.findMany({
    where: { doctorId: req.params.id, dayOfWeek },
  });

  if (schedules.length === 0) {
    return res.json({ date, slots: [] });
  }

  const startOfDay = new Date(`${date}T00:00:00`);
  const endOfDay = new Date(`${date}T23:59:59`);

  const bookedAppointments = await prisma.appointment.findMany({
    where: {
      doctorId: req.params.id,
      scheduledAt: { gte: startOfDay, lte: endOfDay },
      status: { not: "CANCELLED" },
    },
    select: { scheduledAt: true, durationMins: true },
  });

  const slots = [];
  for (const block of schedules) {
    const [startH, startM] = block.startTime.split(":").map(Number);
    const [endH, endM] = block.endTime.split(":").map(Number);
    const slotLen = block.slotMinutes || 30;

    let cursor = new Date(targetDate);
    cursor.setHours(startH, startM, 0, 0);
    const blockEnd = new Date(targetDate);
    blockEnd.setHours(endH, endM, 0, 0);

    while (cursor < blockEnd) {
      const slotEnd = new Date(cursor.getTime() + slotLen * 60000);
      const overlaps = bookedAppointments.some((appt) => {
        const apptStart = new Date(appt.scheduledAt);
        const apptEnd = new Date(apptStart.getTime() + appt.durationMins * 60000);
        return cursor < apptEnd && slotEnd > apptStart;
      });
      // Don't offer slots in the past for today
      if (!overlaps && cursor.getTime() > Date.now()) {
        slots.push(cursor.toISOString());
      }
      cursor = slotEnd;
    }
  }

  res.json({ date, slots });
});

module.exports = { listDoctors, getDoctor, updateDoctor, updateDoctorStatus, addSchedule, removeSchedule, getAvailability };
