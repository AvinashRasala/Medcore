const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/db");
const { registerSchema, loginSchema, updateProfileSchema } = require("../lib/validators");
const { logAudit } = require("../lib/audit");
const { generateVerificationToken } = require("../lib/codeGenerator");
const { sendVerificationEmail } = require("../lib/email");
const { getAuthUser, requireRole, withErrorHandling } = require("../lib/auth");
const { applyCors } = require("../lib/cors");

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function stripSecrets(user) {
  const { passwordHash: _, verificationToken: __, ...safe } = user;
  return safe;
}

async function assertEmailNotTaken(email) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error("An account with this email already exists.");
    err.statusCode = 409;
    throw err;
  }
}

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

// ---------- action handlers ----------

async function handleLogin(req, res) {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email }, include: { doctorProfile: true } });
  if (!user || !user.isActive) {
    const err = new Error("Invalid email or password.");
    err.statusCode = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const err = new Error("Invalid email or password.");
    err.statusCode = 401;
    throw err;
  }

  if (!user.emailVerified) {
    const err = new Error("Please verify your email before logging in. Check your inbox for the verification link.");
    err.statusCode = 403;
    throw err;
  }

  await logAudit({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id });
  res.json({ user: stripSecrets(user), token: signToken(user) });
}

async function handleSignup(req, res) {
  // Default-deny: anything other than the literal string "DOCTOR" (this
  // includes "ADMIN", typos, or a missing field) falls through to
  // RECEPTIONIST. This is intentional — it's the safe direction to fail in.
  const requestedRole = req.body.role === "DOCTOR" ? "DOCTOR" : "RECEPTIONIST";
  const data = registerSchema.parse({ ...req.body, role: requestedRole });

  if (requestedRole === "DOCTOR") {
    if (!data.specialization || !data.licenseNumber || data.consultationFee == null) {
      const err = new Error("Doctors require specialization, licenseNumber, and consultationFee.");
      err.statusCode = 400;
      throw err;
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
  res.status(201).json({
    user: stripSecrets(user),
    message: "Account created. Please check your email to verify your account before logging in.",
  });
}

async function handleRegister(req, res) {
  const authUser = getAuthUser(req);
  requireRole(authUser, "ADMIN");

  const data = registerSchema.parse(req.body);

  if (data.role === "DOCTOR") {
    if (!data.specialization || !data.licenseNumber || data.consultationFee == null) {
      const err = new Error("Doctors require specialization, licenseNumber, and consultationFee.");
      err.statusCode = 400;
      throw err;
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
  res.status(201).json({
    user: stripSecrets(user),
    message: "Account created. A verification email has been sent to the new staff member.",
  });
}

async function handleAddDoctor(req, res) {
  const authUser = getAuthUser(req);
  requireRole(authUser, "ADMIN", "RECEPTIONIST");

  const data = registerSchema.parse({ ...req.body, role: "DOCTOR" });

  if (!data.specialization || !data.licenseNumber || data.consultationFee == null) {
    const err = new Error("Doctors require specialization, licenseNumber, and consultationFee.");
    err.statusCode = 400;
    throw err;
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

  await logAudit({ userId: authUser.id, action: "ADD_DOCTOR", entity: "User", entityId: user.id });
  res.status(201).json({
    user: stripSecrets(user),
    message: "Doctor account created. A verification email has been sent to them.",
  });
}

async function handleMe(req, res) {
  const authUser = getAuthUser(req);

  if (req.method === "GET") {
    const user = await prisma.user.findUnique({ where: { id: authUser.id }, include: { doctorProfile: true } });
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }
    return res.json({ user: stripSecrets(user) });
  }

  if (req.method === "PUT") {
    const data = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: authUser.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.profilePhoto !== undefined && { profilePhoto: data.profilePhoto }),
      },
      include: { doctorProfile: true },
    });
    await logAudit({ userId: user.id, action: "UPDATE_PROFILE", entity: "User", entityId: user.id });
    return res.json({ user: stripSecrets(user) });
  }

  return res.status(405).json({ error: "Method not allowed." });
}

async function handleVerifyEmail(req, res) {
  const { token } = req.query;
  if (!token) {
    const err = new Error("Verification token is required.");
    err.statusCode = 400;
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { verificationToken: token } });
  if (!user) {
    const err = new Error("Invalid or already-used verification link.");
    err.statusCode = 400;
    throw err;
  }
  if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
    const err = new Error("This verification link has expired. Please request a new one.");
    err.statusCode = 400;
    throw err;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null, verificationTokenExpiry: null },
  });

  await logAudit({ userId: user.id, action: "VERIFY_EMAIL", entity: "User", entityId: user.id });
  res.json({ message: "Email verified successfully. You can now log in." });
}

async function handleResendVerification(req, res) {
  const { email } = req.body;
  if (!email) {
    const err = new Error("Email is required.");
    err.statusCode = 400;
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.emailVerified) {
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    await prisma.user.update({ where: { id: user.id }, data: { verificationToken, verificationTokenExpiry } });
    await sendVerificationEmail({ to: user.email, name: user.name, token: verificationToken });
  }

  res.json({ message: "If an account with that email exists and isn't verified, a new link has been sent." });
}

// ---------- single entry point, routes by ?action= ----------

module.exports = withErrorHandling(async (req, res) => {
  if (applyCors(req, res)) return;

  const { action } = req.query;

  switch (action) {
    case "login":
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
      return handleLogin(req, res);
    case "signup":
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
      return handleSignup(req, res);
    case "register":
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
      return handleRegister(req, res);
    case "add-doctor":
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
      return handleAddDoctor(req, res);
    case "me":
      return handleMe(req, res);
    case "verify-email":
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
      return handleVerifyEmail(req, res);
    case "resend-verification":
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
      return handleResendVerification(req, res);
    default:
      return res.status(404).json({ error: "Unknown auth action. Expected ?action=login|signup|register|add-doctor|me|verify-email|resend-verification" });
  }
});
