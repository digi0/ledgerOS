// Run one or more .sql files against the Supabase Postgres.
//   node scripts/db-exec.mjs supabase/migrations/0001_init.sql ...
import { readFileSync } from "node:fs";
import pg from "pg";
import { loadEnv, parsePgUrl } from "./lib.mjs";

const env = loadEnv();
if (!env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL missing from .env.local");
  process.exit(1);
}

const cfg = parsePgUrl(env.SUPABASE_DB_URL);
const client = new pg.Client({
  ...cfg,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/db-exec.mjs <file.sql> [more.sql ...]");
  process.exit(1);
}

try {
  await client.connect();
  console.log(`connected → ${cfg.host}:${cfg.port}/${cfg.database} as ${cfg.user}`);
  for (const f of files) {
    process.stdout.write(`→ ${f} ... `);
    await client.query(readFileSync(f, "utf8"));
    console.log("ok");
  }
  console.log("✓ all statements applied");
} catch (err) {
  console.error("\n✗ failed:", err.message);
  if (err.code === "ENETUNREACH" || err.code === "ETIMEDOUT" || /EHOSTUNREACH/.test(String(err))) {
    console.error(
      "\nThe direct connection (db.<ref>.supabase.co:5432) is IPv6-only and may be\n" +
        "unreachable on an IPv4 network. Fix: in the Supabase dashboard →\n" +
        "Connect → 'Session pooler' → copy that URI into SUPABASE_DB_URL instead.",
    );
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
