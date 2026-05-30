import { Pool } from "pg";
import { loadEnv } from "./env";

const env = loadEnv();

declare global {
  // Reuse the pool across hot reloads in dev.
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

const pool =
  globalThis.__pgPool ??
  new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    query_timeout: 10_000,
    application_name: "ordersys",
  });

if (env.NODE_ENV !== "production") globalThis.__pgPool = pool;

export default pool;
