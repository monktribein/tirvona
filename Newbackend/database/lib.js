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

async function connect(applicationName) {
  const url = loadEnv().SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is not set (Newbackend/.env or environment)");
  const { Client } = require(path.join(BACKEND_DIR, "node_modules/pg"));
  const local = /localhost|127\.0\.0\.1|sslmode=disable/.test(url);
  const client = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, application_name: applicationName });
  await client.connect();
  return client;
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

module.exports = { BACKEND_DIR, MIGRATIONS_DIR, loadEnv, registerTypeScript, connect, redact, migrationFiles };
