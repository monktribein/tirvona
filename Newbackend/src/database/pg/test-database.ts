/**
 * Test helper: creates a throw-away database on the PG_TEST_URL server,
 * applies the given registry DDL and returns a pool for it.
 */
import { randomBytes } from "crypto";
import type { PgPool } from "./pool";
import { nodePgPool } from "./pool";
import { schemaDdl } from "./ddl";
import type { TableDef } from "./registry";

export interface TestDatabase {
  url: string;
  pool: PgPool;
  drop(): Promise<void>;
}

export async function createTestDatabase(tables: TableDef[]): Promise<TestDatabase> {
  const adminUrl = process.env.PG_TEST_URL;
  if (!adminUrl) throw new Error("PG_TEST_URL is not set (run with: npm run test:pg)");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client } = require("pg");
  const name = `tirvona_test_${randomBytes(6).toString("hex")}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = adminUrl.replace(/\/[^/?]+(\?|$)/, `/${name}$1`);
  const pool = nodePgPool(url, { max: 8 });
  await pool.query(schemaDdl(tables));
  return {
    url,
    pool,
    async drop() {
      await pool.end();
      const a = new Client({ connectionString: adminUrl });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await a.end();
    },
  };
}
