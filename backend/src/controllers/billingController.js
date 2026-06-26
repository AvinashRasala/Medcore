const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/error");
const { billSchema, paymentSchema } = require("../utils/validators");
const { generateInvoiceNumber } = require("../utils/codeGenerator");
const { logAudit } = require("../utils/audit");

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * GET /api/bills?patientId=&paymentStatus=&page=&limit=
 */
const listBills = asyncHandler(async (req, res) => {
  const { patientId, paymentStatus, page = "1", limit = "20" } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const take = Math.min(parseInt(limit, 10) || 20, 100);
  const skip = (pageNum - 1) * take;

  const where = {
    ...(patientId && { patientId }),
    ...(paymentStatus && { paymentStatus }),
  };

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { patient: true, items: true },
    }),
    prisma.bill.count({ where }),
  ]);

  res.json({ bills, pagination: { total, page: pageNum, limit: take, totalPages: Math.ceil(total / take) } });
});

/**
 * GET /api/bills/:id
 */
const getBill = asyncHandler(async (req, res) => {
  const bill = await prisma.bill.findUnique({
    where: { id: req.params.id },
    include: { patient: true, items: true, appointment: { include: { doctor: { include: { user: true } } } } },
  });
  if (!bill) throw new ApiError(404, "Bill not found.");
  res.json({ bill });
});

/**
 * POST /api/bills
 * Creates an invoice with line items. Totals are computed server-side
 * (never trust client-submitted totals) to guarantee billing correctness.
 */
const createBill = asyncHandler(async (req, res) => {
  const data = billSchema.parse(req.body);

  const patient = await prisma.patient.findUnique({ where: { id: data.patientId } });
  if (!patient) throw new ApiError(404, "Patient not found.");

  const itemsWithTotals = data.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: round2(item.quantity * item.unitPrice),
  }));

  const subtotal = round2(itemsWithTotals.reduce((sum, i) => sum + i.lineTotal, 0));
  const discount = round2(data.discount || 0);
  const tax = round2(data.tax || 0);
  const totalAmount = round2(subtotal - discount + tax);

  if (totalAmount < 0) {
    throw new ApiError(400, "Discount cannot exceed subtotal plus tax.");
  }

  const invoiceNumber = await generateInvoiceNumber();

  const bill = await prisma.bill.create({
    data: {
      invoiceNumber,
      patientId: data.patientId,
      appointmentId: data.appointmentId || null,
      createdById: req.user.id,
      subtotal,
      discount,
      tax,
      totalAmount,
      items: { create: itemsWithTotals },
    },
    include: { items: true, patient: true },
  });

  await logAudit({ userId: req.user.id, action: "CREATE_BILL", entity: "Bill", entityId: bill.id });
  res.status(201).json({ bill });
});

/**
 * POST /api/bills/:id/payments
 * Records a payment against a bill, updating paymentStatus automatically
 * (UNPAID -> PARTIALLY_PAID -> PAID) based on cumulative amountPaid.
 */
const recordPayment = asyncHandler(async (req, res) => {
  const data = paymentSchema.parse(req.body);

  const bill = await prisma.bill.findUnique({ where: { id: req.params.id } });
  if (!bill) throw new ApiError(404, "Bill not found.");
  if (bill.paymentStatus === "PAID") throw new ApiError(400, "This bill is already fully paid.");

  const newAmountPaid = round2(Number(bill.amountPaid) + data.amount);
  if (newAmountPaid > Number(bill.totalAmount)) {
    throw new ApiError(400, `Payment exceeds remaining balance of ${round2(Number(bill.totalAmount) - Number(bill.amountPaid))}.`);
  }

  const newStatus =
    newAmountPaid >= Number(bill.totalAmount) ? "PAID" : newAmountPaid > 0 ? "PARTIALLY_PAID" : "UNPAID";

  const updated = await prisma.bill.update({
    where: { id: req.params.id },
    data: {
      amountPaid: newAmountPaid,
      paymentStatus: newStatus,
      paymentMethod: data.paymentMethod,
      paidAt: newStatus === "PAID" ? new Date() : bill.paidAt,
    },
    include: { items: true, patient: true },
  });

  await logAudit({
    userId: req.user.id,
    action: "RECORD_PAYMENT",
    entity: "Bill",
    entityId: updated.id,
    metadata: { amount: data.amount, method: data.paymentMethod },
  });

  res.json({ bill: updated });
});

/**
 * PUT /api/bills/:id
 * Update discount/tax/items before payment is made (admin/receptionist correction).
 */
const updateBill = asyncHandler(async (req, res) => {
  const bill = await prisma.bill.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!bill) throw new ApiError(404, "Bill not found.");
  if (bill.paymentStatus !== "UNPAID") {
    throw new ApiError(400, "Cannot edit a bill once payment has been recorded against it.");
  }

  const data = billSchema.partial().parse(req.body);
  const updateData = {};

  if (data.items) {
    const itemsWithTotals = data.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: round2(item.quantity * item.unitPrice),
    }));
    const subtotal = round2(itemsWithTotals.reduce((sum, i) => sum + i.lineTotal, 0));
    updateData.subtotal = subtotal;
    await prisma.billItem.deleteMany({ where: { billId: bill.id } });
    updateData.items = { create: itemsWithTotals };
  }

  const subtotal = updateData.subtotal ?? Number(bill.subtotal);
  const discount = data.discount != null ? round2(data.discount) : Number(bill.discount);
  const tax = data.tax != null ? round2(data.tax) : Number(bill.tax);
  updateData.discount = discount;
  updateData.tax = tax;
  updateData.totalAmount = round2(subtotal - discount + tax);

  const updated = await prisma.bill.update({
    where: { id: req.params.id },
    data: updateData,
    include: { items: true, patient: true },
  });

  await logAudit({ userId: req.user.id, action: "UPDATE_BILL", entity: "Bill", entityId: updated.id });
  res.json({ bill: updated });
});

module.exports = { listBills, getBill, createBill, recordPayment, updateBill };
