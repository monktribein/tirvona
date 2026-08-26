import { BadRequestException } from "@nestjs/common";
import { UsersService } from "./users.service";

jest.setTimeout(30_000);

const APPROVED = { _id: "ashram-a", name: "Prem Mandir Dharamshala" };

const build = (ashram: unknown = APPROVED) => {
  const created: any[] = [];
  const ashrams = {
    findOne: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(ashram),
      }),
    }),
  };
  const users = {
    exists: jest.fn().mockResolvedValue(false),
    create: jest.fn().mockImplementation(async (doc: any) => {
      created.push(doc);
      return { ...doc, _id: "user-1", toObject: () => ({ ...doc }) };
    }),
  };
  const audits = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new UsersService(
    users as never,
    ashrams as never,
    audits as never,
  );
  return { service, users, ashrams, audits, created };
};

const dto = (over: Record<string, unknown> = {}) =>
  ({
    name: "Asha Devi",
    email: "Asha@Example.com",
    phone: "9876543210",
    role: "ashram_owner",
    gender: "Female",
    aadhaarCardUrl: "https://cdn/a.png",
    panCardUrl: "https://cdn/p.png",
    assignedAshramId: "ashram-a",
    ...over,
  }) as never;

const actor = { id: "admin-1", role: "super_admin" } as never;

describe("creating an assigned Ashram Owner", () => {
  it("permanently scopes the owner to the assigned ashram", async () => {
    const { service, created } = build();
    await service.createAccount(actor, dto());
    expect(created[0].employerAshramId).toBe("ashram-a");
    expect(created[0].scopedAshramIds).toEqual(["ashram-a"]);
  });

  it("refuses to create the owner when no ashram was chosen", async () => {
    const { service } = build();
    await expect(
      service.createAccount(actor, dto({ assignedAshramId: undefined })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses an ashram that is not approved or does not exist", async () => {
    const { service } = build(null);
    await expect(service.createAccount(actor, dto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("only accepts an ashram that is approved and not deleted", async () => {
    const { service, ashrams } = build();
    await service.createAccount(actor, dto());
    expect(ashrams.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved", deletedAt: null }),
    );
  });

  it("leaves non-owner roles unscoped", async () => {
    const { service, created } = build();
    await service.createAccount(
      actor,
      dto({ role: "support", assignedAshramId: undefined }),
    );
    expect(created[0].employerAshramId).toBeNull();
    expect(created[0].scopedAshramIds).toEqual([]);
  });

  it.each(["manager", "reception", "housekeeping"])(
    "scopes the %s role to its assigned ashram",
    async (role) => {
      const { service, created } = build();
      await service.createAccount(actor, dto({ role }));
      expect(created[0].employerAshramId).toBe("ashram-a");
      expect(created[0].scopedAshramIds).toEqual(["ashram-a"]);
    },
  );

  it("ignores caller-supplied privilege fields", async () => {
    const { service, created } = build();
    await service.createAccount(
      actor,
      dto({
        permissions: ["ashrams.manage_all"],
        scopedAshramIds: ["ashram-evil"],
        employerAshramId: "ashram-evil",
        status: "active",
        isVerified: true,
        tokenVersion: 99,
      }),
    );
    expect(created[0].permissions).toEqual([]);
    expect(created[0].scopedAshramIds).toEqual(["ashram-a"]);
    expect(created[0].employerAshramId).toBe("ashram-a");
    expect(created[0].tokenVersion).toBeUndefined();
  });

  it("records the assigned ashram in the audit trail", async () => {
    const { service, audits } = build();
    await service.createAccount(actor, dto());
    const logged = JSON.stringify(audits.create.mock.calls);
    expect(logged).toContain("USER_ACCOUNT_CREATED");
    expect(logged).toContain("ashram-a");
    expect(logged).toContain("Prem Mandir Dharamshala");
  });
});
