#!/usr/bin/env node
/**
 * Tirvona Yatra — staging verification kit.
 *
 *   node docs/tirvona-yatra/staging/tools/yatra-staging-check.mjs <phase>
 *
 * Phases (run in this order):
 *   preflight  safety checks only (no network, no database writes)
 *   db         migrations on the STAGING database: plan, apply, verify, rollback/re-apply (0016, then 0016+0015)
 *   services   Razorpay TEST order + checkout signature, Cloudinary authenticated upload + signed link, Resend email
 *   e2e        full stack against staging: real Razorpay test checkout (one manual step), webhooks, refund, wallet,
 *              ledger, reconciliation, KYC upload through the app, booking email
 *
 * SAFETY
 *  - Staging values are read ONLY from Newbackend/.env.staging, using STAGING_* names the app itself never reads.
 *  - Newbackend/.env (live) is read ONLY to refuse anything that matches production; it is never used or printed.
 *  - Razorpay keys must be test keys (rzp_test_). Same DB host/project, same Cloudinary cloud or key, or the same
 *    Resend key as production => refuse.
 *  - Secrets are never printed. Results (no secrets) are written to docs/tirvona-yatra/staging/results/.
 */
import { createRequire } from "node:module";
import { createHmac, randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const BACKEND = path.join(ROOT, "Newbackend");
const FRONTEND = path.join(ROOT, "frontend");
const RESULTS = path.join(ROOT, "docs/tirvona-yatra/staging/results");
const requireB = createRequire(path.join(BACKEND, "package.json"));
const phase = process.argv[2] ?? "preflight";
const results = [];
const record = (check, status, evidence = "") => {
  results.push({ check, status, evidence });
  console.log(`${status.padEnd(7)} ${check}${evidence ? `  — ${evidence}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A real 1×1 PNG (Cloudinary rejects fake images).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

// ------------------------------------------------------------------ env files
function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}
const dbIdentity = (url) => {
  try {
    const u = new URL(url);
    const ref = (u.username.match(/^postgres\.([a-z0-9]+)$/) ?? u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/) ?? [])[1] ?? "";
    return { host: u.hostname, user: u.username, ref };
  } catch {
    return null;
  }
};

/** Validates .env.staging against production. Returns the staging config or exits. */
function preflight({ needDb = false, needServices = false } = {}) {
  const stagingFile = path.join(BACKEND, ".env.staging");
  const s = parseEnv(stagingFile);
  const prod = parseEnv(path.join(BACKEND, ".env"));
  const problems = [];
  const ok = (cond, msg) => { if (!cond) problems.push(msg); return cond; };
  ok(fs.existsSync(stagingFile), "Newbackend/.env.staging does not exist (copy docs/tirvona-yatra/staging/env.staging.example)");
  const tracked = (() => { try { execFileSync("git", ["-C", ROOT, "ls-files", "--error-unmatch", "Newbackend/.env.staging"], { stdio: "ignore" }); return true; } catch { return false; } })();
  ok(!tracked, "Newbackend/.env.staging is tracked by git — remove it from git");

  if (needDb) {
    const st = dbIdentity(s.STAGING_SUPABASE_DB_URL ?? "");
    const pr = dbIdentity(prod.SUPABASE_DB_URL ?? "");
    if (ok(st, "STAGING_SUPABASE_DB_URL is missing or not a URL") && pr) {
      ok(!(st.host === pr.host && st.user === pr.user), "STAGING_SUPABASE_DB_URL points at the PRODUCTION database");
      ok(!pr.ref || (st.ref !== pr.ref && !String(s.STAGING_SUPABASE_DB_URL).includes(pr.ref)), "STAGING_SUPABASE_DB_URL belongs to the PRODUCTION Supabase project");
    }
  }
  if (needServices) {
    const key = s.STAGING_RAZORPAY_KEY_ID ?? "";
    ok(key.startsWith("rzp_test_"), "STAGING_RAZORPAY_KEY_ID must be a Razorpay TEST key (rzp_test_…)");
    ok(key !== prod.RAZORPAY_KEY_ID, "STAGING_RAZORPAY_KEY_ID equals the production key");
    ok(Boolean(s.STAGING_RAZORPAY_KEY_SECRET) && s.STAGING_RAZORPAY_KEY_SECRET !== prod.RAZORPAY_KEY_SECRET, "STAGING_RAZORPAY_KEY_SECRET missing or equal to production");
    ok(Boolean(s.STAGING_RAZORPAY_WEBHOOK_SECRET) && s.STAGING_RAZORPAY_WEBHOOK_SECRET !== prod.RAZORPAY_WEBHOOK_SECRET, "STAGING_RAZORPAY_WEBHOOK_SECRET missing or equal to production");
    ok(Boolean(s.STAGING_CLOUDINARY_CLOUD_NAME) && s.STAGING_CLOUDINARY_CLOUD_NAME !== prod.CLOUDINARY_CLOUD_NAME, "STAGING_CLOUDINARY_CLOUD_NAME missing or equal to production");
    ok(Boolean(s.STAGING_CLOUDINARY_API_KEY) && s.STAGING_CLOUDINARY_API_KEY !== prod.CLOUDINARY_API_KEY, "STAGING_CLOUDINARY_API_KEY missing or equal to production");
    ok(Boolean(s.STAGING_CLOUDINARY_API_SECRET), "STAGING_CLOUDINARY_API_SECRET missing");
    ok(Boolean(s.STAGING_RESEND_API_KEY) && s.STAGING_RESEND_API_KEY !== prod.RESEND_API_KEY, "STAGING_RESEND_API_KEY missing or equal to production");
    ok(/@/.test(s.STAGING_RESEND_FROM_EMAIL ?? ""), "STAGING_RESEND_FROM_EMAIL missing");
    ok(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.STAGING_TEST_EMAIL_TO ?? ""), "STAGING_TEST_EMAIL_TO missing (a mailbox you can read)");
  }
  if (problems.length) {
    for (const p of problems) record(`preflight: ${p}`, "REFUSED");
    finish(2);
  }
  record("preflight: staging configuration is separate from production", "PASS", `${needDb ? "database" : ""}${needDb && needServices ? " + " : ""}${needServices ? "Razorpay test / Cloudinary / Resend" : ""}`.trim());
  return s;
}

