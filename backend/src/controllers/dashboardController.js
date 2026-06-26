const prisma = require("../config/db");
const { asyncHandler } = require("../middleware/error");

/**
 * GET /api/dashboard/summary
 * High-level counts for the dashboard top cards.
 */
const getSummary = asyncHandler(async (req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    totalPatients,
    totalDoctors,
    appointmentsToday,
    appointmentsThisMonth,
    pendingBillsCount,
    revenueThisMonthAgg,
    totalRevenueAgg,
    outstandingAgg,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.doctor.count(),
    prisma.appointment.count({
      where: { scheduledAt: { gte: startOfToday, lte: endOfToday }, status: { not: "CANCELLED" } },
    }),
    prisma.appointment.count({
      where: { scheduledAt: { gte: startOfMonth }, status: { not: "CANCELLED" } },
    }),
    prisma.bill.count({ where: { paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } } }),
    prisma.bill.aggregate({
      _sum: { amountPaid: true },
      where: { paidAt: { gte: startOfMonth } },
    }),
    prisma.bill.aggregate({ _sum: { amountPaid: true } }),
    prisma.bill.aggregate({
      _sum: { totalAmount: true, amountPaid: true },
      where: { paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } },
    }),
  ]);

  const outstandingBalance = round2(
    Number(outstandingAgg._sum.totalAmount || 0) - Number(outstandingAgg._sum.amountPaid || 0)
  );

  res.json({
    totalPatients,
    totalDoctors,
    appointmentsToday,
    appointmentsThisMonth,
    pendingBillsCount,
    revenueThisMonth: Number(revenueThisMonthAgg._sum.amountPaid || 0),
    totalRevenue: Number(totalRevenueAgg._sum.amountPaid || 0),
    outstandingBalance,
  });
});

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * GET /api/dashboard/appointments-trend?days=14
 * Daily appointment counts for the last N days — feeds a line/bar chart.
 */
const getAppointmentsTrend = asyncHandler(async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 14, 90);
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);

  const appointments = await prisma.appointment.findMany({
    where: { scheduledAt: { gte: since } },
    select: { scheduledAt: true, status: true },
  });

  const buckets = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { date: key, total: 0, completed: 0, cancelled: 0 };
  }

  for (const appt of appointments) {
    const key = new Date(appt.scheduledAt).toISOString().slice(0, 10);
    if (!buckets[key]) continue;
    buckets[key].total += 1;
    if (appt.status === "COMPLETED") buckets[key].completed += 1;
    if (appt.status === "CANCELLED") buckets[key].cancelled += 1;
  }

  res.json({ trend: Object.values(buckets) });
});

/**
 * GET /api/dashboard/revenue-trend?months=6
 * Monthly revenue for the last N months — feeds a bar chart.
 */
const getRevenueTrend = asyncHandler(async (req, res) => {
  const months = Math.min(parseInt(req.query.months, 10) || 6, 24);
  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const bills = await prisma.bill.findMany({
    where: { paidAt: { gte: since } },
    select: { paidAt: true, amountPaid: true },
  });

  const buckets = {};
  for (let i = 0; i < months; i++) {
    const d = new Date(since);
    d.setMonth(d.getMonth() + i);
    const key = d.toISOString().slice(0, 7); // YYYY-MM
    buckets[key] = { month: key, revenue: 0 };
  }

  for (const bill of bills) {
    if (!bill.paidAt) continue;
    const key = new Date(bill.paidAt).toISOString().slice(0, 7);
    if (!buckets[key]) continue;
    buckets[key].revenue = round2(buckets[key].revenue + Number(bill.amountPaid));
  }

  res.json({ trend: Object.values(buckets) });
});

/**
 * GET /api/dashboard/doctor-load
 * Appointment counts per doctor (for "busiest doctors" widget).
 */
const getDoctorLoad = asyncHandler(async (req, res) => {
  const doctors = await prisma.doctor.findMany({
    include: {
      user: { select: { name: true } },
      _count: { select: { appointments: true } },
    },
    orderBy: { appointments: { _count: "desc" } },
    take: 10,
  });

  res.json({
    doctorLoad: doctors.map((d) => ({
      doctorId: d.id,
      name: d.user.name,
      specialization: d.specialization,
      appointmentCount: d._count.appointments,
    })),
  });
});

module.exports = { getSummary, getAppointmentsTrend, getRevenueTrend, getDoctorLoad };
