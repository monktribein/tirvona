import type { ConfigService } from "@nestjs/config";
import bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

const values: Record<string, unknown> = {
  jwtSecret: "test-secret",
  otpLength: 6,
  otpExpiryMinutes: 5,
  otpResendCooldownSeconds: 30,
  otpMaxAttempts: 5,
};
const testConfig = () =>
  ({ get: jest.fn((key: string) => values[key]) }) as unknown as ConfigService;

describe("AuthService OTP challenge contracts", () => {
  const createService = () => {
    const challenges = { create: jest.fn().mockResolvedValue({}) };
    const whatsapp = {
      sendAuthenticationOtp: jest
        .fn()
        .mockResolvedValue({ status: "accepted", provider: "ak_nexus" }),
    };
    const service = new AuthService(
      {} as never,
      {} as never,
      testConfig(),
      challenges as never,
      {} as never,
      {} as never,
      whatsapp as never,
    );
    return {
      service: service as unknown as {
        createChallenge: (
          purpose: string,
          identifier: string,
          payload: Record<string, unknown>,
        ) => Promise<Record<string, unknown>>;
      },
      whatsapp,
    };
  };

  it("returns googleToken for Google email verification", async () => {
    const challenge = await createService().service.createChallenge(
      "google",
      "pilgrim@example.com",
      {},
    );

    expect(challenge.googleToken).toEqual(expect.any(String));
    expect(challenge).not.toHaveProperty("otpToken");
  });

  it("returns otpToken for the registration email OTP", async () => {
    const challenge = await createService().service.createChallenge(
      "register",
      "pilgrim@example.com",
      {},
    );

    expect(challenge.otpToken).toEqual(expect.any(String));
    expect(challenge).not.toHaveProperty("googleToken");
  });

  it("hands mobile authentication OTPs to the WhatsApp integration", async () => {
    const { service, whatsapp } = createService();
    await service.createChallenge("phone_login", "+919876543210", {});
    expect(whatsapp.sendAuthenticationOtp).toHaveBeenCalledWith({
      phone: "+919876543210",
      code: expect.stringMatching(/^\d{6}$/),
      expiresInMinutes: 5,
      idempotencyKey: expect.stringMatching(/^auth-otp:[a-f0-9]{64}$/),
      correlationId: undefined,
    });
  });

  it("does not report a mobile OTP as sent when the provider skips it", async () => {
    const { service, whatsapp } = createService();
    whatsapp.sendAuthenticationOtp.mockResolvedValue({
      status: "skipped",
      provider: "ak_nexus",
      reason: "dry_run",
    });
    await expect(
      service.createChallenge("phone_login", "9936968762", {}),
    ).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({
        code: "WHATSAPP_OTP_DELIVERY_FAILED",
      }),
    });
  });

  it("finds a domestic stored phone when login submits country-code digits", async () => {
    const users = {
      findByPhone: jest.fn((phone: string) =>
        Promise.resolve(phone === "9936968762" ? { _id: "user-1" } : null),
      ),
    };
    const whatsapp = {
      sendAuthenticationOtp: jest
        .fn()
        .mockResolvedValue({ status: "accepted", provider: "ak_nexus" }),
    };
    const service = new AuthService(
      users as never,
      {} as never,
      testConfig(),
      { create: jest.fn().mockResolvedValue({}) } as never,
      {} as never,
      {} as never,
      whatsapp as never,
    );

    await expect(
      service.sendPhoneOtp("919936968762", "request-otp-1"),
    ).resolves.toMatchObject({ otpToken: expect.any(String) });
    expect(users.findByPhone).toHaveBeenNthCalledWith(1, "919936968762");
    expect(users.findByPhone).toHaveBeenNthCalledWith(2, "9936968762");
    expect(whatsapp.sendAuthenticationOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "919936968762",
        correlationId: "request-otp-1",
      }),
    );
  });
});

describe("AuthService login issues a session without a second factor", () => {
  const PASSWORD = "correct-horse";
  const passwordHash = bcrypt.hashSync(PASSWORD, 4);

  const login = async (
    role: string,
    grantedRoles: string[] = [],
    password: string = PASSWORD,
    overrides: Record<string, unknown> = {},
  ) => {
    const user = {
      _id: "user-1",
      email: "person@example.com",
      name: "Person",
      phone: "9000000000",
      role,
      status: "active",
      isDeleted: false,
      permissions: [],
      tokenVersion: 0,
      passwordHash,
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    const parkingStaff = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockResolvedValue(grantedRoles.map((r) => ({ parkingRole: r }))),
        }),
      }),
    };
    const service = new AuthService(
      { findByEmail: jest.fn().mockResolvedValue(user) } as never,
      { sign: jest.fn(() => "signed-jwt") } as never,
      testConfig(),
      { create: jest.fn().mockResolvedValue({}) } as never,
      {} as never,
      parkingStaff as never,
      { sendAuthenticationOtp: jest.fn() } as never,
    );
    const result = await service.login({
      email: user.email,
      password,
    } as never);
    return { result, parkingStaff, user };
  };

  it("signs a Guest Visitor straight in on password alone", async () => {
    const { result, user } = await login("customer");
    expect(result.otpRequired).toBeUndefined();
    expect(result).not.toHaveProperty("challenge");
    expect(result.token).toBe("signed-jwt");
    expect(user.save).toHaveBeenCalled();
  });

  it("issues a session to a parking role holder", async () => {
    const { result, user } = await login("customer", ["security_guard"]);
    expect(result.otpRequired).toBeUndefined();
    expect(result.token).toBe("signed-jwt");
    expect(user.save).toHaveBeenCalled();
  });

  it("rejects a wrong password rather than issuing a session", async () => {
    await expect(login("customer", [], "wrong-password")).rejects.toThrow(
      /Invalid email, phone number, or password/,
    );
  });

  it("refuses a suspended account that knows the password", async () => {
    await expect(
      login("customer", [], PASSWORD, { status: "suspended" }),
    ).rejects.toThrow(/suspended/i);
  });

  it("refuses a deleted account that knows the password", async () => {
    await expect(
      login("customer", [], PASSWORD, { isDeleted: true }),
    ).rejects.toThrow(/suspended/i);
  });

  it("carries the granted parking roles on the session", async () => {
    const { result } = await login("customer", [
      "parking_manager",
      "security_guard",
    ]);
    expect(result.parkingRoles).toEqual(["parking_manager", "security_guard"]);
  });

  it("reports no parking roles for an ordinary account", async () => {
    const { result } = await login("owner");
    expect(result.otpRequired).toBeUndefined();
    expect(result.parkingRoles).toEqual([]);
  });

  it("de-duplicates the same role granted by two partners", async () => {
    const { result } = await login("customer", [
      "security_guard",
      "security_guard",
    ]);
    expect(result.parkingRoles).toEqual(["security_guard"]);
  });

  it("signs a super admin in the same way as everyone else", async () => {
    const { result } = await login("super_admin");
    expect(result.otpRequired).toBeUndefined();
    expect(result.token).toBe("signed-jwt");
  });
});