function finish(code) {
  fs.mkdirSync(RESULTS, { recursive: true });
  const file = path.join(RESULTS, `${phase}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ phase, at: new Date().toISOString(), results }, null, 2));
  const tally = results.reduce((t, r) => ((t[r.status] = (t[r.status] ?? 0) + 1), t), {});
  console.log(`\n${JSON.stringify(tally)}  → ${path.relative(ROOT, file)}`);
  process.exit(code);
}

// --------------------------------------------------------------------- helpers
const baseEnv = () => {
  const keep = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOME", "HOMEDRIVE", "HOMEPATH", "ComSpec", "PATHEXT", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE"];
  return Object.fromEntries(keep.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
};
async function stagingDb(url) {
  // Reuse the repository's own connection helper (SSL / pooler handling); force the staging URL.
  process.env.SUPABASE_MIGRATION_URL = url;
  process.env.SUPABASE_DB_URL = url;
  const lib = requireB(path.join(BACKEND, "database/lib.js"));
  return lib.connect("yatra-staging-check");
}
const dbTool = (script, url, args = []) =>
  execFileSync(process.execPath, [path.join(BACKEND, "database", script), ...args], { cwd: BACKEND, env: { ...baseEnv(), SUPABASE_DB_URL: url, SUPABASE_MIGRATION_URL: url }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const configOf = (values) => ({ get: (k) => values[k], getOrThrow: (k) => values[k] });
let tsReady = false;
const loadTs = (rel) => {
  if (!tsReady) {
    requireB(path.join(BACKEND, "database/lib.js")).registerTypeScript();
    tsReady = true;
  }
  return requireB(path.join(BACKEND, rel));
};

// ========================================================================== db
async function phaseDb() {
  const s = preflight({ needDb: true });
  const url = s.STAGING_SUPABASE_DB_URL;
  const state = async () => {
    const c = await stagingDb(url);
    try {
      const yatra = (await c.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'yatra\\_%'")).rows[0].n;
      const all = (await c.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'")).rows[0].n;
      const hasLedger = (await c.query("SELECT to_regclass('public.schema_migrations') AS t")).rows[0].t !== null;
      const migs = hasLedger ? (await c.query("SELECT name FROM public.schema_migrations WHERE name LIKE '001%' ORDER BY name")).rows.map((r) => r.name) : [];
      return { yatra, all, m15: migs.includes("0015_yatra_module.sql"), m16: migs.includes("0016_yatra_rides_finance_ops.sql") };
    } finally {
      await c.end();
    }
  };
  const rollback = async (file) => {
    const c = await stagingDb(url);
    try { await c.query(fs.readFileSync(path.join(BACKEND, "database/rollback", file), "utf8")); } finally { await c.end(); }
  };
  try {
    const before = await state();
    record("db: connected to the staging database", "PASS", `${before.all} public tables before; 0015 applied=${before.m15}, 0016 applied=${before.m16}`);
    record("db: migrate --plan", "INFO", dbTool("migrate.js", url, ["--plan"]).split("\n").slice(-6).join(" | "));
    dbTool("migrate.js", url);
    record("db: migrate", "PASS");
    const v1 = dbTool("verify.js", url);
    record("db: verify after apply", /schema OK/.test(v1) && /nothing pending/.test(v1) ? "PASS" : "FAIL", v1.split("\n").slice(-2).join(" | "));
    record("db: migrate again is a no-op", /up to date/i.test(dbTool("migrate.js", url)) ? "PASS" : "FAIL");
    let st = await state();
    record("db: 22 Yatra tables, both migrations recorded", st.yatra === 22 && st.m15 && st.m16 ? "PASS" : "FAIL", JSON.stringify(st));
    await rollback("0016_yatra_rides_finance_ops.down.sql");
    st = await state();
    record("db: rollback 0016 leaves the 15 P0–P4 tables", st.yatra === 15 && st.m15 && !st.m16 ? "PASS" : "FAIL", JSON.stringify(st));
    dbTool("migrate.js", url);
    const v2 = dbTool("verify.js", url);
    record("db: re-apply 0016 and verify", /schema OK/.test(v2) ? "PASS" : "FAIL");
    const total = (await state()).all;
    await rollback("0016_yatra_rides_finance_ops.down.sql");
    await rollback("0015_yatra_module.down.sql");
    st = await state();
    record("db: full rollback removes every Yatra table and leaves the rest", st.yatra === 0 && !st.m15 && !st.m16 && st.all === total - 22 ? "PASS" : "FAIL", JSON.stringify(st));
    dbTool("migrate.js", url);
    const v3 = dbTool("verify.js", url);
    st = await state();
    record("db: re-apply 0015 + 0016 and verify", /schema OK/.test(v3) && st.yatra === 22 ? "PASS" : "FAIL", v3.split("\n").slice(-2).join(" | "));
  } catch (e) {
    record("db: unexpected error", "FAIL", String(e.stderr || e.message).slice(0, 400));
  }
  finish(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

// =================================================================== services
async function phaseServices() {
  const s = preflight({ needServices: true });
  // --- Razorpay (TEST mode) through Tirvona's own gateway class.
  try {
    const { YatraGatewayService } = loadTs("src/modules/yatra/application/yatra-support.service.ts");
    const gw = new YatraGatewayService(configOf({ razorpayKeyId: s.STAGING_RAZORPAY_KEY_ID, razorpayKeySecret: s.STAGING_RAZORPAY_KEY_SECRET, nodeEnv: "production" }));
    const order = await gw.createOrder(1, `yatra-staging-${Date.now()}`, { purpose: "staging_check" });
    record("razorpay: test order created by YatraGatewayService", order.demo === false && /^order_/.test(order.orderId) && order.amount === 100 ? "PASS" : "FAIL", `order ${order.orderId}, ${order.amount} paise`);
    const Razorpay = requireB("razorpay");
    const fetched = await new Razorpay({ key_id: s.STAGING_RAZORPAY_KEY_ID, key_secret: s.STAGING_RAZORPAY_KEY_SECRET }).orders.fetch(order.orderId);
    record("razorpay: order visible in the Razorpay TEST account", fetched.status === "created" && Number(fetched.amount) === 100 ? "PASS" : "FAIL", `status ${fetched.status}`);
    const sig = createHmac("sha256", s.STAGING_RAZORPAY_KEY_SECRET).update(`${order.orderId}|pay_stagingcheck01`).digest("hex");
    record("razorpay: checkout signature verified with the test secret; tampered rejected", gw.verifySignature(order.orderId, "pay_stagingcheck01", sig) && !gw.verifySignature(order.orderId, "pay_other", sig) ? "PASS" : "FAIL");
    record("razorpay: demo payments refused (production mode, keys configured)", !gw.verifySignature("demo_order_x", "demo_pay_x", "") ? "PASS" : "FAIL");
  } catch (e) {
    record("razorpay: error", "FAIL", String(e.message).slice(0, 300));
  }
  // --- Cloudinary (separate test account) through Tirvona's private storage class.
  try {
    const { YatraDocumentStorage } = loadTs("src/modules/yatra/application/yatra-support.service.ts");
    const storage = new YatraDocumentStorage(configOf({ cloudinaryCloudName: s.STAGING_CLOUDINARY_CLOUD_NAME, cloudinaryApiKey: s.STAGING_CLOUDINARY_API_KEY, cloudinaryApiSecret: s.STAGING_CLOUDINARY_API_SECRET, cloudinaryFolder: "tirvona-staging" }));
    const stored = await storage.put(PNG, "yatra-staging-check", "image");
    record("cloudinary: authenticated upload", Boolean(stored.publicId) ? "PASS" : "FAIL", stored.publicId);
    const link = storage.signedUrl({ ...stored, format: stored.format || "png" });
    const signed = await fetch(link.url);
    record("cloudinary: signed 5-minute link opens the file", signed.status === 200 ? "PASS" : "FAIL", `HTTP ${signed.status}, expires ${new Date(link.expiresAt).toISOString()}`);
    const plain = await fetch(`https://res.cloudinary.com/${s.STAGING_CLOUDINARY_CLOUD_NAME}/image/authenticated/${stored.publicId}.png`);
    const publicUrl = await fetch(`https://res.cloudinary.com/${s.STAGING_CLOUDINARY_CLOUD_NAME}/image/upload/${stored.publicId}.png`);
    record("cloudinary: file is NOT reachable without a signature", plain.status >= 400 && publicUrl.status >= 400 ? "PASS" : "FAIL", `unsigned authenticated URL HTTP ${plain.status}; public URL HTTP ${publicUrl.status}`);
    await storage.remove(stored);
    record("cloudinary: test file removed", "PASS");
  } catch (e) {
    record("cloudinary: error", "FAIL", String(e.message).slice(0, 300));
  }
  // --- Resend (staging key) through Tirvona's notifier, plus a direct SDK check.
  try {
    const { Resend } = requireB("resend");
    const direct = await new Resend(s.STAGING_RESEND_API_KEY).emails.send({ from: s.STAGING_RESEND_FROM_EMAIL, to: s.STAGING_TEST_EMAIL_TO, subject: "[STAGING] Tirvona Yatra email check", text: "Staging email check from the Tirvona Yatra verification kit. No action needed." });
    record("resend: staging key accepted a test email", direct?.data?.id && !direct.error ? "PASS" : "FAIL", direct?.error ? `${direct.error.name}: ${direct.error.message}` : `id ${direct?.data?.id}`);
    const { YatraNotifier } = loadTs("src/modules/yatra/application/yatra-support.service.ts");
    const notifier = new YatraNotifier({}, {}, { findById: () => ({ select: () => ({ lean: async () => null }) }) }, configOf({ yatraEmailEnabled: true, resendApiKey: s.STAGING_RESEND_API_KEY, resendFromEmail: s.STAGING_RESEND_FROM_EMAIL, frontendUrl: "https://staging.tirvona.invalid" }));
    const sent = await notifier.emailCustomer({ contact: { email: s.STAGING_TEST_EMAIL_TO, name: "Staging check" } }, { title: "[STAGING] Your Yatra booking is confirmed", message: "This is the Yatra booking email template sent from staging.", reference: "TVN-YTR-STAGING", highlight: { label: "Ticket code", code: "STG-001" }, ctaPath: "/profile/journeys" });
    record("resend: Yatra booking email sent through YatraNotifier", sent ? "PASS" : "FAIL", `check ${s.STAGING_TEST_EMAIL_TO.replace(/^(.).*(@.*)$/, "$1***$2")} for 2 "[STAGING]" emails`);
  } catch (e) {
    record("resend: error", "FAIL", String(e.message).slice(0, 300));
  }
  finish(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

// ========================================================================= e2e
async function phaseE2e() {
  const s = preflight({ needDb: true, needServices: true });
  const pg = await stagingDb(s.STAGING_SUPABASE_DB_URL);
  const q = async (sql, params = []) => (await pg.query(sql, params)).rows;
  const { ObjectId } = requireB("bson");
  const jwt = requireB("jsonwebtoken");
  const bcrypt = requireB("bcryptjs");
  const API_PORT = 5065, WEB_PORT = 5175;
  const API = `http://127.0.0.1:${API_PORT}/api`;
  const WEB = `http://localhost:${WEB_PORT}`;
  const JWT_SECRET = randomBytes(32).toString("hex");
  const procs = [];
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "yatra-staging-api-"));
  const cleanup = async () => {
    for (const p of procs) try { p.kill(); } catch {}
    try { fs.rmdirSync(path.join(work, "node_modules")); } catch {} // junction only; never the target
    try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
    try { await pg.end(); } catch {}
  };
  process.on("SIGINT", async () => { await cleanup(); process.exit(1); });
  try {
    // 1) Build the committed backend into a temporary folder with no .env (the API reads .env from its cwd).
    execFileSync(process.execPath, [path.join(BACKEND, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.build.json", "--outDir", path.join(work, "api-next")], { cwd: BACKEND, stdio: "ignore" });
    fs.symlinkSync(path.join(BACKEND, "node_modules"), path.join(work, "node_modules"), "junction");
    if (fs.existsSync(path.join(work, ".env"))) throw new Error("refusing: .env in the staging API folder");
    record("e2e: committed backend built for staging", "PASS");
    const api = spawn(process.execPath, ["api-next/main.js"], {
      cwd: work,
      env: {
        ...baseEnv(), NODE_ENV: "development", HOST: "127.0.0.1", PORT: String(API_PORT), LOG_LEVEL: "warn",
        SUPABASE_DB_URL: s.STAGING_SUPABASE_DB_URL, SUPABASE_MIGRATION_URL: s.STAGING_SUPABASE_DB_URL, REDIS_URL: "redis://127.0.0.1:1",
        JWT_SECRET, FRONTEND_URL: WEB, CORS_ORIGINS: `${WEB},http://127.0.0.1:${WEB_PORT}`, PAYOUT_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
        RAZORPAY_KEY_ID: s.STAGING_RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET: s.STAGING_RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: s.STAGING_RAZORPAY_WEBHOOK_SECRET,
        CLOUDINARY_CLOUD_NAME: s.STAGING_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY: s.STAGING_CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET: s.STAGING_CLOUDINARY_API_SECRET, CLOUDINARY_FOLDER: "tirvona-staging",
        RESEND_API_KEY: s.STAGING_RESEND_API_KEY, RESEND_FROM_EMAIL: s.STAGING_RESEND_FROM_EMAIL,
        YATRA_ENABLED: "true", YATRA_EMAIL_ENABLED: "true", YATRA_MAINTENANCE_ENABLED: "false", YATRA_RECONCILIATION_ENABLED: "false",
        WHATSAPP_ENABLED: "false", MSG91_AUTH_KEY: "", PROVIDERS_MAINTENANCE_ENABLED: "false", FOOD_MAINTENANCE_ENABLED: "false", HR_REMINDERS_ENABLED: "false", AARTI_MAINTENANCE_ENABLED: "false",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    procs.push(api);
    let apiErr = "";
    api.stderr.on("data", (d) => (apiErr += d.toString()));
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { await sleep(1000); try { up = (await fetch(`${API}/v1/yatra/config`)).ok; } catch {} }
    if (!up) throw new Error(`staging API did not start: ${apiErr.slice(-400)}`);
    record("e2e: API started on the staging database with test credentials (local process only)", "PASS");

    // 2) Users (staging only). The pilgrim uses your test mailbox so the booking email reaches you.
    const password = `Stg-${randomBytes(6).toString("hex")}`;
    const hash = await bcrypt.hash(password, 10);
    const mkUser = async (key, role, name, email) => {
      const existing = (await q("SELECT id FROM public.users WHERE email = $1", [email]))[0];
      const id = existing?.id ?? new ObjectId().toHexString();
      if (existing) await q("UPDATE public.users SET password_hash = $2, status = 'active', role = $3 WHERE id = $1", [id, hash, role]);
      else await q(`INSERT INTO public.users (id, name, email, phone, role, status, is_suspended, is_deleted, token_version, permissions, scoped_ashram_ids, scoped_temple_ids, password_hash, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,'active',false,false,0,'[]','[]','[]',$6,now(),now())`, [id, name, email, `9${String(Date.now()).slice(-9)}`, role, hash]);
      return { key, id, role, name, email, token: jwt.sign({ sub: id, id, tv: 0 }, JWT_SECRET, { issuer: "tirvona-api", audience: "tirvona-clients", expiresIn: "3h" }) };
    };
    const tag = Date.now();
    const U = {
      admin: await mkUser("admin", "super_admin", "Staging Admin", `staging.admin.${tag}@tirvona.invalid`),
      finance: await mkUser("finance", "finance_manager", "Staging Finance", `staging.finance.${tag}@tirvona.invalid`),
      owner: await mkUser("owner", "customer", "Staging Organiser", `staging.owner.${tag}@tirvona.invalid`),
      pilgrim: await mkUser("pilgrim", "customer", "Staging Pilgrim", s.STAGING_TEST_EMAIL_TO.toLowerCase()),
      other: await mkUser("other", "customer", "Staging Other Pilgrim", `staging.other.${tag}@tirvona.invalid`),
    };
    const call = async (method, p, user, body, raw = false) => {
      const r = await fetch(`${API}${p}`, { method, headers: { ...(body instanceof FormData ? {} : { "content-type": "application/json" }), ...(user ? { authorization: `Bearer ${user.token}` } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
      const json = await r.json().catch(() => ({}));
      if (raw) return { status: r.status, json };
      if (r.status >= 400) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(json).slice(0, 240)}`);
      return json.data ?? json;
    };
    const upload = (p, user, fields) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.append(k, v); f.append("file", new Blob([PNG], { type: "image/png" }), "doc.png"); return call("POST", p, user, f); };

    // 3) Catalogue through the app (KYC files go to the Cloudinary TEST account).
    if (!(await q("SELECT id FROM public.yatra_commission_rules WHERE status = 'active' AND applies_to = 'yatra_booking' LIMIT 1")).length)
      await call("POST", "/v1/yatra/finance/rules", U.finance, { appliesTo: "yatra_booking", channel: "any", commissionBps: 1000, taxOnCommissionBps: 1800, name: "Staging rule" });
    const reg = await call("POST", "/v1/yatra/operator/register", U.owner, { organisationName: `Staging Travels ${tag}`, city: "Mathura", contactPhone: "9876500001" });
    const operatorId = reg.operator.id;
    await call("PATCH", "/v1/yatra/operator/profile", U.owner, { panNumber: "ABCDE1234F" });
    const pan = await upload("/v1/yatra/operator/documents", U.owner, { documentType: "pan_card" });
    await call("POST", "/v1/yatra/operator/submit", U.owner, { acceptTerms: true });
    await call("POST", `/v1/yatra/admin/operators/${operatorId}/review`, U.admin, { action: "approve" });
    const link = await call("GET", `/v1/yatra/admin/documents/${pan.id}/link`, U.admin);
    const signedFile = await fetch(link.url);
    record("e2e: organiser KYC uploaded through the app to Cloudinary TEST; signed link opens it", signedFile.status === 200 ? "PASS" : "FAIL", `HTTP ${signedFile.status}`);
    record("e2e: KYC link denied to other users", (await call("GET", `/v1/yatra/admin/documents/${pan.id}/link`, U.other, null, true)).status === 403 ? "PASS" : "FAIL");
    const vehicle = await call("POST", "/v1/yatra/operator/vehicles", U.owner, { registrationNumber: `UP85ST${String(tag).slice(-4)}`, seatCapacity: 20, layoutTemplate: "2x2" });
    for (const t of ["registration_certificate", "insurance", "tourist_permit"]) await upload("/v1/yatra/operator/documents", U.owner, { documentType: t, vehicleId: vehicle.id });
    await call("POST", `/v1/yatra/operator/vehicles/${vehicle.id}/submit`, U.owner);
    await call("POST", `/v1/yatra/admin/vehicles/${vehicle.id}/review`, U.admin, { action: "approve" });
    const tour = await call("POST", "/v1/yatra/operator/tours", U.owner, { title: `Staging Braj Darshan ${tag}`, originCity: "Delhi", destinationCity: "Vrindavan", durationDays: 2, baseFare: 10, summary: "Staging test tour", itinerary: [{ dayNumber: 1, title: "Day one" }], inclusions: ["Bus"] });
    await call("POST", `/v1/yatra/operator/tours/${tour.id}/submit`, U.owner);
    await call("POST", `/v1/yatra/admin/tours/${tour.id}/review`, U.admin, { action: "publish" });
    const dep = await call("POST", "/v1/yatra/operator/departures", U.owner, { tourId: tour.id, vehicleId: vehicle.id, departAt: new Date(Date.now() + 20 * 86400000).toISOString(), boardingPoints: [{ name: "Staging stop" }] });
    await call("POST", `/v1/yatra/operator/departures/${dep.id}/open`, U.owner);
    const bp = dep.boardingPoints[0].id;
    record("e2e: organiser, vehicle, tour and departure created and published through the app", "PASS", dep.departureCode);
    const hold = (user, seat) => call("POST", "/v1/yatra/bookings", user, { departureCode: dep.departureCode, seats: [seat], boardingPointId: bp, passengers: [{ name: user.name }], contact: { name: user.name, phone: "9876543210", email: user.email } });
    const sign = (orderId, paymentId) => createHmac("sha256", s.STAGING_RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    const webhook = async (payment, eventId) => {
      const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: payment } } });
      const r = await fetch(`${API}/payments/razorpay/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": createHmac("sha256", s.STAGING_RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex"), "x-razorpay-event-id": eventId }, body });
      return r.status;
    };
    const counts = async (bookingId) => (await q("SELECT (SELECT count(*)::int FROM public.yatra_ledger_entries WHERE booking_id = $1 AND type = 'booking_payment') AS payments, (SELECT count(*)::int FROM public.yatra_journeys WHERE booking_id = $1) AS journeys, (SELECT status FROM public.yatra_bookings WHERE id = $1) AS status", [bookingId]))[0];

    // 4) Booking A: real Razorpay TEST order; checkout signature computed with the test secret.
    const a = await hold(U.pilgrim, "1");
    const orderA = await call("POST", `/v1/yatra/bookings/${a.id}/payment-order`, U.pilgrim);
    const bad = await call("POST", `/v1/yatra/bookings/${a.id}/confirm-payment`, U.pilgrim, { razorpay_order_id: orderA.orderId, razorpay_payment_id: "pay_stagingA0001", razorpay_signature: "0".repeat(64) }, true);
    const okA = await call("POST", `/v1/yatra/bookings/${a.id}/confirm-payment`, U.pilgrim, { razorpay_order_id: orderA.orderId, razorpay_payment_id: "pay_stagingA0001", razorpay_signature: sign(orderA.orderId, "pay_stagingA0001") }, true);
    record("e2e: real test order; forged signature rejected, test-secret signature confirms", orderA.demo === false && bad.status === 400 && okA.status === 201 ? "PASS" : "FAIL", `order ${orderA.orderId}; forged ${bad.status}; signed ${okA.status}`);

    // 5) Booking C: webhook arrives first, then a duplicate, then the late client confirmation.
    const c = await hold(U.pilgrim, "2");
    const orderC = await call("POST", `/v1/yatra/bookings/${c.id}/payment-order`, U.pilgrim);
    const payC = { id: "pay_stagingC0001", order_id: orderC.orderId, amount: orderC.amount, currency: "INR", status: "captured" };
    const w1 = await webhook(payC, `evt_staging_c_${tag}`);
    const w2 = await webhook(payC, `evt_staging_c_${tag}`);
    const w3 = await webhook(payC, `evt_staging_c2_${tag}`);
    const late = await call("POST", `/v1/yatra/bookings/${c.id}/confirm-payment`, U.pilgrim, { razorpay_order_id: orderC.orderId, razorpay_payment_id: payC.id, razorpay_signature: sign(orderC.orderId, payC.id) }, true);
    const cc = await counts(c.id);
    record("e2e: webhook-first, duplicate and re-delivered webhooks, then late client confirm → processed once", [w1, w2, w3].every((x) => x < 300) && late.status === 201 && cc.payments === 1 && cc.journeys === 1 && cc.status === "confirmed" ? "PASS" : "FAIL", `webhooks ${w1}/${w2}/${w3}; late confirm ${late.status}; ledger ${cc.payments}; journeys ${cc.journeys}`);
    const forged = await fetch(`${API}/payments/razorpay/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": "bad", "x-razorpay-event-id": `evt_forged_${tag}` }, body: JSON.stringify({ event: "payment.captured", payload: { payment: { entity: payC } } }) });
    record("e2e: forged webhook rejected", forged.status === 401 ? "PASS" : "FAIL", `HTTP ${forged.status}`);

    // 6) Booking B: REAL hosted checkout in Razorpay TEST mode (manual step in your browser).
    const b = await hold(U.pilgrim, "3");
    await call("POST", `/v1/yatra/bookings/${b.id}/payment-order`, U.pilgrim);
    const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", String(WEB_PORT), "--strictPort", "--host", "localhost"], { cwd: FRONTEND, env: { ...baseEnv(), VITE_API_URL: `http://localhost:${API_PORT}` }, stdio: "ignore" });
    procs.push(vite);
    console.log(`\n==== MANUAL STEP (Razorpay TEST mode — no real money) ====\n1. Open ${WEB}/login and sign in as ${U.pilgrim.email} with password ${password}\n2. Open ${WEB}/yatra/checkout/${b.id} and press Pay\n3. Pay with a Razorpay TEST card (e.g. 4111 1111 1111 1111, any future expiry, any CVV) and choose "Success"\nWaiting up to 15 minutes…\n`);
    let paidB = false;
    for (let i = 0; i < 180 && !paidB; i++) { await sleep(5000); paidB = (await counts(b.id)).status === "confirmed"; }
    if (!paidB) record("e2e: real Razorpay TEST checkout", "BLOCKED", "manual payment not completed within 15 minutes");
    else {
      const row = (await q("SELECT gateway, amount, method FROM public.yatra_payments WHERE booking_id = $1 AND status = 'paid' ORDER BY paid_at DESC LIMIT 1", [b.id]))[0];
      const paymentId = row?.gateway?.paymentId;
      const Razorpay = requireB("razorpay");
      const real = await new Razorpay({ key_id: s.STAGING_RAZORPAY_KEY_ID, key_secret: s.STAGING_RAZORPAY_KEY_SECRET }).payments.fetch(paymentId);
      record("e2e: real Razorpay TEST payment confirmed the booking", ["captured", "authorized"].includes(real.status) && Number(real.amount) === Math.round(Number(row.amount) * 100) ? "PASS" : "FAIL", `${paymentId} ${real.status} ${real.amount} paise via ${real.method}`);
      const d1 = await webhook({ id: real.id, order_id: real.order_id, amount: real.amount, currency: real.currency, status: "captured" }, `evt_staging_b_${tag}`);
      const d2 = await webhook({ id: real.id, order_id: real.order_id, amount: real.amount, currency: real.currency, status: "captured" }, `evt_staging_b2_${tag}`);
      const bc = await counts(b.id);
      record("e2e: late / duplicate webhooks for the real payment → no double processing", d1 < 300 && d2 < 300 && bc.payments === 1 && bc.journeys === 1 ? "PASS" : "FAIL", `webhooks ${d1}/${d2}; ledger ${bc.payments}; journeys ${bc.journeys}`);
    }

    // 7) Refund to wallet (exact amount, once), ledger, and reconciliation.
    const target = paidB ? { id: b.id, user: U.pilgrim } : { id: a.id, user: U.pilgrim };
    const walletOf = async (id) => Number((await q("SELECT balance FROM public.pilgrim_wallets WHERE user_id = $1", [id]))[0]?.balance ?? 0);
    const w0 = await walletOf(target.user.id);
    await call("POST", `/v1/yatra/bookings/${target.id}/cancel-request`, target.user, { reason: "Staging refund check" });
    const decided = await call("POST", `/v1/yatra/admin/bookings/${target.id}/cancellation`, U.admin, { decision: "approve" });
    const refund = Number(decided.cancellation?.refundAmount ?? 0);
    const again = await call("POST", `/v1/yatra/admin/bookings/${target.id}/cancellation`, U.admin, { decision: "approve" }, true);
    const w1b = await walletOf(target.user.id);
    const ledgerRefunds = (await q("SELECT count(*)::int AS n FROM public.yatra_ledger_entries WHERE booking_id = $1 AND type = 'booking_refund'", [target.id]))[0].n;
    record("e2e: refund credited to the Tirvona wallet exactly once; ledger has one refund row", Math.round((w1b - w0) * 100) === Math.round(refund * 100) && again.status === 409 && ledgerRefunds === (refund > 0 ? 1 : 0) ? "PASS" : "FAIL", `refund ₹${refund}; wallet +₹${(w1b - w0).toFixed(2)}; repeat ${again.status}; ledger rows ${ledgerRefunds}`);
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    const recon = await call("POST", "/v1/yatra/finance/reconciliation", U.finance, { date: today });
    record("e2e: Razorpay reconciliation ran against the TEST account", recon.status === "completed" ? "PASS" : "FAIL", `checked ${recon.checkedCount}, matched ${recon.matchedCount}, mismatches ${(recon.mismatches ?? []).length} (simulated pay_staging* ids are expected mismatches)`);

    // 8) Permissions on staging.
    const deny = await Promise.all([call("GET", "/v1/yatra/admin/overview", U.pilgrim, null, true), call("GET", "/v1/yatra/finance/dashboard", U.owner, null, true), call("GET", "/v1/yatra/ops/dashboard", U.finance, null, true)]);
    const allow = await Promise.all([call("GET", "/v1/yatra/finance/dashboard", U.finance, null, true), call("GET", "/v1/yatra/admin/overview", U.admin, null, true)]);
    record("e2e: role checks on staging (pilgrim/organiser/finance denied; finance/admin allowed)", deny.every((r) => r.status === 403) && allow.every((r) => r.status === 200) ? "PASS" : "FAIL", `denied ${deny.map((r) => r.status).join("/")}; allowed ${allow.map((r) => r.status).join("/")}`);
    if (paidB) record("e2e: booking email", "MANUAL", `confirm the "Your Yatra booking is confirmed" email arrived at ${s.STAGING_TEST_EMAIL_TO.replace(/^(.).*(@.*)$/, "$1***$2")}`);
  } catch (e) {
    record("e2e: unexpected error", "FAIL", String(e.message).slice(0, 400));
  } finally {
    await cleanup();
  }
  finish(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

// ========================================================================= main
if (phase === "preflight") { preflight({ needDb: true, needServices: true }); finish(0); }
else if (phase === "db") await phaseDb();
else if (phase === "services") await phaseServices();
else if (phase === "e2e") await phaseE2e();
else { console.error("Usage: yatra-staging-check.mjs preflight|db|services|e2e"); process.exit(64); }
