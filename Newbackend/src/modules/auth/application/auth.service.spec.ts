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
    const challenges = {
      create: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
    };
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
        resend: (token: string) => Promise<Record<string, unknown>>;
      },
      whatsapp,
      challenges,
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

  it("stores only a keyed OTP digest and never returns the OTP", async () => {
    const { service, whatsapp, challenges } = createService();
    const response = await service.createChallenge(
      "phone_login",
      "+919876543210",
      {},
    );
    const deliveredCode = whatsapp.sendAuthenticationOtp.mock.calls[0][0].code;
    const stored = challenges.create.mock.calls[0][0];

    expect(stored.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.codeHash).not.toBe(deliveredCode);
    expect(stored.maxAttempts).toBe(5);
    expect(stored.expiresAt).toBeInstanceOf(Date);
    expect(stored.resendAvailableAt).toBeInstanceOf(Date);
    expect(response).not.toHaveProperty("otp");
    expect(response).not.toHaveProperty("code");
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

  it("enforces resend cooldown before creating another challenge", async () => {
    const { service, challenges, whatsapp } = createService();
    const old = {
      purpose: "phone_login",
      identifier: "+919876543210",
      payload: {},
      resendAvailableAt: new Date(Date.now() + 30_000),
      consumedAt: null,
      save: jest.fn(),
    };
    challenges.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(old),
    });

    await expect(service.resend("existing-token")).rejects.toThrow(
      "Please wait before requesting another OTP",
    );
    expect(old.save).not.toHaveBeenCalled();
    expect(challenges.create).not.toHaveBeenCalled();
    expect(whatsapp.sendAuthenticationOtp).not.toHaveBeenCalled();
  });

  it("consumes the old challenge and sends a fresh OTP after cooldown", async () => {
    const { service, challenges, whatsapp } = createService();
    const old = {
      purpose: "phone_login",
      identifier: "+919876543210",
      payload: {},
      resendAvailableAt: new Date(Date.now() - 1_000),
      consumedAt: null as Date | null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    challenges.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(old),
    });

    await expect(service.resend("existing-token")).resolves.toMatchObject({
      otpToken: expect.any(String),
      resendAfter: 30,
    });
    expect(old.consumedAt).toBeInstanceOf(Date);
    expect(old.save).toHaveBeenCalledTimes(1);
    expect(challenges.create).toHaveBeenCalledTimes(1);
    expect(whatsapp.sendAuthenticationOtp).toHaveBeenCalledTimes(1);
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

  it("tells an unregistered email to sign up first", async () => {
    const service = new AuthService(
      { findByEmail: jest.fn().mockResolvedValue(null) } as never,
      { sign: jest.fn() } as never,
      testConfig(),
      {} as never,
      {} as never,
      {} as never,
      { sendAuthenticationOtp: jest.fn() } as never,
    );
    await expect(
      service.login({ email: "nobody@example.com", password: PASSWORD } as never),
    ).rejects.toThrow(/email is not registered.*sign up/i);
    await expect(service.forgotPassword("nobody@example.com")).rejects.toThrow(
      /email is not registered.*sign up/i,
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

describe("AuthService phone numbers across countries", () => {
  const build = (findByPhone: jest.Mock = jest.fn().mockResolvedValue(null)) =>
    new AuthService(
      { findByEmail: jest.fn().mockResolvedValue(null), findByPhone } as never,
      { sign: jest.fn() } as never,
      testConfig(),
      {} as never,
      {} as never,
      {} as never,
      { sendAuthenticationOtp: jest.fn() } as never,
    );

  it("stores Indian mobiles in the 10-digit form and others as +<country><number>", () => {
    const service = build();
    expect(service.canonicalPhone("+919876543210")).toBe("9876543210");
    expect(service.canonicalPhone("9876543210")).toBe("9876543210");
    expect(service.canonicalPhone("+14155550123")).toBe("+14155550123");
    expect(service.canonicalPhone("+971501234567")).toBe("+971501234567");
  });

  it("treats +91 and 10-digit forms as the same number when registering", async () => {
    const findByPhone = jest.fn(async (p: string) =>
      p === "9876543210" ? { _id: "existing" } : null,
    );
    const service = build(findByPhone);
    await expect(
      service.register({
        name: "Pilgrim",
        email: "new@example.com",
        phone: "+919876543210",
        password: "secret123",
      } as never),
    ).rejects.toThrow(/already registered/);
  });
});

describe("AuthService email change needs a code sent to the new address", () => {
  const me = { _id: "user-1", email: "old@example.com" };
  const build = (emailOwner: unknown = null) => {
    const challenges = { create: jest.fn().mockResolvedValue({}) };
    const service = new AuthService(
      {
        findById: jest.fn().mockResolvedValue(me),
        findByEmail: jest.fn().mockResolvedValue(emailOwner),
      } as never,
      { sign: jest.fn() } as never,
      testConfig(),
      challenges as never,
      {} as never,
      {} as never,
      { sendAuthenticationOtp: jest.fn() } as never,
    );
    return { service, challenges };
  };

  it("opens an email_change challenge for the new address without saving it", async () => {
    const { service, challenges } = build();
    const result = await service.requestEmailChange("user-1", " New@Example.com ");
    expect(result).toHaveProperty("otpToken");
    expect(result).toMatchObject({ channel: "email" });
    expect(challenges.create).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "email_change",
        identifier: "new@example.com",
        payload: { userId: "user-1" },
      }),
    );
    expect(me.email).toBe("old@example.com");
  });

  it("does nothing when the email is unchanged", async () => {
    const { service, challenges } = build();
    await expect(service.requestEmailChange("user-1", "OLD@example.com")).resolves.toBeNull();
    expect(challenges.create).not.toHaveBeenCalled();
  });

  it("refuses an email that belongs to another account", async () => {
    const { service } = build({ _id: "someone-else" });
    await expect(
      service.requestEmailChange("user-1", "taken@example.com"),
    ).rejects.toThrow(/already registered/);
  });
});

describe("AuthService profile phone edits", () => {
  const build = (findByPhone: jest.Mock = jest.fn().mockResolvedValue(null)) =>
    new AuthService(
      { findByPhone } as never,
      { sign: jest.fn() } as never,
      testConfig(),
      {} as never,
      {} as never,
      {} as never,
      { sendAuthenticationOtp: jest.fn() } as never,
    );
  const me = { _id: "user-1", phone: "919936968762" } as never;

  it("leaves the stored phone alone when only its format differs", async () => {
    // Another account holds "9936968762"; rewriting would collide with it.
    const findByPhone = jest.fn().mockResolvedValue({ _id: "duplicate" });
    const service = build(findByPhone);
    await expect(service.phoneUpdate(me, "919936968762")).resolves.toBeNull();
    await expect(service.phoneUpdate(me, "+91 99369 68762")).resolves.toBeNull();
    expect(findByPhone).not.toHaveBeenCalled();
  });

  it("refuses a new number that belongs to another account", async () => {
    const service = build(jest.fn().mockResolvedValue({ _id: "someone-else" }));
    await expect(service.phoneUpdate(me, "+919876543210")).rejects.toThrow(
      /already registered to another account/,
    );
  });

  it("stores a genuinely new number in canonical form", async () => {
    const service = build();
    await expect(service.phoneUpdate(me, "+919876543210")).resolves.toBe("9876543210");
  });
});
