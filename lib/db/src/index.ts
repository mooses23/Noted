import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";

// Detect Supabase / hosted Postgres that requires SSL. Supabase pooler URLs
// use the supabase.co domain. We also enable SSL whenever the URL explicitly
// asks for it via `sslmode=require` or when running in production.
const lowerUrl = connectionString.toLowerCase();
const requiresSsl =
  isProduction ||
  lowerUrl.includes("supabase.co") ||
  lowerUrl.includes("supabase.com") ||
  lowerUrl.includes("sslmode=require") ||
  lowerUrl.includes("sslmode=verify-full") ||
  lowerUrl.includes("sslmode=verify-ca");

// In serverless environments (e.g. Vercel functions) we want a tiny pool per
// instance so we don't exhaust the upstream connection pooler. Allow override
// via env vars for non-serverless deploys.
const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
);
const poolMax = process.env.PGPOOL_MAX
  ? Number(process.env.PGPOOL_MAX)
  : isServerless
    ? 1
    : 10;
const idleTimeoutMillis = process.env.PGPOOL_IDLE_TIMEOUT_MS
  ? Number(process.env.PGPOOL_IDLE_TIMEOUT_MS)
  : isServerless
    ? 10_000
    : 30_000;

// Default to verified TLS. Operators can opt out with
// PGSSL_REJECT_UNAUTHORIZED=false (e.g. for self-signed dev certs); never
// disable verification implicitly.
const rejectUnauthorized =
  (process.env.PGSSL_REJECT_UNAUTHORIZED ?? "true").toLowerCase() !== "false";

export const pool = new Pool({
  connectionString,
  max: poolMax,
  idleTimeoutMillis,
  ...(requiresSsl ? { ssl: { rejectUnauthorized } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
