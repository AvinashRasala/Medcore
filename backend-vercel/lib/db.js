const { PrismaClient } = require("@prisma/client");

/**
 * Serverless-safe Prisma client.
 *
 * IMPORTANT — read this before deploying:
 * Each serverless function invocation can spin up a fresh process. Without
 * care, this opens a new DB connection per request and exhausts Postgres's
 * connection limit within minutes under real traffic. Two things fix this:
 *
 * 1. Cache the client on `global` so warm invocations reuse the same
 *    connection instead of opening a new one every time (handled below).
 * 2. Point DATABASE_URL at Supabase's CONNECTION POOLER (port 6543, pgbouncer
 *    mode), not the direct/session connection. Set this in Vercel's
 *    environment variables:
 *      postgresql://postgres.xxxx:[PASSWORD]@aws-x-region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
 *    Using the direct connection here WILL exhaust your connection limit
 *    in production. This is not optional for serverless deployments.
 *    `connection_limit=1` keeps each function's own internal pool to a
 *    single connection, since the external pooler is already doing the
 *    real pooling — letting Prisma open more than one per function just
 *    adds overhead without benefit in this architecture.
 */

const globalForPrisma = global;

// IMPORTANT: cache the client unconditionally (not "only outside production").
// Serverless functions reuse the same warm process between invocations when
// traffic is frequent enough — caching here is what lets that warm reuse
// actually skip creating a new PrismaClient (and a new DB connection) on
// every single request. Skipping the cache in production, as an earlier
// version of this file did, defeats the entire point of this optimization.
const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.__prisma = prisma;

module.exports = prisma;
