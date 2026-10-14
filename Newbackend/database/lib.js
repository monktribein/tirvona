/**
 * Shared helpers for the database tools: paths, .env loading, TypeScript
 * loading, and a Supabase client. Secrets stay in Newbackend/.env.
 */
const fs = require("fs");
const path = require("path");

const BACKEND_DIR = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function loadEnv() {
  const file = path.join(BACKEND_DIR, ".env");
  const out = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[m[1]] = v;
    }
  }
  return { ...out, ...process.env };
}

function registerTypeScript() {
  require(path.join(BACKEND_DIR, "node_modules/ts-node")).register({ transpileOnly: true, project: path.join(BACKEND_DIR, "tsconfig.json") });
  require(path.join(BACKEND_DIR, "node_modules/reflect-metadata"));
}

/**
 * The URL the database tools use. SUPABASE_MIGRATION_URL (optional) lets
 * migrations bypass the Session pooler the running API shares — e.g. the
 * Direct connection (db.<ref>.supabase.co:5432) — so a busy pool cannot
 * block a deploy. Falls back to SUPABASE_DB_URL.
 */
function databaseUrl() {
  const env = loadEnv();
  const url = env.SUPABASE_MIGRATION_URL || env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is not set (Newbackend/.env or environment)");
  return url;
}

/** Supabase's pooler is full (all its client slots are in use). Momentary, so retried. */
const isPoolFull = (error) => {
  const text = `${error && error.code} ${error && error.message}`;
  return /EMAXCONNSESSION|max clients reached|too many clients|remaining connection slots|53300/i.test(text);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect(applicationName) {
  const url = databaseUrl();
  const { Client } = require(path.join(BACKEND_DIR, "node_modules/pg"));
  const local = /localhost|127\.0\.0\.1|sslmode=disable/.test(url);
  // A deploy runs while the old API (and maybe other instances) hold pool
  // slots; wait for one to free up rather than failing the whole deploy.
  const attempts = 12;
  for (let attempt = 1; ; attempt += 1) {
    const client = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, application_name: applicationName });
    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.end().catch(() => undefined);
      if (!isPoolFull(error) || attempt >= attempts) throw error;
      const wait = Math.min(15_000, 2_000 * attempt);
      console.log(`database pool is full, retrying in ${wait / 1000}s (attempt ${attempt}/${attempts - 1})`);
      await sleep(wait);
    }
  }
}

const redact = (s) => String(s).replace(/postgres(ql)?:\/\/\S+/g, "<redacted-uri>");

/** Migration files in apply order: 0001_name.sql, 0002_name.sql, … */
function migrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
    .sort();
}

module.exports = { BACKEND_DIR, MIGRATIONS_DIR, loadEnv, registerTypeScript, connect, databaseUrl, redact, migrationFiles };
