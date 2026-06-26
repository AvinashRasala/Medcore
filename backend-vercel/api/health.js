const { applyCors } = require("../lib/cors");

module.exports = (req, res) => {
  if (applyCors(req, res)) return;
  res.json({ status: "ok", timestamp: new Date().toISOString() });
};
