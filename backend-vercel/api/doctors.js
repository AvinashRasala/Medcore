const prisma = require("../lib/db");
const { doctorScheduleSchema } = require("../lib/validators");
const { logAudit } = require("../lib/audit");
const { getAuthUser, requireRole, withErrorHandling } = require("../lib/auth");
const { applyCors } = require("../lib/cors");

const DOCTOR_USER_SELECT = { id: true, name: true, email: true, phone: true, isActive: true, profilePhoto: true };

/**
 * GET    /api/doctors                                   -> list
 * GET    /api/doctors?id=xxx                            -> get one
 * PUT    /api/doctors?id=xxx                            -> update profile fields
 * PUT    /api/doctors?id=xxx&action=status               -> deactivate/reactivate
 * GET    /api/doctors?id=xxx&action=availability&date=   -> computed open slots
 * POST   /api/doctors?id=xxx&action=schedules             -> add weekly schedule block
 * DELETE /api/doctors?id=xxx&action=schedules&scheduleId=xxx -> remove schedule block
 *
 * Everything lives in one function (instead of 6 files) to stay well
 * under Vercel's 12-function cap on the Hobby plan.
 */
module.exports = withErrorHandling(async (req, res) => {
  if (applyCors(req, res)) return;
  const { id, action, scheduleId, date } = req.query;

  // ---------- schedules sub-resource ----------
  if (id && action === "schedules") {
    const authUser = getAuthUser(req);

    if (req.method === "POST") {
      requireRole(authUser, "ADMIN", "DOCTOR");
      const data = doctorScheduleSchema.parse(req.body);
      const schedule = await prisma.doctorSchedule.create({ data: { ...data, doctorId: id } });
      return res.status(201).json({ schedule });
    }

    if (req.method === "DELETE") {
      requireRole(authUser, "ADMIN", "DOCTOR");
      if (!scheduleId) {
        const err = new Error("scheduleId is required to delete a schedule block.");
        err.statusCode = 400;
        throw err;
      }
      await prisma.doctorSchedule.delete({ where: { id: scheduleId } });
      return res.status(204).end();
    }

    return res.status(405).json({ error: "Method not allowed." });
  }

  // ---------- availability (computed open slots) ----------
  if (id && action === "availability") {
    getAuthUser(req);
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
    if (!date) {
      const err = new Error("Query param 'date' (YYYY-MM-DD) is required.");
      err.statusCode = 400;
      throw err;
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    const schedules = await prisma.doctorSchedule.findMany({ where: { doctorId: id, dayOfWeek } });
    if (schedules.length === 0) {
      return res.json({ date, slots: [] });
    }

    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59`);

    const bookedAppointments = await prisma.appointment.findMany({
      where: { doctorId: id, scheduledAt: { gte: startOfDay, lte: endOfDay }, status: { not: "CANCELLED" } },
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
        if (!overlaps && cursor.getTime() > Date.now()) {
          slots.push(cursor.toISOString());
        }
        cursor = slotEnd;
      }
    }

    return res.json({ date, slots });
  }

  // ---------- deactivate / reactivate ----------
  if (id && action === "status") {
    const authUser = getAuthUser(req);
    if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed." });

    requireRole(authUser, "ADMIN", "RECEPTIONIST");

    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      const err = new Error("isActive must be true or false.");
      err.statusCode = 400;
      throw err;
    }

    const doctor = await prisma.doctor.findUnique({ where: { id }, include: { user: true } });
    if (!doctor) {
      const err = new Error("Doctor not found.");
      err.statusCode = 404;
      throw err;
    }

    await prisma.user.update({ where: { id: doctor.userId }, data: { isActive } });

    await logAudit({
      userId: authUser.id,
      action: isActive ? "REACTIVATE_DOCTOR" : "DEACTIVATE_DOCTOR",
      entity: "Doctor",
      entityId: doctor.id,
    });

    const updated = await prisma.doctor.findUnique({
      where: { id },
      include: { user: { select: DOCTOR_USER_SELECT } },
    });

    return res.json({
      doctor: updated,
      message: isActive
        ? "Doctor account reactivated."
        : "Doctor account deactivated. Their appointment and medical record history remains unchanged.",
    });
  }

  // ---------- single doctor: GET / PUT ----------
  if (id) {
    const authUser = getAuthUser(req);

    if (req.method === "GET") {
      const doctor = await prisma.doctor.findUnique({
        where: { id },
        include: {
          user: { select: DOCTOR_USER_SELECT },
          schedules: true,
          appointments: { orderBy: { scheduledAt: "desc" }, take: 50, include: { patient: true } },
        },
      });
      if (!doctor) {
        const err = new Error("Doctor not found.");
        err.statusCode = 404;
        throw err;
      }
      return res.json({ doctor });
    }

    if (req.method === "PUT") {
      requireRole(authUser, "ADMIN", "DOCTOR");
      const { specialization, qualification, consultationFee, bio } = req.body;
      const doctor = await prisma.doctor.update({
        where: { id },
        data: {
          ...(specialization && { specialization }),
          ...(qualification !== undefined && { qualification }),
          ...(consultationFee !== undefined && { consultationFee }),
          ...(bio !== undefined && { bio }),
        },
      });
      await logAudit({ userId: authUser.id, action: "UPDATE_DOCTOR", entity: "Doctor", entityId: doctor.id });
      return res.json({ doctor });
    }

    return res.status(405).json({ error: "Method not allowed." });
  }

  // ---------- collection: list ----------
  getAuthUser(req); // all staff roles can view doctors
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const { specialization } = req.query;
  const where = specialization ? { specialization: { contains: specialization, mode: "insensitive" } } : {};

  const doctors = await prisma.doctor.findMany({
    where,
    include: { user: { select: DOCTOR_USER_SELECT }, schedules: true },
    orderBy: { createdAt: "desc" },
  });

  res.json({ doctors });
});
