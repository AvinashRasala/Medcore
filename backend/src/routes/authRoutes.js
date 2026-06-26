const express = require("express");
const router = express.Router();
const { register, addDoctor, publicSignup, login, getMe, updateMyProfile, verifyEmail, resendVerification } = require("../controllers/authController");
const { authenticate, authorize } = require("../middleware/auth");

// Public: anyone can log in
router.post("/login", login);

// Public: anyone can self-signup, but always as RECEPTIONIST (see controller).
// Doctor accounts CANNOT be self-signed-up — only added by Admin or
// Receptionist below. Admin accounts can only be created via /register.
router.post("/signup", publicSignup);

// Public: email verification link target, and a way to request a fresh link
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

// Admin or Receptionist can add a new Doctor account specifically.
// This endpoint can ONLY create Doctors — see controller for why that's
// enforced server-side regardless of what role is sent in the request body.
router.post("/add-doctor", authenticate, authorize("ADMIN", "RECEPTIONIST"), addDoctor);

// Registering a staff account of ANY role (including Admin) requires an
// existing Admin to be logged in, EXCEPT the very first admin (seed script).
router.post("/register", authenticate, authorize("ADMIN"), register);

router.get("/me", authenticate, getMe);
router.put("/me", authenticate, updateMyProfile);

module.exports = router;
