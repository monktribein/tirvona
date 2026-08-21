import { payoutConfig } from "./payout.config";

describe("payoutConfig encryption key", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("uses the existing application secret only during local development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.PAYOUT_ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    process.env.JWT_SECRET = "stable-local-development-secret";
    expect(payoutConfig().encryptionKey).toBe("stable-local-development-secret");
  });

  it("never falls back to JWT_SECRET in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.PAYOUT_ENCRYPTION_KEY;
    process.env.JWT_SECRET = "production-jwt-secret";
    expect(payoutConfig().encryptionKey).toBe("");
  });

  it("always prefers the dedicated payout key", () => {
    process.env.NODE_ENV = "development";
    process.env.PAYOUT_ENCRYPTION_KEY = "dedicated-key";
    process.env.JWT_SECRET = "jwt-key";
    expect(payoutConfig().encryptionKey).toBe("dedicated-key");
  });
});
