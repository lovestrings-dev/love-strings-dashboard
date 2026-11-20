import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.SMART_LINKS_LOCAL_DATABASE_URL;

if (!databaseUrl) throw new Error("Set SMART_LINKS_LOCAL_DATABASE_URL to an isolated local PostgreSQL/Supabase database URL.");
const parsed = new URL(databaseUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
  throw new Error("SMART_LINKS_LOCAL_DATABASE_URL must point to localhost; remote databases are refused.");
}

const testFile = fileURLToPath(new URL("../supabase/tests/smart-links-phase1b.behavior.sql", import.meta.url));
if (!existsSync(testFile)) throw new Error(`Database behavior test was not found: ${testFile}`);
const result = spawnSync("psql", [databaseUrl, "--set", "ON_ERROR_STOP=1", "--file", testFile], {
  encoding: "utf8",
  stdio: "inherit"
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);

