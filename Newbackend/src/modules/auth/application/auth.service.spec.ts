import type { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";

describe("AuthService OTP challenge contracts", () => {
  const createService = () => {
    const challenges = { create: jest.fn().mockResolvedValue({}) };
    const values: Record<string, unknown> = {
      jwtSecret: "test-secret",
      otpLength: 6,
      otpExpiryMinutes: 5,
      otpResendCooldownSeconds: 30,
      otpMaxAttempts: 5,
    };
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    const service = new AuthService(
      {} as never,
      {} as never,
      config,
      challenges as never,
      {} as never,
    );
    return service as unknown as {
      createChallenge: (
        purpose: string,
        identifier: string,
        payload: Record<string, unknown>,
      ) => Promise<Record<string, unknown>>;
    };
  };

  it("returns googleToken for Google email verification", async () => {
    const challenge = await createService().createChallenge(
      "google",
      "pilgrim@example.com",
      {},
    );

    expect(challenge.googleToken).toEqual(expect.any(String));
    expect(challenge).not.toHaveProperty("otpToken");
  });

  it("continues returning otpToken for ordinary OTP flows", async () => {
    const challenge = await createService().createChallenge(
      "login",
      "pilgrim@example.com",
      {},
    );

    expect(challenge.otpToken).toEqual(expect.any(String));
    expect(challenge).not.toHaveProperty("googleToken");
  });
});
