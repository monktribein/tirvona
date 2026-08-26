import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { OfflineInventoryService } from "./offline-inventory.service";

const chain = (rows: unknown) => {
  const c: any = {
    populate: jest.fn(() => c),
    sort: jest.fn(() => c),
    limit: jest.fn(() => c),
    select: jest.fn(() => c),
    lean: jest.fn().mockResolvedValue(rows),
  };
  return c;
};

const offlineRoomDoc = (over: Record<string, any> = {}) => {
  const doc: any = {
    _id: "offline-1",
    ashramId: "ashram-a",
    roomId: "room-1",
    label: "Reserved dorm beds",
    totalUnits: 20,
    transferredUnits: 0,
    blockedUnits: 0,
    status: "active",
    deletedAt: null,
    ...over,
  };
  doc.save = jest.fn().mockResolvedValue(doc);
  doc.toObject = () => ({ ...doc });
  return doc;
};

const build = (opts: { room?: any; ownedAshrams?: string[] } = {}) => {
  const created: Record<string, any[]> = { transfers: [], rooms: [] };
  const inventoryUpdates: any[] = [];

  const offlineRooms = {
    find: jest.fn(() => chain([])),
    findOne: jest.fn().mockResolvedValue(opts.room ?? offlineRoomDoc()),
    create: jest.fn(async (doc: any) => {
      created.rooms.push(doc);
      return { ...doc, _id: "offline-new", toObject: () => ({ ...doc }) };
    }),
  };
  const transfers = {
    find: jest.fn(() => chain([])),
    create: jest.fn(async (docs: any[]) => {
      created.transfers.push(...docs);
      return docs.map((doc) => ({ ...doc }));
    }),
  };
  const inventory = {
    updateOne: jest.fn(async (filter: any, update: any) => {
      inventoryUpdates.push({ filter, update });
      return {};
    }),
  };
  const ashrams = {
    find: jest.fn(() => chain((opts.ownedAshrams ?? []).map((id) => ({ _id: id })))),
  };
  const rooms = {
    findOne: jest.fn(() => chain({ _id: "room-1", totalInventory: 30 })),
    findById: jest.fn(() => chain({ _id: "room-1", totalInventory: 30 })),
  };
  const transactions = { run: jest.fn(async (fn: any) => fn({})) };

  const service = new OfflineInventoryService(
    transactions as never,
    offlineRooms as never,
    transfers as never,
    inventory as never,
    ashrams as never,
    rooms as never,
  );
  return { service, created, inventoryUpdates, offlineRooms, inventory };
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

describe("offline inventory permissions", () => {
  it("lets the ashram owner manage their offline rooms", () => {
    const { service } = build();
    expect(service.canManageOfflineRooms(owner())).toBe(true);
  });

  it("keeps super admin and ashram admin read-only", () => {
    const { service } = build();
    expect(service.canManageOfflineRooms(owner({ role: "super_admin" }))).toBe(
      false,
    );
    expect(service.canManageOfflineRooms(owner({ role: "ashram_admin" }))).toBe(
      false,
    );
  });

  it("refuses a create from a read-only admin", async () => {
    const { service } = build();
    await expect(
      service.create(owner({ role: "super_admin" }), {
        ashramId: "ashram-a",
        roomId: "room-1",
        label: "Beds",
        totalUnits: 5,
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses a transfer from a read-only admin", async () => {
    const { service } = build();
    await expect(
      service.transferToTirvona(owner({ role: "ashram_admin" }), "offline-1", {
        units: 1,
        fromDate: "2026-09-01",
        toDate: "2026-09-02",
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses a delete from a read-only admin", async () => {
    const { service } = build();
    await expect(
      service.remove(owner({ role: "super_admin" }), "offline-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("blocks an owner from touching another ashram's offline room", async () => {
    const { service } = build({
      room: offlineRoomDoc({ ashramId: "ashram-other" }),
    });
    await expect(
      service.update(owner(), "offline-1", { label: "x" } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("transferring offline units into Tirvona", () => {
  const dto = (over: Record<string, unknown> = {}) =>
    ({
      units: 5,
      fromDate: "2026-09-01",
      toDate: "2026-09-03",
      reason: "Online sold out",
      ...over,
    }) as never;

  it("raises Tirvona capacity for every night in the range", async () => {
    const { service, inventoryUpdates } = build();
    await service.transferToTirvona(owner(), "offline-1", dto());
    const incs = inventoryUpdates.filter((row) => row.update.$inc);
    expect(incs).toHaveLength(3);
    expect(incs[0].update.$inc).toEqual({
      totalInventory: 5,
      transferredFromOfflineCount: 5,
    });
  });

  it("seeds the daily row from the room before adding capacity", async () => {
    const { service, inventoryUpdates } = build();
    await service.transferToTirvona(owner(), "offline-1", dto());
    const seed = inventoryUpdates.find((row) => row.update.$setOnInsert);
    expect(seed.update.$setOnInsert.totalInventory).toBe(30);
  });

  it("reduces the offline pool by the transferred units", async () => {
    const room = offlineRoomDoc();
    const { service } = build({ room });
    const result = await service.transferToTirvona(owner(), "offline-1", dto());
    expect(room.transferredUnits).toBe(5);
    expect(result.offlineRoom.availableUnits).toBe(15);
  });

  it("records an auditable transfer with before and after counts", async () => {
    const { service, created } = build();
    await service.transferToTirvona(owner(), "offline-1", dto());
    const transfer = created.transfers[0];
    expect(transfer.reference).toMatch(/^OFT-/);
    expect(transfer.units).toBe(5);
    expect(transfer.datesCovered).toBe(3);
    expect(transfer.offlineAvailableBefore).toBe(20);
    expect(transfer.offlineAvailableAfter).toBe(15);
    expect(transfer.performedBy).toBe("owner-1");
    expect(transfer.reason).toBe("Online sold out");
  });

  it("refuses to transfer more than the offline pool holds", async () => {
    const { service } = build();
    await expect(
      service.transferToTirvona(owner(), "offline-1", dto({ units: 999 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("counts already transferred and blocked units as unavailable", async () => {
    const { service } = build({
      room: offlineRoomDoc({ totalUnits: 20, transferredUnits: 12, blockedUnits: 5 }),
    });
    await expect(
      service.transferToTirvona(owner(), "offline-1", dto({ units: 4 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses an inactive offline room", async () => {
    const { service } = build({ room: offlineRoomDoc({ status: "inactive" }) });
    await expect(
      service.transferToTirvona(owner(), "offline-1", dto()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a reversed date range", async () => {
    const { service } = build();
    await expect(
      service.transferToTirvona(
        owner(),
        "offline-1",
        dto({ fromDate: "2026-09-10", toDate: "2026-09-01" }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("editing offline rooms", () => {
  it("will not shrink the total below what was already transferred", async () => {
    const { service } = build({
      room: offlineRoomDoc({ totalUnits: 20, transferredUnits: 8 }),
    });
    await expect(
      service.update(owner(), "offline-1", { totalUnits: 5 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("will not delete a room with units live in Tirvona", async () => {
    const { service } = build({ room: offlineRoomDoc({ transferredUnits: 3 }) });
    await expect(
      service.remove(owner(), "offline-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
