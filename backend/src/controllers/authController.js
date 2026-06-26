const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/error");
const { registerSchema, loginSchema, updateProfileSchema } = require("../utils/validators");
const { logAudit } = require("../utils/audit");
const { generateVerificationToken } = require("../utils/codeGenerator");
const { sendVerificationEmail } = require("../utils/email");

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

/**
 * Throws a 409 if an account with this email already exists — regardless
 * of whether that existing account is verified or still pending. This is
 * what stops the same email from being used to sign up a second time.
 */
async function assertEmailNotTaken(email) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists.");
  }
}

/**
 * Creates the user record with a fresh verification token, fires off the
 * verification email, and returns the created user. Does NOT log the
 * user in — they must verify first.
 */
async function createUnverifiedUser({ name, email, passwordHash, role, phone, doctorProfileData }) {
  const verificationToken = generateVerificationToken();
  const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      phone,
      emailVerified: false,
      verificationToken,
      verificationTokenExpiry,
      ...(doctorProfileData && { doctorProfile: { create: doctorProfileData } }),
    },
    include: { doctorProfile: true },
  });

  await sendVerificationEmail({ to: email, name, token: verificationToken });

  return user;
}

/**
 * POST /api/auth/add-doctor
 * Creates a DOCTOR account specifically — and only a doctor account.
 * Callable by Admin OR Receptionist (unlike /register, which can create
 * any role and is Admin-only). This endpoint hard-codes role: "DOCTOR"
 * server-side so a Receptionist calling it can never create an Admin
 * or another Receptionist account through this door.
 */
const addDoctor = asyncHandler(async (req, res) => {
  const data = registerSchema.parse({ ...req.body, role: "DOCTOR" });

  if (!data.specialization || !data.licenseNumber || data.consultationFee == null) {
    throw new ApiError(400, "Doctors require specialization, licenseNumber, and consultationFee.");
  }

  await assertEmailNotTaken(data.email);
  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await createUnverifiedUser({
    name: data.name,
    email: data.email,
    passwordHash,
    role: "DOCTOR",
    phone: data.phone,
    doctorProfileData: {
      specialization: data.specialization,
      qualification: data.qualification,
      licenseNumber: data.licenseNumber,
      consultationFee: data.consultationFee,
    },
  });

  await logAudit({ userId: req.user.id, action: "ADD_DOCTOR", entity: "User", entityId: user.id });

  const { passwordHash: _, verificationToken: __, ...safeUser } = user;
  res.status(201).json({
    user: safeUser,
    message: "Doctor account created. A verification email has been sent to them.",
  });
});

/**
 * POST /api/auth/register
 * Admin-only: creates a staff account of any role (Admin, Doctor,
 * Receptionist). The new account still must verify its email before
 * it can log in — the admin doesn't bypass that on the new user's behalf.
 */
const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);

  if (data.role === "DOCTOR") {
    if (!data.specialization || !data.licenseNumber || data.consultationFee == null) {
      throw new ApiError(400, "Doctors require specialization, licenseNumber, and consultationFee.");
    }
  }

  await assertEmailNotTaken(data.email);
  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await createUnverifiedUser({
    name: data.name,
    email: data.email,
    passwordHash,
    role: data.role,
    phone: data.phone,
    doctorProfileData:
      data.role === "DOCTOR"
        ? {
            specialization: data.specialization,
            qualification: data.qualification,
            licenseNumber: data.licenseNumber,
            consultationFee: data.consultationFee,
          }
        : null,
  });

  await logAudit({ userId: user.id, action: "REGISTER", entity: "User", entityId: user.id });

  const { passwordHash: _, verificationToken: __, ...safeUser } = user;
  res.status(201).json({
    user: safeUser,
    message: "Account created. A verification email has been sent to the new staff member.",
  });
});

/**
 * POST /api/auth/signup
 * PUBLIC self-signup. Anyone can create an account as either DOCTOR or
 * RECEPTIONIST. ADMIN is deliberately never allowed here, regardless of
 * what role value is sent in the request body — Admin accounts can only
 * be created by an existing Admin via /api/auth/register. Must verify
 * email before logging in either way.
 */
