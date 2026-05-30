import { Pool } from "pg";
import { loadEnv } from "./env";

const env = loadEnv();

declare global {
  // Reuse the pool across hot reloads in dev.
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

// Local Docker Postgres runs without TLS; managed Postgres (Supabase/Neon)
// requires it. Detect by host so the same code works in both places.
const isLocalDb = env.DB_HOST === "localhost" || env.DB_HOST === "127.0.0.1";

const pool =
  globalThis.__pgPool ??
  new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    // rejectUnauthorized:false accepts the provider's cert without bundling a
    // CA — acceptable for a demo. Pin a CA before going to production.
    ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
    // On Vercel each serverless instance opens its own pool, and Supabase's
    // free session pooler caps total clients at 15. Keep one connection per
    // instance and release it quickly so concurrent instances don't exhaust
    // the cap. 10 was fine for a single long-lived local process.
    max: isLocalDb ? 10 : 1,
    idleTimeoutMillis: isLocalDb ? 30_000 : 10_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    query_timeout: 10_000,
    application_name: "ordersys",
  });

if (env.NODE_ENV !== "production") globalThis.__pgPool = pool;

export default pool;
