import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, PoolClient } from "pg";
import { loadEnv } from "../src/lib/env.js";

const env = loadEnv();
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "db", "migrations");

async function ensureMigrationTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      checksum   TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function checksum(sql: string) {
  return createHash("sha256").update(sql).digest("hex");
}

async function run() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[migrate] no migrations found");
    return;
  }

  // Managed Postgres (Supabase/Neon) requires TLS; local Docker doesn't run it.
  const isLocalDb = env.DB_HOST === "localhost" || env.DB_HOST === "127.0.0.1";
  const pool = new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);
    const { rows: applied } = await client.query<{
      version: string;
      checksum: string;
    }>(`SELECT version, checksum FROM schema_migrations`);
    const appliedMap = new Map(applied.map((r) => [r.version, r.checksum]));

    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const sum = checksum(sql);
      const prev = appliedMap.get(file);
      if (prev) {
        if (prev !== sum) {
          throw new Error(
            `[migrate] ${file} already applied with a different checksum. Migration files are immutable. Add a new migration instead.`,
          );
        }
        console.log(`[migrate] skip  ${file}`);
        continue;
      }
      console.log(`[migrate] apply ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)`,
          [file, sum],
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    console.log("[migrate] done");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
