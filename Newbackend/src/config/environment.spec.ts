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

  /**
   * Without a key secret both payment services skip signature verification and
   * confirm bookings for free. That fallback is for local development, so
   * production must not be able to start without real keys.
   */
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

  /**
   * An Atlas URI is an SRV record, so a script that opens a connection without
   * applying DNS_SERVERS first inherits the machine's resolver — which on a
   * host that proxies DNS through localhost refuses SRV queries outright. The
   * failure surfaces only as "Unable to connect to the database", so it is
   * cheap to reintroduce and expensive to diagnose.
   */
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
