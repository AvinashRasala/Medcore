const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "DOCTOR", "RECEPTIONIST"]),
  phone: z.string().optional(),
  // Required only when role === DOCTOR (validated manually in controller)
  specialization: z.string().optional(),
  qualification: z.string().optional(),
  licenseNumber: z.string().optional(),
  consultationFee: z.number().positive().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  phone: z.string().optional(),
  // Expecting a data URL like "data:image/jpeg;base64,..."; capped at ~2MB
  // of raw bytes (Base64 inflates size by ~33%, so this allows roughly a
  // 1.5MB original image, plenty for a profile photo).
  profilePhoto: z
    .string()
    .max(2_750_000, "Image is too large. Please use a photo under 2MB.")
    .optional()
    .nullable(),
});

const patientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().or(z.date()),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  phone: z.string().min(7, "Enter a valid phone number"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  bloodGroup: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  allergies: z.string().optional(),
});

const doctorScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  slotMinutes: z.number().int().positive().optional(),
});

const appointmentSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  scheduledAt: z.string().or(z.date()),
  durationMins: z.number().int().positive().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

const updateAppointmentSchema = z.object({
  scheduledAt: z.string().or(z.date()).optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

const medicalRecordSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  diagnosis: z.string().min(1, "Diagnosis is required"),
  symptoms: z.string().optional(),
  prescription: z.string().optional(),
  labTests: z.string().optional(),
  followUpDate: z.string().or(z.date()).optional(),
  notes: z.string().optional(),
});

const billItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative(),
});

const billSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  items: z.array(billItemSchema).min(1, "At least one bill item is required"),
  discount: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(["CASH", "CARD", "UPI", "INSURANCE", "BANK_TRANSFER"]),
});

module.exports = {
  registerSchema,
  loginSchema,
  patientSchema,
  doctorScheduleSchema,
  appointmentSchema,
  updateAppointmentSchema,
  medicalRecordSchema,
  billSchema,
  paymentSchema,
  updateProfileSchema,
};
