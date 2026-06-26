const prisma = require("./db");
const crypto = require("crypto");

/**
 * Generates the next sequential, human-friendly patient code: PAT-00001, PAT-00002...
 */
async function generatePatientCode() {
  const count = await prisma.patient.count();
  const next = count + 1;
  return `PAT-${String(next).padStart(5, "0")}`;
}

/**
 * Generates the next invoice number scoped to the current year: INV-2026-00001
 */
async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.bill.count({
    where: { invoiceNumber: { startsWith: `INV-${year}-` } },
  });
  const next = count + 1;
  return `INV-${year}-${String(next).padStart(5, "0")}`;
}

/**
 * Generates a cryptographically random token for email verification links.
 */
function generateVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = { generatePatientCode, generateInvoiceNumber, generateVerificationToken };
