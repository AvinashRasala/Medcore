/**
 * Applies CORS headers and handles OPTIONS preflight requests.
 * Returns true if the request was a preflight OPTIONS request that has
 * already been responded to (caller should `return` immediately after).
 */
function applyCors(req, res) {
  const allowedOrigin = process.env.CORS_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { applyCors };
