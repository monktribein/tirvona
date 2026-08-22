import { ParkingDiscoveryService } from "./parking-discovery.service";

const leanOf = (rows: unknown[]) => ({ lean: jest.fn().mockResolvedValue(rows) });

const build = (slotTypes: unknown[], availabilityRows: unknown[] = []) => {
  const service = new ParkingDiscoveryService(
    { find: jest.fn(() => leanOf([])) } as never,
    { find: jest.fn(() => leanOf(slotTypes)) } as never,
    { find: jest.fn(() => leanOf(availabilityRows)) } as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return service as any;
};

describe("parking availability summary", () => {
  it("reports a newly created facility as unconfigured, not full", async () => {
    const service = build([]);
    const summary = await service.summary("loc-1", undefined, undefined, 500);

    expect(summary.isConfigured).toBe(false);
    expect(summary.declaredCapacity).toBe(500);
    expect(summary.availableCount).toBe(0);
  });

  it("reports real availability once slot types exist", async () => {
    const service = build([
      { _id: "type-1", totalCapacity: 300, isActive: true },
      { _id: "type-2", totalCapacity: 32, isActive: true },
    ]);
    const summary = await service.summary("loc-1", undefined, undefined, 500);

    expect(summary.isConfigured).toBe(true);
    expect(summary.totalCapacity).toBe(332);
    expect(summary.availableCount).toBe(332);
  });

  it("still reports a genuinely full configured facility as full", async () => {
    const service = build(
      [{ _id: "type-1", totalCapacity: 10, isActive: true }],
      [
        {
          slotTypeId: "type-1",
          totalCapacity: 10,
          bookedCount: 10,
          blockedCount: 0,
          isClosed: false,
        },
      ],
    );
    const summary = await service.summary("loc-1", undefined, undefined, 10);

    expect(summary.isConfigured).toBe(true);
    expect(summary.availableCount).toBe(0);
  });
});
