const prisma = require("./db");

/**
 * Records an audit trail entry. Fire-and-forget style (awaited but
 * never throws) so it never blocks or breaks the main request flow.
 */
async function logAudit({ userId, action, entity, entityId, metadata }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entity,
        entityId: entityId || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err.message);
  }
}

module.exports = { logAudit };
