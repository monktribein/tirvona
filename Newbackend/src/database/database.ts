/**
 * Storage: Supabase Postgres, reached through the Mongoose storage driver in
 * ./pg. Must run before Nest creates any Mongoose connection (main.ts and
 * the CLI scripts call it first). Models, hooks and services use Mongoose as
 * their data-mapping layer; every read and write goes to Postgres.
 */
import { REGISTRY } from "./pg/registry.generated";
import { enablePostgresDriver } from "./pg/pg-driver";

/**
 * Logical database name of each Mongoose connection. They map to the
 * Postgres schemas public, leads and smart_contact (see the registry).
 */
export const MAIN_DATABASE = undefined;
export const LEAD_DATABASE = "tirvona_leads";
export const SMART_CONTACT_DATABASE = "tirvona_smart_contact";

/**
 * The connection string Mongoose is given. The Postgres driver ignores it —
 * it uses the pool built from SUPABASE_DB_URL — so it never carries secrets.
 */
export const DRIVER_URI = "postgres://supabase";

export function configureDatabase(env: NodeJS.ProcessEnv = process.env): void {
  const url = env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is required (Supabase Session pooler URL, port 5432)");
  const poolMax = Number(env.SUPABASE_POOL_MAX);
  enablePostgresDriver({
    connectionString: url,
    registry: REGISTRY,
    poolMax: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
    ttlSweep: env.SUPABASE_TTL_SWEEP !== "false",
  });
}
