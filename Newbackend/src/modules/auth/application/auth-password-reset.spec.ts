import { BadRequestException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

const sent: any[] = [];
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn(async (mail: unknown) => void sent.push(mail)) },
  })),
}));

jest.setTimeout(30_000);

const configWith = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

const build = (user: any, values: Record<string, unknown> = {}) => {
  const userModel = {
    findById: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) }),
    findOne: jest.fn().mockResolvedValue(user),
  };
  const jwt = { sign: jest.fn().mockReturnValue("signed-token") };
  const service = new AuthService(
    {} as never,
    jwt as never,
    configWith({ jwtSecret: "test", ...values }),
    {} as never,
    userModel as never,
    {} as never,
    {} as never,
  );
  return { service, userModel };
};

const account = (over: Record<string, unknown> = {}): any => ({
  _id: { toString: () => "user-1" },
  name: "Radha",
  email: "radha@example.test",
  role: "customer",
  status: "active",
  tokenVersion: 1,
  save: jest.fn().mockResolvedValue(undefined),
  ...over,
});

describe("AuthService and admin password resets", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("tells the app when the owner must choose a new password", async () => {
    const { service } = build(null);
    expect((await service.session(account({ mustChangePassword: true }) as any, [])).mustChangePassword).toBe(true);
    expect((await service.session(account() as any, [])).mustChangePassword).toBe(false);
  });

  it("clears the flag once the owner sets their own password", async () => {
    const user = account({ mustChangePassword: true, passwordHash: await bcrypt.hash("Kx7m-Rp4q-Zt9w", 4) });
    const { service } = build(user);
    await service.changeMyPassword("user-1", "Kx7m-Rp4q-Zt9w", "MyOwnPass#2026");
    expect(user.mustChangePassword).toBeUndefined();
    expect(await bcrypt.compare("MyOwnPass#2026", (user as any).passwordHash)).toBe(true);
    expect(user.save).toHaveBeenCalled();
  });

  it("emails a reset link to the account's owner", async () => {
    const user = account();
    const { service } = build(user, { resendApiKey: "re_test", resendFromEmail: "no-reply@tirvona.test", siteUrl: "https://tirvona.test" });
    await expect(service.sendResetLinkTo("user-1")).resolves.toEqual({ email: "radha@example.test" });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("radha@example.test");
    expect(String(sent[0].text)).toMatch(/reset-password\?token=/);
    expect((user as any).resetTokenHash).toEqual(expect.any(String));
  });

  it("says so, instead of claiming success, when this server cannot send email", async () => {
    const user = account();
    const { service } = build(user, {});
    await expect(service.sendResetLinkTo("user-1")).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(sent).toHaveLength(0);
    expect(user.save).not.toHaveBeenCalled();
  });

  it("refuses accounts without a real email, and unknown accounts", async () => {
    const walkIn = account({ email: "walkin.9876543210@guest.tirvona.local" });
    await expect(build(walkIn, { resendApiKey: "re_test" }).service.sendResetLinkTo("user-1")).rejects.toBeInstanceOf(BadRequestException);
    await expect(build(null, { resendApiKey: "re_test" }).service.sendResetLinkTo("nobody")).rejects.toBeInstanceOf(NotFoundException);
  });
});
