const prisma = require("../lib/db");
const { billSchema, paymentSchema } = require("../lib/validators");
const { generateInvoiceNumber } = require("../lib/codeGenerator");
const { logAudit } = require("../lib/audit");
const { getAuthUser, requireRole, withErrorHandling } = require("../lib/auth");
const { applyCors } = require("../lib/cors");

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * GET    /api/bills                          -> list
 * POST   /api/bills                          -> create
 * GET    /api/bills?id=xxx                   -> get one
 * PUT    /api/bills?id=xxx                   -> update (before payment only)
 * POST   /api/bills?id=xxx&action=payments   -> record a payment
 */
module.exports = withErrorHandling(async (req, res) => {
  if (applyCors(req, res)) return;
  const authUser = getAuthUser(req);
  const { id, action } = req.query;

  // ---------- record a payment ----------
  if (id && action === "payments") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

    requireRole(authUser, "ADMIN", "RECEPTIONIST");
    const data = paymentSchema.parse(req.body);

    const bill = await prisma.bill.findUnique({ where: { id } });
    if (!bill) { const e = new Error("Bill not found."); e.statusCode = 404; throw e; }
    if (bill.paymentStatus === "PAID") {
      const e = new Error("This bill is already fully paid.");
      e.statusCode = 400;
      throw e;
    }

    const newAmountPaid = round2(Number(bill.amountPaid) + data.amount);
    if (newAmountPaid > Number(bill.totalAmount)) {
      const e = new Error(
        `Payment exceeds remaining balance of ${round2(Number(bill.totalAmount) - Number(bill.amountPaid))}.`
      );
      e.statusCode = 400;
      throw e;
    }

    const newStatus =
      newAmountPaid >= Number(bill.totalAmount) ? "PAID" : newAmountPaid > 0 ? "PARTIALLY_PAID" : "UNPAID";

    const updated = await prisma.bill.update({
      where: { id },
      data: {
        amountPaid: newAmountPaid,
        paymentStatus: newStatus,
        paymentMethod: data.paymentMethod,
        paidAt: newStatus === "PAID" ? new Date() : bill.paidAt,
      },
      include: { items: true, patient: true },
    });

    await logAudit({
      userId: authUser.id,
      action: "RECORD_PAYMENT",
      entity: "Bill",
      entityId: updated.id,
      metadata: { amount: data.amount, method: data.paymentMethod },
    });

    return res.json({ bill: updated });
  }

  // ---------- single bill ----------
  if (id) {
    if (req.method === "GET") {
      const bill = await prisma.bill.findUnique({
        where: { id },
        include: { patient: true, items: true, appointment: { include: { doctor: { include: { user: true } } } } },
      });
      if (!bill) { const e = new Error("Bill not found."); e.statusCode = 404; throw e; }
      return res.json({ bill });
    }

    if (req.method === "PUT") {
      requireRole(authUser, "ADMIN", "RECEPTIONIST");

      const bill = await prisma.bill.findUnique({ where: { id }, include: { items: true } });
      if (!bill) { const e = new Error("Bill not found."); e.statusCode = 404; throw e; }
      if (bill.paymentStatus !== "UNPAID") {
        const e = new Error("Cannot edit a bill once payment has been recorded against it.");
        e.statusCode = 400;
        throw e;
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
        where: { id },
        data: updateData,
        include: { items: true, patient: true },
      });

      await logAudit({ userId: authUser.id, action: "UPDATE_BILL", entity: "Bill", entityId: updated.id });
      return res.json({ bill: updated });
    }

    return res.status(405).json({ error: "Method not allowed." });
  }

  // ---------- collection ----------
  if (req.method === "GET") {
    const { patientId, paymentStatus, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (pageNum - 1) * take;

    const where = { ...(patientId && { patientId }), ...(paymentStatus && { paymentStatus }) };

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where, orderBy: { createdAt: "desc" }, skip, take,
        include: { patient: true, items: true },
      }),
      prisma.bill.count({ where }),
    ]);

    return res.json({
      bills,
      pagination: { total, page: pageNum, limit: take, totalPages: Math.ceil(total / take) },
    });
  }

  if (req.method === "POST") {
    requireRole(authUser, "ADMIN", "RECEPTIONIST");
    const data = billSchema.parse(req.body);

    const patient = await prisma.patient.findUnique({ where: { id: data.patientId } });
    if (!patient) { const e = new Error("Patient not found."); e.statusCode = 404; throw e; }

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
      const e = new Error("Discount cannot exceed subtotal plus tax.");
      e.statusCode = 400;
      throw e;
    }

    const invoiceNumber = await generateInvoiceNumber();

    const bill = await prisma.bill.create({
      data: {
        invoiceNumber,
        patientId: data.patientId,
        appointmentId: data.appointmentId || null,
        createdById: authUser.id,
        subtotal, discount, tax, totalAmount,
        items: { create: itemsWithTotals },
      },
      include: { items: true, patient: true },
    });

    await logAudit({ userId: authUser.id, action: "CREATE_BILL", entity: "Bill", entityId: bill.id });
    return res.status(201).json({ bill });
  }

  return res.status(405).json({ error: "Method not allowed." });
});
