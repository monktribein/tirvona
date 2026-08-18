/**
 * Configuration for the Lead Collection subsystem.
 *
 * Read straight from `process.env` rather than from the platform's
 * `environment()` factory: the module is meant to be liftable into its own
 * service without dragging the main config surface along, and every value it
 * needs is namespaced `LEAD_*`.
 *
 * Sensible fallbacks keep a fresh checkout running with no extra .env work —
 * the lead data still lands in its own database, just on the same cluster.
 */

export interface LeadCollectionConfig {
  mongoUri: string;
  mongoDbName: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtIssuer: string;
  jwtAudience: string;
  bcryptRounds: number;
}

const DEFAULT_DB_NAME = "tirvona_leads";

export const leadCollectionConfig = (): LeadCollectionConfig => ({
  mongoUri:
    process.env.LEAD_MONGODB_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/tirvona",
  // Always an explicit dbName. Mongoose lets `dbName` override the database in
  // the URI path, which is what keeps lead data out of the platform database
  // even when both share a connection string.
  mongoDbName: process.env.LEAD_MONGODB_DB_NAME || DEFAULT_DB_NAME,
  // A distinct issuer/audience is what actually isolates the two token
  // populations: a platform token cannot pass the lead guard and a lead token
  // cannot pass `JwtStrategy`, even where the signing secret is shared.
  jwtSecret:
    process.env.LEAD_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "development-only-lead-secret",
  jwtExpiresIn: process.env.LEAD_JWT_EXPIRES_IN || "12h",
  jwtIssuer: process.env.LEAD_JWT_ISSUER || "tirvona-lead-api",
  jwtAudience: process.env.LEAD_JWT_AUDIENCE || "tirvona-lead-agents",
  bcryptRounds: Number(process.env.LEAD_BCRYPT_ROUNDS) || 10,
});
