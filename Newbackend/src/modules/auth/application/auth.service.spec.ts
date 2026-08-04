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

/**
 * The login OTP is a Guest Visitor mechanism. Every role holder signs in with a
 * password alone — including the parking roles, which live in `parking_staff`
 * rather than on `User.role` and so leave the account reading `customer`.
 */
describe("AuthService login OTP applies to Guest Visitors only", () => {
  const PASSWORD = "correct-horse";
  // Cheap rounds: this exercises the branch, not bcrypt's cost factor.
  const passwordHash = bcrypt.hashSync(PASSWORD, 4);

  const login = async (role: string, grantedRoles: string[] = []) => {
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
      password: PASSWORD,
    } as never);
    return { result, parkingStaff, user };
  };

  it("challenges a Guest Visitor with no operational grant", async () => {
    const { result } = await login("customer");
    expect(result.otpRequired).toBe(true);
    expect(result.challenge).toHaveProperty("otpToken");
  });

  it("issues a session straight to a parking role holder", async () => {
    // Regression guard: this account reads `role: "customer"`, so a role-only
    // check would mail an OTP to an address the staff member may never read.
    const { result, user } = await login("customer", ["security_guard"]);
    expect(result.otpRequired).toBeUndefined();
    expect(result.token).toBe("signed-jwt");
    expect(user.save).toHaveBeenCalled();
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

  it("never challenges a super admin", async () => {
    const { result } = await login("super_admin");
    expect(result.otpRequired).toBeUndefined();
    expect(result.token).toBe("signed-jwt");
  });
});
