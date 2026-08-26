import { AshramsService } from "./ashrams.service";

/**
 * The booking engine reserves against the daily row's totalInventory, so any
 * capacity the owner transfers from their offline pool must be reflected in the
 * inventory calendar too - otherwise the console under-reports what is bookable.
 */
const buildService = (row: Record<string, unknown> | null) => {
  const chain = (rows: unknown) => {
    const c: any = {
      select: jest.fn(() => c),
      sort: jest.fn(() => c),
      lean: jest.fn().mockResolvedValue(rows),
    };
    return c;
  };
  const rooms = {
    findById: jest.fn().mockResolvedValue({
      _id: "room-1",
      ashramId: "ashram-a",
      totalInventory: 10,
      basePrice: 500,
      seasonalRates: [],
    }),
  };
  const inventory = { find: jest.fn(() => chain(row ? [row] : [])) };
  return new AshramsService(
    { find: jest.fn(() => chain([])) } as never,
    rooms as never,
    { find: jest.fn(() => chain([])) } as never,
    inventory as never,
    { find: jest.fn(() => chain([])) } as never,
    {} as never,
    {} as never,
    { allocate: jest.fn().mockResolvedValue("slug"), ensureSlug: jest.fn(), syncSlug: jest.fn() } as never,
  ) as any;
};

const DATE = "2026-09-01";

describe("offline units transferred into Tirvona are visible online", () => {
  it("reports base capacity when nothing was transferred", async () => {
    const service = buildService(null);
    const [day] = await service.buildCalendar("room-1", DATE, DATE);
    expect(day.capacity).toBe(10);
    expect(day.available).toBe(10);
    expect(day.transferredFromOffline).toBe(0);
  });

  it("includes transferred offline units in bookable availability", async () => {
    const service = buildService({
      date: new Date(`${DATE}T00:00:00.000Z`),
      totalInventory: 16,
      transferredFromOfflineCount: 6,
      bookedCount: 0,
      heldCount: 0,
      maintenanceCount: 0,
    });
    const [day] = await service.buildCalendar("room-1", DATE, DATE);
    expect(day.capacity).toBe(16);
    expect(day.available).toBe(16);
    expect(day.baseInventory).toBe(10);
    expect(day.transferredFromOffline).toBe(6);
  });

  it("still subtracts bookings from the transferred capacity", async () => {
    const service = buildService({
      date: new Date(`${DATE}T00:00:00.000Z`),
      totalInventory: 16,
      transferredFromOfflineCount: 6,
      bookedCount: 4,
      heldCount: 2,
      maintenanceCount: 1,
    });
    const [day] = await service.buildCalendar("room-1", DATE, DATE);
    expect(day.available).toBe(9);
  });
});
