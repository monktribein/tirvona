
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
  mongoDbName: process.env.LEAD_MONGODB_DB_NAME || DEFAULT_DB_NAME,
  jwtSecret:
    process.env.LEAD_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "development-only-lead-secret",
  jwtExpiresIn: process.env.LEAD_JWT_EXPIRES_IN || "12h",
  jwtIssuer: process.env.LEAD_JWT_ISSUER || "tirvona-lead-api",
  jwtAudience: process.env.LEAD_JWT_AUDIENCE || "tirvona-lead-agents",
  bcryptRounds: Number(process.env.LEAD_BCRYPT_ROUNDS) || 10,
});
