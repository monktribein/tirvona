import { RoomSummaryService } from "./room-summary.service";

/**
 * The counts this page publishes are what an owner reconciles their desk
 * against, so each one is pinned to the pool it actually comes from: the
 * online pool from the night's BookingInventory row, the offline pool from
 * OfflineRoom, and occupancy from stays that are checked in.
 */
const chain = (rows: unknown) => {
  const c: any = {
    populate: jest.fn(() => c),
    sort: jest.fn(() => c),
    select: jest.fn(() => c),
    lean: jest.fn().mockResolvedValue(rows),
  };
  return c;
};

const room = (over: Record<string, any> = {}) => ({
  _id: "room-1",
  ashramId: { _id: "ashram-a", name: "Ganga Kutir" },
  name: "Ganga Dorm",
  type: "dormitory",
  acType: "Non-AC",
  capacity: 12,
  totalInventory: 20,
  status: "active",
  ...over,
});

const build = (over: Record<string, any> = {}) => {
  const rooms = over.rooms ?? [room()];
  const inventory = over.inventory ?? [];
  const offline = over.offline ?? [];
  const bookings = over.bookings ?? [];

  const ashramModel: any = { find: jest.fn(() => chain(over.ashrams ?? [])) };
  const roomModel: any = { find: jest.fn(() => chain(rooms)) };
  const bookingModel: any = { find: jest.fn(() => chain(bookings)) };
  const inventoryModel: any = { find: jest.fn(() => chain(inventory)) };
  const offlineModel: any = { find: jest.fn(() => chain(offline)) };

  const service = new RoomSummaryService(
    ashramModel,
    roomModel,
    bookingModel,
    inventoryModel,
    offlineModel,
  );
  return { service, roomModel, bookingModel, inventoryModel };
};

const superAdmin: any = {
  id: "u-1",
  role: "super_admin",
  permissions: [],
  scopedAshramIds: [],
};

const owner: any = {
  id: "owner-1",
  role: "ashram_owner",
  permissions: [],
  scopedAshramIds: ["ashram-a"],
};

describe("RoomSummaryService", () => {
  it("reads the night's own capacity, not the category's registered units", async () => {
    // 4 units were transferred across from the offline pool for this date, so
    // the day row carries 24 where the category record still reads 20.
    const { service } = build({
      inventory: [
        {
          roomId: "room-1",
          totalInventory: 24,
          bookedCount: 6,
          heldCount: 1,
          maintenanceCount: 2,
          transferredFromOfflineCount: 4,
        },
      ],
    });

    const result = await service.summary(superAdmin, { date: "2026-09-09" });

    expect(result.rooms[0].registeredUnits).toBe(20);
    expect(result.rooms[0].capacity).toBe(24);
    expect(result.rooms[0].available).toBe(24 - 6 - 1 - 2);
    expect(result.totals.onlineRooms).toBe(24);
  });

  it("falls back to registered units when the night has no inventory row", async () => {
    const { service } = build();

    const result = await service.summary(superAdmin, {});

    expect(result.rooms[0].hasInventoryRow).toBe(false);
    expect(result.rooms[0].capacity).toBe(20);
    expect(result.rooms[0].available).toBe(20);
    expect(result.totals.bookedRooms).toBe(0);
  });

  it("counts the whole capacity as blocked when the night is closed", async () => {
    const { service } = build({
      inventory: [
        { roomId: "room-1", totalInventory: 20, bookedCount: 0, isClosed: true },
      ],
    });

    const result = await service.summary(superAdmin, {});

    expect(result.rooms[0].available).toBe(0);
    expect(result.rooms[0].blocked).toBe(20);
    expect(result.totals.onlineRooms).toBe(0);
    expect(result.totals.availableRooms).toBe(0);
  });

  it("treats an under-maintenance category the same as a closed night", async () => {
    const { service } = build({
      rooms: [room({ status: "under_maintenance" })],
    });

    const result = await service.summary(superAdmin, {});

    expect(result.rooms[0].available).toBe(0);
    expect(result.rooms[0].blocked).toBe(20);
    expect(result.totals.onlineRooms).toBe(0);
  });

  it("keeps the offline pool separate and adds it into the estate total", async () => {
    const { service } = build({
      offline: [
        {
          roomId: "room-1",
          status: "active",
          totalUnits: 8,
          transferredUnits: 3,
          blockedUnits: 2,
        },
        // An inactive pool row is retired and must not be counted at all.
        {
          roomId: "room-1",
          status: "inactive",
          totalUnits: 50,
          transferredUnits: 0,
          blockedUnits: 0,
        },
      ],
    });

    const result = await service.summary(superAdmin, {});

    expect(result.rooms[0].offlineTotal).toBe(8);
    expect(result.rooms[0].offlineAvailable).toBe(3);
    expect(result.totals.offlineRooms).toBe(8);
    expect(result.totals.registeredRooms).toBe(20);
    expect(result.totals.totalRooms).toBe(28);
  });

  it("counts blocked offline units alongside the night's maintenance units", async () => {
    const { service } = build({
      inventory: [
        { roomId: "room-1", totalInventory: 20, maintenanceCount: 2 },
      ],
      offline: [
        {
          roomId: "room-1",
          status: "active",
          totalUnits: 8,
          transferredUnits: 0,
          blockedUnits: 3,
        },
      ],
    });

    const result = await service.summary(superAdmin, {});

    expect(result.totals.blockedRooms).toBe(5);
  });

  it("counts in-house units as occupied and excludes the departing stay", async () => {
    const { service, bookingModel } = build({
      bookings: [
        { rooms: [{ roomId: "room-1", units: 2 }] },
        { rooms: [{ roomId: "room-1", units: 3 }] },
      ],
    });

    const result = await service.summary(superAdmin, { date: "2026-09-09" });

    expect(result.rooms[0].occupied).toBe(5);
    expect(result.totals.occupiedRooms).toBe(5);

    // A stay checking out on the selected morning is gone by that night.
    const filter = bookingModel.find.mock.calls[0][0];
    expect(filter.status).toBe("checked_in");
    expect(filter.checkOutDate).toEqual({
      $gt: new Date("2026-09-09T00:00:00.000Z"),
    });
  });

  it("restricts a non-privileged caller to the ashrams in their scope", async () => {
    const { service, roomModel } = build();

    await service.summary(owner, {});

    expect(roomModel.find.mock.calls[0][0]).toMatchObject({
      ashramId: { $in: ["ashram-a"] },
      deletedAt: null,
    });
  });

  it("refuses an ashram the caller is not scoped to", async () => {
    const { service } = build();

    await expect(
      service.summary(owner, { ashramId: "ashram-b" }),
    ).rejects.toThrow(/do not have access/i);
  });

  it("escapes a regex-special search term rather than running it", async () => {
    const { service, roomModel } = build();

    await service.summary(superAdmin, { search: "Ganga (A+)" });

    expect(roomModel.find.mock.calls[0][0].name).toEqual({
      $regex: "Ganga \\(A\\+\\)",
      $options: "i",
    });
  });

  it("reports a zero occupancy rate rather than dividing by no capacity", async () => {
    const { service } = build({ rooms: [] });

    const result = await service.summary(superAdmin, {});

    expect(result.totals).toMatchObject({
      roomCategories: 0,
      totalRooms: 0,
      occupancyRate: 0,
    });
  });

  it("rejects a date it cannot parse", async () => {
    const { service } = build();

    await expect(
      service.summary(superAdmin, { date: "2026-99-99" }),
    ).rejects.toThrow(/invalid date/i);
  });
});
