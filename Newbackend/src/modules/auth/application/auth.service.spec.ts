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
    const service = new AuthService(
      {} as never,
      {} as never,
      testConfig(),
      challenges as never,
      {} as never,
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

  it("returns otpToken for the registration email OTP", async () => {
    // Registration is where the email OTP lives: it proves the address is
    // reachable before the account is created. Password login issues no
    // challenge at all, so "register" and "phone_login" are the only ordinary
    // OTP purposes left.
    const challenge = await createService().createChallenge(
      "register",
      "pilgrim@example.com",
      {},
    );

    expect(challenge.otpToken).toEqual(expect.any(String));
    expect(challenge).not.toHaveProperty("googleToken");
  });
});

/**
 * Signing in takes a password and nothing else, for every account.
 *
 * The email OTP belongs to registration: it proves the address is reachable
 * before the account exists. Once it does, a correct password is sufficient —
 * there is no second factor on login for any role.
 *
 * What login still resolves is the caller's parking grants. Those live in
 * `parking_staff` rather than on `User.role`, so a guard or parking partner
 * reads `role: "customer"` and nothing downstream could tell them apart from a
 * pilgrim without the grants travelling on the session.
 */
describe("AuthService login issues a session without a second factor", () => {
  const PASSWORD = "correct-horse";
  // Cheap rounds: this exercises the branch, not bcrypt's cost factor.
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
    // Mirrors `.find().select().lean()` in AuthService.activeParkingRoles.
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
    );
    const result = await service.login({
      email: user.email,
      password,
    } as never);
    return { result, parkingStaff, user };
  };

  it("signs a Guest Visitor straight in on password alone", async () => {
    const { result, user } = await login("customer");
    // No challenge of any kind: the OTP a pilgrim answered belonged to signup.
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
    // The password is the only thing standing in front of an account now, so
    // its rejection path is the one guarantee this suite cannot omit.
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
    // The client cannot tell a guard from a pilgrim otherwise — `role` reads
    // "customer" for both — so routing to the parking dashboard depends on it.
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
