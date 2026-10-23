/// <reference types="jest" />
/**
 * Applies the real migration files (not the registry-derived DDL the HTTP suite uses) to an empty
 * Postgres, then checks that 0013 adds only the HR tables, that the result is exactly the layout the
 * API verifies at startup, that the uniqueness rules the HR services rely on hold in SQL, and that the
 * rollback script removes the HR tables and nothing else.
 */
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REGISTRY } from "../../database/pg/registry.generated";
import { nodePgPool, type PgPool } from "../../database/pg/pool";
import { PgStore } from "../../database/pg/pg-store";

const ROOT = join(__dirname, "..", "..", "..");
const MIGRATIONS = join(ROOT, "database", "migrations");
const HR_MIGRATION = "0013_hr_management.sql";
const HR_TABLES = [
  "hr_attendance", "hr_attendance_corrections", "hr_departments", "hr_designations", "hr_employees",
  "hr_leaves", "hr_offices", "hr_settings", "hr_task_events", "hr_tasks",
];

// Same preprocessing as database/migrate.js: each file runs inside its own transaction.
const sqlOf = (path: string) => readFileSync(path, "utf8").replace(/^\s*(BEGIN|COMMIT);\s*$/gm, "");
const newId = () => randomBytes(12).toString("hex");

describe("HR migration file (real Postgres)", () => {
  let pool: PgPool;
  let dropDatabase: () => Promise<void>;

  const tables = async () =>
    (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1")).rows.map((r: any) => r.table_name as string);

  beforeAll(async () => {
    const adminUrl = process.env.PG_TEST_URL as string;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Client } = require("pg");
    const name = `tirvona_hr_${randomBytes(6).toString("hex")}`;
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

  let beforeHr: string[] = [];

  it("adds only new HR tables on top of every earlier migration", async () => {
    const files = readdirSync(MIGRATIONS).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
    expect(files.at(-1)).toBe(HR_MIGRATION);
    for (const file of files.slice(0, -1)) await pool.query(sqlOf(join(MIGRATIONS, file)));
    beforeHr = await tables();
    expect(beforeHr.some((t) => t.startsWith("hr_"))).toBe(false);

    const sql = readFileSync(join(MIGRATIONS, HR_MIGRATION), "utf8");
    // Additive only: no statement drops or alters anything that already exists.
    expect(sql).not.toMatch(/\bDROP\b|\bALTER TABLE\b(?![^;]*ENABLE ROW LEVEL SECURITY)|\bTRUNCATE\b|\bDELETE\b|\bUPDATE\b/i);
    await pool.query(sqlOf(join(MIGRATIONS, HR_MIGRATION)));
    const after = await tables();
    expect(after.filter((t) => !beforeHr.includes(t)).sort()).toEqual(HR_TABLES);
  });

  it("produces exactly the layout the API verifies at startup", async () => {
    await expect(new PgStore(pool, REGISTRY).verifySchema()).resolves.not.toThrow();
  });

  it("enforces the uniqueness the HR services rely on", async () => {
    const office = newId();
    await pool.query(`INSERT INTO public.hr_offices (id, code, name, name_key) VALUES ('${office}', 'OFF-1', 'Office 1', 'office 1')`);
    await expect(pool.query(`INSERT INTO public.hr_offices (id, code, name, name_key) VALUES ('${newId()}', 'OFF-1', 'Other', 'other')`)).rejects.toThrow(/duplicate key/);

    const employee = (code: string, extra = "") =>
      pool.query(`INSERT INTO public.hr_employees (id, employee_code, full_name, primary_office_id${extra ? ", " + extra.split("=")[0] : ""}) VALUES ('${newId()}', '${code}', 'Name', '${office}'${extra ? `, '${extra.split("=")[1]}'` : ""})`);
    await employee("EMP-1", "work_email=a@x.test");
    await employee("EMP-2"); // no email: optional unique fields allow many empties
    await employee("EMP-3");
    await expect(employee("EMP-1")).rejects.toThrow(/duplicate key/);
    await expect(employee("EMP-4", "work_email=a@x.test")).rejects.toThrow(/duplicate key/);

    const emp = newId();
    await pool.query(`INSERT INTO public.hr_attendance (id, employee_id, date, status) VALUES ('${newId()}', '${emp}', '2026-10-23', 'present')`);
    await expect(pool.query(`INSERT INTO public.hr_attendance (id, employee_id, date, status) VALUES ('${newId()}', '${emp}', '2026-10-23', 'absent')`)).rejects.toThrow(/duplicate key/);

    const dept = newId();
    await pool.query(`INSERT INTO public.hr_designations (id, name, name_key, department_id) VALUES ('${newId()}', 'Lead', 'lead', '${dept}')`);
    await pool.query(`INSERT INTO public.hr_designations (id, name, name_key, department_id) VALUES ('${newId()}', 'Lead', 'lead', '${newId()}')`);
    await expect(pool.query(`INSERT INTO public.hr_designations (id, name, name_key, department_id) VALUES ('${newId()}', 'Lead', 'lead', '${dept}')`)).rejects.toThrow(/duplicate key/);
  });

  it("the rollback script removes the HR tables and nothing else", async () => {
    await pool.query("CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY)");
    await pool.query(`INSERT INTO public.schema_migrations (name) VALUES ('${HR_MIGRATION}') ON CONFLICT DO NOTHING`);
    await pool.query(sqlOf(join(ROOT, "database", "rollback", "0013_hr_management.down.sql")));
    expect((await tables()).filter((t) => t !== "schema_migrations")).toEqual(beforeHr.filter((t) => t !== "schema_migrations"));
    expect((await pool.query(`SELECT count(*)::int AS n FROM public.schema_migrations WHERE name = '${HR_MIGRATION}'`)).rows[0].n).toBe(0);
  });
});
