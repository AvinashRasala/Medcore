const { ZodError } = require("zod");

/**
 * Wraps async route handlers so thrown errors are forwarded to next()
 * instead of crashing the process / requiring try-catch everywhere.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Custom error class for predictable, intentional API errors
 * e.g. throw new ApiError(404, "Patient not found")
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Express error-handling middleware (must have 4 args to be recognized).
 */
function errorHandler(err, req, res, next) {
  // Zod validation errors -> 400 with readable field issues
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
    });
  }

  // Prisma known errors
  if (err.code === "P2002") {
    return res.status(409).json({ error: `Duplicate value for field: ${err.meta?.target}` });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ error: "Record not found." });
  }

  // Our own intentional API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error." });
}

module.exports = { asyncHandler, ApiError, errorHandler };
