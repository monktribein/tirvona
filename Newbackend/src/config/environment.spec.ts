import { validateEnvironment } from "./environment";

const productionEnvironment = (): Record<string, unknown> => ({
  NODE_ENV: "production",
  MONGODB_URI: "mongodb://database.example.test:27017",
  MONGODB_DB_NAME: "tirvona",
  REDIS_URL: "rediss://redis.example.test:6380",
  JWT_SECRET: "a-production-jwt-secret-longer-than-32-characters",
  PARKING_QR_SECRET: "a-parking-qr-secret-longer-than-32-characters",
  CORS_ORIGINS: "https://tirvona.example.test",
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

  it("rejects wildcard production CORS", () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment(),
        CORS_ORIGINS: "*",
      }),
    ).toThrow("CORS_ORIGINS");
  });
});
