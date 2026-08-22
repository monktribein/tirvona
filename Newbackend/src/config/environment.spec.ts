import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  applyDnsServersFromEnvironment,
  validateEnvironment,
} from "./environment";

const productionEnvironment = (): Record<string, unknown> => ({
  NODE_ENV: "production",
  MONGODB_URI: "mongodb://database.example.test:27017",
  MONGODB_DB_NAME: "tirvona",
  REDIS_URL: "rediss://redis.example.test:6380",
  JWT_SECRET: "a-production-jwt-secret-longer-than-32-characters",
  PARKING_QR_SECRET: "a-parking-qr-secret-longer-than-32-characters",
  CORS_ORIGINS: "https://tirvona.example.test",
  RAZORPAY_KEY_ID: "rzp_live_example",
  RAZORPAY_KEY_SECRET: "example-razorpay-key-secret",
});

describe("production environment validation", () => {
  it("accepts an explicit database and HTTPS CORS origin", () => {
    expect(validateEnvironment(productionEnvironment())).toBeDefined();
  });

  it("temporarily accepts MongoDB's default database", () => {
    const input = productionEnvironment();
    delete input.MONGODB_DB_NAME;
    expect(validateEnvironment(input)).toBeDefined();
  });

  it.each(["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"])(
    "refuses to boot production without %s",
    (name) => {
      const input = productionEnvironment();
      delete input[name];
      expect(() => validateEnvironment(input)).toThrow(name);
    },
  );

  it("still allows development to run without payment keys", () => {
    const input = productionEnvironment();
    delete input.RAZORPAY_KEY_ID;
    delete input.RAZORPAY_KEY_SECRET;
    input.NODE_ENV = "development";
    expect(validateEnvironment(input)).toBeDefined();
  });

  it("requires all payout secrets when RazorpayX payouts are enabled", () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment(),
        RAZORPAYX_PAYOUT_ENABLED: "true",
      }),
    ).toThrow("RAZORPAYX_ACCOUNT_NUMBER");
  });

  it("accepts a 32-byte base64 payout encryption key", () => {
    expect(
      validateEnvironment({
        ...productionEnvironment(),
        RAZORPAYX_PAYOUT_ENABLED: "true",
        RAZORPAYX_ACCOUNT_NUMBER: "1234567890",
        RAZORPAYX_WEBHOOK_SECRET: "separate-webhook-secret",
        PAYOUT_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
      }),
    ).toBeDefined();
  });

  it("rejects wildcard production CORS", () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment(),
        CORS_ORIGINS: "*",
      }),
    ).toThrow("CORS_ORIGINS");
  });
});

describe("DNS bootstrap", () => {
  const original = process.env.DNS_SERVERS;
  afterEach(() => {
    if (original === undefined) delete process.env.DNS_SERVERS;
    else process.env.DNS_SERVERS = original;
  });

  it("does nothing when DNS_SERVERS is unset", () => {
    delete process.env.DNS_SERVERS;
    expect(applyDnsServersFromEnvironment()).toEqual([]);
  });

  it("parses a comma-separated list", () => {
    process.env.DNS_SERVERS = "1.1.1.1, 8.8.8.8";
    expect(applyDnsServersFromEnvironment()).toEqual(["1.1.1.1", "8.8.8.8"]);
  });

  it("is applied by every script that opens an app context", () => {
    const directory = join(__dirname, "..", "scripts");
    const offenders = readdirSync(directory)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".spec.ts"))
      .filter((file) => {
        const source = readFileSync(join(directory, file), "utf8");
        return (
          source.includes("createApplicationContext") &&
          !source.includes("applyDnsServersFromEnvironment()")
        );
      });
    expect(offenders).toEqual([]);
  });
});
