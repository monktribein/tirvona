import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { UsersService } from "./users.service";

jest.setTimeout(30_000);

const build = (opts: {
  partner?: unknown;
  ashramLocations?: string[];
  ownedAshrams?: string[];
} = {}) => {
  const grants: any[] = [];
  const users = {
    exists: jest.fn().mockResolvedValue(false),
    create: jest
      .fn()
      .mockImplementation(async (doc: any) => ({ ...doc, _id: "staff-1" })),
  };
  const ashrams = {
    findOne: jest.fn().mockResolvedValue({ _id: "ashram-a" }),
    distinct: jest.fn().mockResolvedValue([]),
    find: jest.fn(() => ({
      select: jest.fn(() => ({
        lean: jest
          .fn()
          .mockResolvedValue(
            (opts.ownedAshrams ?? []).map((id) => ({ _id: id })),
          ),
      })),
    })),
  };
  const audits = { create: jest.fn().mockResolvedValue(undefined) };
  const parkingPartners = {
    findOne: jest.fn(() => ({
      select: jest.fn(() => ({
        lean: jest
          .fn()
          .mockResolvedValue(
            opts.partner === undefined ? { _id: "partner-1" } : opts.partner,
          ),
      })),
    })),
  };
  const parkingLocations = {
    find: jest.fn(() => ({
      select: jest.fn(() => ({
        lean: jest
          .fn()
          .mockResolvedValue(
            (opts.ashramLocations ?? ["loc-1"]).map((id) => ({ _id: id })),
          ),
      })),
    })),
  };
  const parkingStaff = {
    findOneAndUpdate: jest.fn(async (_q: any, update: any) => {
      grants.push(update);
      return { locationIds: update.$set.locationIds };
    }),
  };
  const service = new UsersService(
    users as never,
    ashrams as never,
    audits as never,
    parkingPartners as never,
    parkingLocations as never,
    parkingStaff as never,
  );
  return { service, grants, parkingStaff, audits };
};

const owner = { id: "owner-1", role: "ashram_owner", employerAshramId: "ashram-a", scopedAshramIds: [], permissions: [], name: "Owner" } as never;

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

describe("creating staff with a parking role", () => {
  it("creates no parking grant when no parking role is chosen", async () => {
    const { service, parkingStaff } = build();
    await service.createStaff(owner, dto());
    expect(parkingStaff.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("grants the parking role scoped to the ashram's own facilities", async () => {
    const { service, grants } = build({ ashramLocations: ["loc-1", "loc-2"] });
    await service.createStaff(owner, dto({ parkingRole: "security_guard" }));
    expect(grants[0].$set.locationIds).toEqual(["loc-1", "loc-2"]);
    expect(grants[0].$setOnInsert.parkingRole).toBe("security_guard");
    expect(grants[0].$set.status).toBe("active");
  });

  it("honours an explicit subset of the ashram's facilities", async () => {
    const { service, grants } = build({ ashramLocations: ["loc-1", "loc-2"] });
    await service.createStaff(
      owner,
      dto({ parkingRole: "parking_manager", parkingLocationIds: ["loc-2"] }),
    );
    expect(grants[0].$set.locationIds).toEqual(["loc-2"]);
  });

  it("refuses a facility belonging to another ashram", async () => {
    const { service } = build({ ashramLocations: ["loc-1"] });
    await expect(
      service.createStaff(
        owner,
        dto({ parkingRole: "security_guard", parkingLocationIds: ["loc-evil"] }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses when parking management was never activated", async () => {
    const { service } = build({ partner: null });
    await expect(
      service.createStaff(owner, dto({ parkingRole: "security_guard" })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks staff creation for an ashram outside the owner's scope", async () => {
    const { service } = build();
    await expect(
      service.createStaff(owner, dto({ ashramId: "ashram-other" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("records the parking role in the audit trail", async () => {
    const { service, audits } = build({ ashramLocations: ["loc-1"] });
    await service.createStaff(owner, dto({ parkingRole: "parking_manager" }));
    const logged = JSON.stringify(audits.create.mock.calls);
    expect(logged).toContain("STAFF_CREATE");
    expect(logged).toContain("parking_manager");
  });
});
