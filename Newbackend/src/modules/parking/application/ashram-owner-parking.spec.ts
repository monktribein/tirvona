import { ForbiddenException } from "@nestjs/common";
import { ParkingAccessService } from "./parking-access.service";
import { ParkingManagementService } from "./parking-management.service";
import { PARKING_CAPABILITIES } from "../domain/parking.constants";

const leanList = (rows: unknown[]) => ({
  select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(rows) })),
  lean: jest.fn().mockResolvedValue(rows),
});

const buildAccessService = (opts: {
  grants?: unknown[];
  ownedAshrams?: string[];
  locationsByAshram?: string[];
}) => {
  const staff = { find: jest.fn(() => leanList(opts.grants ?? [])) };
  const locations = {
    find: jest.fn((filter: any) =>
      leanList(
        filter?.ashramId
          ? (opts.locationsByAshram ?? []).map((id) => ({ _id: id }))
          : [],
      ),
    ),
  };
  const ashrams = {
    find: jest.fn(() =>
      leanList((opts.ownedAshrams ?? []).map((id) => ({ _id: id }))),
    ),
  };
  return new ParkingAccessService(
    staff as never,
    locations as never,
    ashrams as never,
  );
};

const owner = (over: Record<string, unknown> = {}) =>
  ({
    id: "owner-1",
    role: "ashram_owner",
    name: "Owner",
    permissions: [],
    scopedAshramIds: [],
    employerAshramId: "ashram-a",
    ...over,
  }) as never;

describe("ashram owner parking access", () => {
  it("grants an assigned owner management rights over their ashram's parking", async () => {
    const service = buildAccessService({ locationsByAshram: ["loc-1"] });
    const access = await service.resolve(owner());

    expect(access.ashramIds).toEqual(["ashram-a"]);
    expect(access.locationIds).toEqual(["loc-1"]);
    expect(access.capabilities).toContain(PARKING_CAPABILITIES.MANAGE_LOCATION);
    expect(access.isPlatformAdmin).toBe(false);
  });

  it("gives a user with no ashram assignment no parking access", async () => {
    const service = buildAccessService({});
    const access = await service.resolve(
      owner({ employerAshramId: undefined }),
    );

    expect(access.ashramIds).toEqual([]);
    expect(access.locationIds).toEqual([]);
    expect(access.capabilities).toEqual([]);
  });

  it("blocks an owner from touching a location outside their ashram", async () => {
    const service = buildAccessService({ locationsByAshram: ["loc-1"] });
    const access = await service.resolve(owner());

    expect(() => service.assertLocation(access, "loc-other")).toThrow(
      ForbiddenException,
    );
    expect(() => service.assertLocation(access, "loc-1")).not.toThrow();
  });

  it("leaves super admin unrestricted", async () => {
    const service = buildAccessService({});
    const access = await service.resolve(owner({ role: "super_admin" }));
    expect(access.isPlatformAdmin).toBe(true);
  });
});

describe("creating a parking location as an ashram owner", () => {
  const buildManagement = () => {
    const created: any[] = [];
    const locations = {
      create: jest.fn(async (doc: any) => {
        created.push(doc);
        return doc;
      }),
    };
    const service = new ParkingManagementService(
      { assertLocation: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      locations as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, created };
  };

  const access = (over: Record<string, unknown> = {}) =>
    ({
      isPlatformAdmin: false,
      roles: [],
      capabilities: [],
      partnerIds: [],
      locationIds: [],
      staffIds: [],
      ashramIds: ["ashram-a"],
      ...over,
    }) as never;

  const body = (over: Record<string, unknown> = {}) => ({
    name: "Prem Mandir Parking",
    images: ["https://cdn/1.jpg", "https://cdn/2.jpg", "https://cdn/3.jpg"],
    coverImage: "https://cdn/1.jpg",
    address: { city: "Vrindavan" },
    ...over,
  });

  const actor = { id: "owner-1" } as never;

  it("derives ashramId from the owner's scope, not the request", async () => {
    const { service, created } = buildManagement();
    await service.createLocation(actor, access(), body());
    expect(String(created[0].ashramId)).toBe("ashram-a");
  });

  it("ignores a spoofed ashramId that the owner does not hold", async () => {
    const { service } = buildManagement();
    await expect(
      service.createLocation(actor, access(), body({ ashramId: "ashram-evil" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("accepts the owner naming their own ashram explicitly", async () => {
    const { service, created } = buildManagement();
    await service.createLocation(
      actor,
      access({ ashramIds: ["ashram-a", "ashram-b"] }),
      body({ ashramId: "ashram-b" }),
    );
    expect(String(created[0].ashramId)).toBe("ashram-b");
  });

  it("never lets a partner-only user set an ashramId", async () => {
    const { service, created } = buildManagement();
    await service.createLocation(
      actor,
      access({ ashramIds: [], partnerIds: ["partner-1"] }),
      body({ ashramId: "ashram-evil" }),
    );
    expect(created[0].ashramId).toBeNull();
    expect(String(created[0].partnerId)).toBe("partner-1");
  });

  it("lets super admin place a location under any ashram", async () => {
    const { service, created } = buildManagement();
    await service.createLocation(
      actor,
      access({ isPlatformAdmin: true, ashramIds: [] }),
      body({ ashramId: "ashram-z", partnerId: "partner-9" }),
    );
    expect(String(created[0].ashramId)).toBe("ashram-z");
  });

  it("refuses an owner with neither a partner nor an ashram", async () => {
    const { service } = buildManagement();
    await expect(
      service.createLocation(actor, access({ ashramIds: [] }), body()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
