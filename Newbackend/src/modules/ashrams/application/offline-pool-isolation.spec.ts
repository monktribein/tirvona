import { OfflineInventoryService } from "./offline-inventory.service";

/**
 * Offline capacity is a private pool. Nothing an owner does to it may touch the
 * Tirvona online surfaces - room records or booking_daily_availability - until
 * they explicitly transfer units across for a chosen date range.
 */
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

const build = () => {
  const inventoryWrites: any[] = [];
  const roomWrites: any[] = [];

  const roomModel: any = {
    findOne: jest.fn(() => chain({ _id: "room-1", totalInventory: 30 })),
    findById: jest.fn(() => chain({ _id: "room-1", totalInventory: 30 })),
  };
  // Any mutating call on the Room model is a leak into online inventory.
  for (const method of [
    "create",
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "deleteOne",
  ])
    roomModel[method] = jest.fn(async (...args: any[]) => {
      roomWrites.push({ method, args });
      return {};
    });

  const inventoryModel: any = {
    find: jest.fn(() => chain([])),
  };
  for (const method of ["create", "updateOne", "updateMany", "findOneAndUpdate"])
    inventoryModel[method] = jest.fn(async (...args: any[]) => {
      inventoryWrites.push({ method, filter: args[0], update: args[1] });
      return {};
    });

  const service = new OfflineInventoryService(
    { run: jest.fn(async (fn: any) => fn({})) } as never,
    {
      find: jest.fn(() => chain([])),
      findOne: jest.fn().mockResolvedValue(offlineRoomDoc()),
      create: jest.fn(async (doc: any) => ({
        ...doc,
        _id: "offline-new",
        toObject: () => ({ ...doc }),
      })),
    } as never,
    { find: jest.fn(() => chain([])), create: jest.fn(async (d: any[]) => d) } as never,
    inventoryModel as never,
    { find: jest.fn(() => chain([])) } as never,
    roomModel as never,
  );
  return { service, inventoryWrites, roomWrites };
};

const owner = () =>
  ({
    id: "owner-1",
    role: "ashram_owner",
    name: "Owner",
    permissions: [],
    scopedAshramIds: [],
    employerAshramId: "ashram-a",
  }) as never;

describe("offline capacity stays out of Tirvona until transferred", () => {
  it("creating an offline room writes nothing to online inventory", async () => {
    const { service, inventoryWrites, roomWrites } = build();
    await service.create(owner(), {
      ashramId: "ashram-a",
      roomId: "room-1",
      label: "Held back beds",
      totalUnits: 20,
    } as never);

    expect(inventoryWrites).toHaveLength(0);
    expect(roomWrites).toHaveLength(0);
  });

  it("editing offline units writes nothing to online inventory", async () => {
    const { service, inventoryWrites, roomWrites } = build();
    await service.update(owner(), "offline-1", { totalUnits: 40 } as never);

    expect(inventoryWrites).toHaveLength(0);
    expect(roomWrites).toHaveLength(0);
  });

  it("deactivating an offline room writes nothing to online inventory", async () => {
    const { service, inventoryWrites, roomWrites } = build();
    await service.update(owner(), "offline-1", { status: "inactive" } as never);

    expect(inventoryWrites).toHaveLength(0);
    expect(roomWrites).toHaveLength(0);
  });

  it("removing an offline room writes nothing to online inventory", async () => {
    const { service, inventoryWrites, roomWrites } = build();
    await service.remove(owner(), "offline-1");

    expect(inventoryWrites).toHaveLength(0);
    expect(roomWrites).toHaveLength(0);
  });

  it("transfer adds only the chosen quantity, never the whole pool", async () => {
    const { service, inventoryWrites } = build();
    await service.transferToTirvona(owner(), "offline-1", {
      units: 6,
      fromDate: "2026-09-01",
      toDate: "2026-09-01",
    } as never);

    const increments = inventoryWrites.filter((row) => row.update?.$inc);
    expect(increments).toHaveLength(1);
    expect(increments[0].update.$inc.totalInventory).toBe(6);
    expect(increments[0].update.$inc.totalInventory).not.toBe(20);
  });

  it("transfer touches only the nights inside the chosen range", async () => {
    const { service, inventoryWrites } = build();
    await service.transferToTirvona(owner(), "offline-1", {
      units: 2,
      fromDate: "2026-09-01",
      toDate: "2026-09-03",
    } as never);

    const touched = inventoryWrites
      .filter((row) => row.update?.$inc)
      .map((row) => new Date(row.filter.date).toISOString().slice(0, 10));

    expect(touched).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });

  it("never mutates the room record's own inventory during a transfer", async () => {
    const { service, roomWrites } = build();
    await service.transferToTirvona(owner(), "offline-1", {
      units: 5,
      fromDate: "2026-09-01",
      toDate: "2026-09-02",
    } as never);

    expect(roomWrites).toHaveLength(0);
  });

  it("leaves the untransferred remainder in the offline pool only", async () => {
    const { service } = build();
    const result = await service.transferToTirvona(owner(), "offline-1", {
      units: 5,
      fromDate: "2026-09-01",
      toDate: "2026-09-02",
    } as never);

    expect(result.offlineRoom.transferredUnits).toBe(5);
    expect(result.offlineRoom.availableUnits).toBe(15);
  });
});
