/// <reference types="jest" />
/**
 * Applies the real migration files (not the registry-derived DDL the other
 * suites use) to an empty Postgres, then checks the result against the layout
 * the API demands at startup, and that the rollback scripts undo exactly the
 * provider tables (newest migration first).
 */
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REGISTRY } from "../../database/pg/registry.generated";
import { nodePgPool, type PgPool } from "../../database/pg/pool";
import { PgStore } from "../../database/pg/pg-store";

const ROOT = join(__dirname, "..", "..", "..");
const MIGRATIONS = join(ROOT, "database", "migrations");
const rollbackOf = (migration: string) =>
  join(ROOT, "database", "rollback", migration.replace(/\.sql$/, ".down.sql"));

const FOUNDATION = "0003_providers_foundation.sql";
const WALLET = "0004_provider_wallet.sql";
const FOUNDATION_TABLES = [
  "availability_rules", "calendar_blocks", "consultation_messages", "expert_consultations", "idempotency_keys",
  "provider_booking_state_history", "provider_bookings", "provider_offerings", "provider_private_profiles",
  "provider_profiles", "ritual_variants", "rituals", "verification_cases", "verification_evidence",
];
const WALLET_TABLES = ["provider_wallets", "provider_wallet_entries", "provider_payout_accounts", "provider_withdrawals"];
const PROVIDER_TABLES = [...FOUNDATION_TABLES, ...WALLET_TABLES];

// Same preprocessing as database/migrate.js: each file runs inside its own transaction.
const sqlOf = (file: string) => readFileSync(join(MIGRATIONS, file), "utf8").replace(/^\s*(BEGIN|COMMIT);\s*$/gm, "");

