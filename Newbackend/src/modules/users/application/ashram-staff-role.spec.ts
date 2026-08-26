import { ForbiddenException } from "@nestjs/common";
import { UsersService } from "./users.service";

const build = () => {
  const created: any[] = [];
  const users = {
    exists: jest.fn().mockResolvedValue(false),
    create: jest.fn().mockImplementation(async (doc: any) => {
      created.push(doc);
      return { ...doc, _id: "staff-1" };
    }),
  };
  const ashrams = {
    findOne: jest.fn().mockResolvedValue({ _id: "ashram-a" }),
    distinct: jest.fn().mockResolvedValue([]),
    find: jest.fn(() => ({
      select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
    })),
  };
  const audits = { create: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new UsersService(users as never, ashrams as never, audits as never),
    created,
    audits,
  };
};

const owner = {
  id: "owner-1",
  role: "ashram_owner",
  employerAshramId: "ashram-a",
  scopedAshramIds: [],
  permissions: [],
  name: "Owner",
} as never;

const dto = (over: Record<string, unknown> = {}) =>
  ({
    name: "Ravi Kumar",
    email: "ravi@example.com",
    phone: "9876543210",
    password: "secret123",
    role: "reception",
    ashramId: "ashram-a",
    ...over,
  }) as never;

describe("creating ashram staff", () => {
  it("creates an active account scoped only to the selected ashram", async () => {
    const { service, created } = build();
    await service.createStaff(owner, dto());
    expect(created[0].employerAshramId).toBe("ashram-a");
    expect(created[0].scopedAshramIds).toEqual(["ashram-a"]);
    expect(created[0].role).toBe("reception");
  });

  it("blocks creation outside the owner's ashram scope", async () => {
    const { service } = build();
    await expect(
      service.createStaff(owner, dto({ ashramId: "ashram-other" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not create or audit parking privileges", async () => {
    const { service, audits } = build();
    await service.createStaff(owner, dto());
    const logged = JSON.stringify(audits.create.mock.calls);
    expect(logged).toContain("STAFF_CREATE");
    expect(logged).not.toContain("parkingRole");
  });
});
