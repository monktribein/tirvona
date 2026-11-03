import { BadRequestException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { UsersService } from "./users.service";

jest.setTimeout(30_000);

const build = () => {
  const row: any = { _id: "user-1", passwordHash: "old-hash", tokenVersion: 3, save: jest.fn().mockResolvedValue(undefined) };
  const users = {
    findById: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(row) }),
  };
  const audits = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new UsersService(users as never, {} as never, {} as never, audits as never);
  const admin = { id: "admin-1", role: "super_admin", name: "Root" } as any;
  return { service, row, audits, admin };
};

describe("Super Admin password reset", () => {
  it("generates a strong temporary password, returns it once and makes the owner change it", async () => {
    const { service, row, audits, admin } = build();
    const temporary = await service.reset(admin, "user-1");
    expect(temporary).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
    expect(await bcrypt.compare(temporary, row.passwordHash)).toBe(true);
    expect(row.mustChangePassword).toBe(true);
    expect(row.tokenVersion).toBe(4);
    expect(row.save).toHaveBeenCalled();
    // The audit trail records that it happened, never the password.
    expect(JSON.stringify(audits.create.mock.calls)).not.toContain(temporary);
  });

  it("never falls back to the old guessable Tirvona#1234 pattern", async () => {
    const { service, admin } = build();
    expect(await service.reset(admin, "user-1")).not.toMatch(/^Tirvona#\d{4}$/);
  });

  it("uses a password the admin typed, if it is at least 8 characters", async () => {
    const { service, row, admin } = build();
    expect(await service.reset(admin, "user-1", "  Shyam@2026  ")).toBe("Shyam@2026");
    expect(row.mustChangePassword).toBe(true);
    await expect(service.reset(admin, "user-1", "short")).rejects.toBeInstanceOf(BadRequestException);
  });
});
