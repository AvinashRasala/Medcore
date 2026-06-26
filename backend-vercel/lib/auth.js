const jwt = require("jsonwebtoken");

/**
 * Verifies the Bearer token on the request and returns the decoded payload,
 * or throws an ApiError-like object the caller should turn into a 401.
 * Serverless functions have no middleware chain, so this is called
 * explicitly at the top of every protected handler.
 */
function getAuthUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    const err = new Error("Authentication required. No token provided.");
    err.statusCode = 401;
    throw err;
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET); // { id, role, email, name }
  } catch {
    const err = new Error("Invalid or expired token.");
    err.statusCode = 401;
    throw err;
  }
}

/**
 * Throws a 403 if the user's role isn't in the allowed list.
 * Usage: requireRole(user, "ADMIN", "DOCTOR")
 */
function requireRole(user, ...allowedRoles) {
  if (!allowedRoles.includes(user.role)) {
    const err = new Error("You do not have permission to perform this action.");
    err.statusCode = 403;
    throw err;
  }
}

/**
 * Wraps a handler so any thrown error (ours or Prisma's) becomes a clean
 * JSON error response instead of crashing the function or leaking stack
 * traces. Every api/ file should wrap its export with this.
 */
function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err.name === "ZodError") {
        return res.status(400).json({
          error: "Validation failed",
          details: err.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
        });
      }
      if (err.code === "P2002") {
        return res.status(409).json({ error: `Duplicate value for field: ${err.meta?.target}` });
      }
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Record not found." });
      }
      const status = err.statusCode || 500;
      if (status === 500) console.error("Unhandled error:", err);
      return res.status(status).json({ error: err.message || "Internal server error." });
    }
  };
}

module.exports = { getAuthUser, requireRole, withErrorHandling };