describe("provider migration files (real Postgres)", () => {
  let pool: PgPool;
  let dropDatabase: () => Promise<void>;

  const tableExists = async (name: string) =>
    (await pool.query(`SELECT to_regclass('public.${name}') AS t`)).rows[0].t !== null;
  const tableCount = async () =>
    (await pool.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'")).rows[0].n;
  const recorded = async (migration: string) =>
    (await pool.query(`SELECT count(*)::int AS n FROM public.schema_migrations WHERE name = '${migration}'`)).rows[0].n;

  beforeAll(async () => {
    const adminUrl = process.env.PG_TEST_URL as string;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Client } = require("pg");
    const name = `tirvona_mig_${randomBytes(6).toString("hex")}`;
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${name}`);
    await admin.end();
    pool = nodePgPool(adminUrl.replace(/\/[^/?]+(\?|$)/, `/${name}$1`), { max: 2 });
    dropDatabase = async () => {
      await pool.end();
      const a = new Client({ connectionString: adminUrl });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await a.end();
    };
  });
  afterAll(async () => {
    await dropDatabase?.();
  });

  it("applies every migration in order to an empty database", async () => {
    const files = readdirSync(MIGRATIONS).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
    expect(files).toEqual(expect.arrayContaining([FOUNDATION, WALLET]));
    expect(files.indexOf(WALLET)).toBeGreaterThan(files.indexOf(FOUNDATION));
    for (const file of files) await pool.query(sqlOf(file));
    for (const table of PROVIDER_TABLES) expect(await tableExists(table)).toBe(true);
  });

  it("produces exactly the layout the API verifies at startup", async () => {
    await expect(new PgStore(pool, REGISTRY).verifySchema()).resolves.not.toThrow();
  });

  it("enforces the uniqueness the services rely on", async () => {
    const insert = (table: string, cols: string, vals: string) =>
      pool.query(`INSERT INTO public.${table} (id, ${cols}) VALUES ('${randomBytes(12).toString("hex")}', ${vals})`);
    await insert("provider_profiles", "user_id, slug", "'u1', 's1'");
    await expect(insert("provider_profiles", "user_id, slug", "'u1', 's2'")).rejects.toThrow(/unique|duplicate/i);
    await expect(insert("provider_profiles", "user_id, slug", "'u2', 's1'")).rejects.toThrow(/unique|duplicate/i);
    // One live case per provider and type, but history of finished cases is unlimited.
    await insert("verification_cases", "provider_id, verification_type, status", "'p1', 'IDENTITY', 'OPEN'");
    await expect(insert("verification_cases", "provider_id, verification_type, status", "'p1', 'IDENTITY', 'IN_REVIEW'")).rejects.toThrow(/unique|duplicate/i);
    await insert("verification_cases", "provider_id, verification_type, status", "'p1', 'IDENTITY', 'REJECTED'");
    await insert("verification_cases", "provider_id, verification_type, status", "'p1', 'IDENTITY', 'REJECTED'");
    // One live offering per provider, variant and fulfilment type; an INACTIVE one does not block a new one.
    await insert("provider_offerings", "provider_id, ritual_variant_id, fulfilment_type, status", "'p1', 'v1', 'LOCAL_HOME', 'ACTIVE'");
    await expect(insert("provider_offerings", "provider_id, ritual_variant_id, fulfilment_type, status", "'p1', 'v1', 'LOCAL_HOME', 'PAUSED'")).rejects.toThrow(/unique|duplicate/i);
    await insert("provider_offerings", "provider_id, ritual_variant_id, fulfilment_type, status", "'p1', 'v1', 'LOCAL_HOME', 'INACTIVE'");
    await insert("idempotency_keys", "key, operation, actor_id", "'k', 'op', 'a'");
    await expect(insert("idempotency_keys", "key, operation, actor_id", "'k', 'op', 'a'")).rejects.toThrow(/unique|duplicate/i);
    await insert("idempotency_keys", "key, operation, actor_id", "'k', 'op', 'b'"); // different caller is independent

    // Wallet: one wallet per provider; a ledger entry is written once per idempotency key, so a
    // retried payment or refund cannot move money twice; one active payout account per provider.
    await insert("provider_wallets", "provider_id, user_id", "'p1', 'u1'");
    await expect(insert("provider_wallets", "provider_id, user_id", "'p1', 'u1'")).rejects.toThrow(/unique|duplicate/i);
    await insert("provider_wallet_entries", "provider_id, idempotency_key", "'p1', 'earning-b1'");
    await expect(insert("provider_wallet_entries", "provider_id, idempotency_key", "'p1', 'earning-b1'")).rejects.toThrow(/unique|duplicate/i);
    await insert("provider_payout_accounts", "provider_id, active", "'p1', true");
    await expect(insert("provider_payout_accounts", "provider_id, active", "'p1', true")).rejects.toThrow(/unique|duplicate/i);
    await insert("provider_payout_accounts", "provider_id, active", "'p1', false"); // replaced accounts are kept
    await insert("provider_withdrawals", "withdrawal_number, provider_id", "'PWD-1', 'p1'");
    await expect(insert("provider_withdrawals", "withdrawal_number, provider_id", "'PWD-1', 'p1'")).rejects.toThrow(/unique|duplicate/i);
  });

  it("rolls back exactly the provider tables, newest first, and leaves the rest alone", async () => {
    await pool.query("CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    await pool.query(`INSERT INTO public.schema_migrations (name) VALUES ('${FOUNDATION}'), ('${WALLET}')`);
    const before = await tableCount();

    await pool.query(readFileSync(rollbackOf(WALLET), "utf8"));
    for (const table of WALLET_TABLES) expect(await tableExists(table)).toBe(false);
    for (const table of FOUNDATION_TABLES) expect(await tableExists(table)).toBe(true);
    expect(await recorded(WALLET)).toBe(0);
    expect(await recorded(FOUNDATION)).toBe(1);

    await pool.query(readFileSync(rollbackOf(FOUNDATION), "utf8"));
    for (const table of PROVIDER_TABLES) expect(await tableExists(table)).toBe(false);
    expect(before - (await tableCount())).toBe(PROVIDER_TABLES.length);
    expect(await tableExists("users")).toBe(true);
    expect(await recorded(FOUNDATION)).toBe(0);
  });

  it("can be applied again after a rollback", async () => {
    // Re-apply every migration from the provider foundation on, in order (later ones add columns to these tables).
    const files = readdirSync(MIGRATIONS).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
    for (const file of files.slice(files.indexOf(FOUNDATION))) await pool.query(sqlOf(file));
    for (const table of PROVIDER_TABLES) expect(await tableExists(table)).toBe(true);
    await expect(new PgStore(pool, REGISTRY).verifySchema()).resolves.not.toThrow();
  });
});