const publicSignup = asyncHandler(async (req, res) => {
  const requestedRole = req.body.role === "DOCTOR" ? "DOCTOR" : "RECEPTIONIST";
  const data = registerSchema.parse({ ...req.body, role: requestedRole });

  if (requestedRole === "DOCTOR") {
    if (!data.specialization || !data.licenseNumber || data.consultationFee == null) {
      throw new ApiError(400, "Doctors require specialization, licenseNumber, and consultationFee.");
    }
  }

  await assertEmailNotTaken(data.email);
  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await createUnverifiedUser({
    name: data.name,
    email: data.email,
    passwordHash,
    role: requestedRole,
    phone: data.phone,
    doctorProfileData:
      requestedRole === "DOCTOR"
        ? {
            specialization: data.specialization,
            qualification: data.qualification,
            licenseNumber: data.licenseNumber,
            consultationFee: data.consultationFee,
          }
        : null,
  });

  await logAudit({ userId: user.id, action: "PUBLIC_SIGNUP", entity: "User", entityId: user.id });

  const { passwordHash: _, verificationToken: __, ...safeUser } = user;
  res.status(201).json({
    user: safeUser,
    message: "Account created. Please check your email to verify your account before logging in.",
  });
});

/**
 * GET /api/auth/verify-email?token=...
 * Public. Marks the account verified if the token is valid and unexpired.
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;
  if (!token) throw new ApiError(400, "Verification token is required.");

  const user = await prisma.user.findUnique({ where: { verificationToken: token } });

  if (!user) {
    throw new ApiError(400, "Invalid or already-used verification link.");
  }
  if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
    throw new ApiError(400, "This verification link has expired. Please request a new one.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null, verificationTokenExpiry: null },
  });

  await logAudit({ userId: user.id, action: "VERIFY_EMAIL", entity: "User", entityId: user.id });

  res.json({ message: "Email verified successfully. You can now log in." });
});

/**
 * POST /api/auth/resend-verification
 * Public. Lets someone request a fresh verification email if their
 * original link expired or they lost it, without revealing whether the
 * email exists (always returns the same generic success message).
 */
const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, "Email is required.");

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.emailVerified) {
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken, verificationTokenExpiry },
    });

    await sendVerificationEmail({ to: user.email, name: user.name, token: verificationToken });
  }

  // Same response whether or not the account exists/was already verified —
  // avoids leaking which emails are registered.
  res.json({ message: "If an account with that email exists and isn't verified, a new link has been sent." });
});

/**
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { doctorProfile: true },
  });

  if (!user || !user.isActive) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid email or password.");

  if (!user.emailVerified) {
    throw new ApiError(403, "Please verify your email before logging in. Check your inbox for the verification link.");
  }

  await logAudit({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id });

  const token = signToken(user);
  const { passwordHash: _, verificationToken: __, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

/**
 * PUT /api/auth/me
 * Lets any logged-in staff member update their own name, phone, and
 * profile photo. Deliberately does NOT allow changing email or role
 * here — those require an Admin and go through different endpoints.
 */
const updateMyProfile = asyncHandler(async (req, res) => {
  const data = updateProfileSchema.parse(req.body);

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.profilePhoto !== undefined && { profilePhoto: data.profilePhoto }),
    },
    include: { doctorProfile: true },
  });

  await logAudit({ userId: user.id, action: "UPDATE_PROFILE", entity: "User", entityId: user.id });

  const { passwordHash: _, verificationToken: __, ...safeUser } = user;
  res.json({ user: safeUser });
});

/**
 * GET /api/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { doctorProfile: true },
  });
  if (!user) throw new ApiError(404, "User not found.");
  const { passwordHash: _, verificationToken: __, ...safeUser } = user;
  res.json({ user: safeUser });
});

module.exports = { register, addDoctor, publicSignup, login, getMe, updateMyProfile, verifyEmail, resendVerification };
