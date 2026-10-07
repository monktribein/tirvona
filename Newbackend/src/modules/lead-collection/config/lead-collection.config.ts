
export interface LeadCollectionConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtIssuer: string;
  jwtAudience: string;
  bcryptRounds: number;
}

export const leadCollectionConfig = (): LeadCollectionConfig => ({
  jwtSecret:
    process.env.LEAD_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "development-only-lead-secret",
  jwtExpiresIn: process.env.LEAD_JWT_EXPIRES_IN || "12h",
  jwtIssuer: process.env.LEAD_JWT_ISSUER || "tirvona-lead-api",
  jwtAudience: process.env.LEAD_JWT_AUDIENCE || "tirvona-lead-agents",
  bcryptRounds: Number(process.env.LEAD_BCRYPT_ROUNDS) || 10,
});
