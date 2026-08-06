import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { AnalyticsService } from "./analytics.service";

const superAdmin = { id: "admin-1", role: "super_admin" } as AuthenticatedUser;

const createService = (models: {
  bookings?: Record<string, unknown>;
  ashrams?: Record<string, unknown>;
  platformAudits?: Record<string, unknown>;
  audits?: Record<string, unknown>;
}) =>
  new AnalyticsService(
    (models.bookings ?? {}) as never,
    (models.ashrams ?? {}) as never,
    {} as never,
    {} as never,
    (models.audits ?? {}) as never,
    (models.platformAudits ?? {}) as never,
  );

const emptyAshramFacet = [
  { statuses: [], owners: [], destinations: [], districts: [] },
];

describe("AnalyticsService.system", () => {
  /**
   * The booking schema keys its customer as `customerId`. Reading `userId`
   * instead made every document contribute the same `undefined`, so the set of
   * "distinct pilgrims" always had exactly one member and the admin dashboard
   * reported "1 Pilgrim" no matter how many people had booked.
   */
  it("counts distinct pilgrims from the customerId field", async () => {
    const service = createService({
      ashrams: {
        aggregate: jest.fn().mockResolvedValue([
          {
            statuses: [
              { _id: "approved", count: 12 },
              { _id: "rejected", count: 3 },
              { _id: "pending_inspection", count: 4 },
            ],
            owners: [{ count: 7 }],
            destinations: [],
            districts: [],
          },
        ]),
      },
      bookings: {
        aggregate: jest.fn().mockResolvedValue([
          {
            totals: [
              {
                totalBookings: 40,
                revenue: 553100,
                grossValue: 600000,
                cancellations: 4,
              },
            ],
            pilgrims: [{ count: 26 }],
          },
        ]),
      },
    });

    const result = await service.system(superAdmin);

    expect(result.users.pilgrims).toBe(26);
    expect(result.users.owners).toBe(7);
    expect(result.ashrams).toEqual({
      total: 19,
      approved: 12,
      pending: 4,
      rejected: 3,
    });
    expect(result.financials.cancellationRate).toBe(10);
    expect(result.financials.approvalRate).toBe(80);
  });

  it("never loads whole booking documents into memory", async () => {
    const find = jest.fn();
    const service = createService({
      ashrams: { aggregate: jest.fn().mockResolvedValue(emptyAshramFacet) },
      bookings: {
        find,
        aggregate: jest.fn().mockResolvedValue([{ totals: [], pilgrims: [] }]),
      },
    });

    await service.system(superAdmin);

    expect(find).not.toHaveBeenCalled();
  });

  it("reports zeroes rather than dividing by zero on an empty platform", async () => {
    const service = createService({
      ashrams: { aggregate: jest.fn().mockResolvedValue(emptyAshramFacet) },
      bookings: {
        aggregate: jest.fn().mockResolvedValue([{ totals: [], pilgrims: [] }]),
      },
    });

    const result = await service.system(superAdmin);

    expect(result.financials).toMatchObject({
      revenue: 0,
      totalBookings: 0,
      cancellationRate: 0,
      approvalRate: 0,
    });
    expect(result.users).toEqual({ pilgrims: 0, owners: 0 });
  });
});

describe("AnalyticsService.overview", () => {
  const overviewModels = (seriesRows: unknown[], facet: unknown) => ({
    bookings: {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce(seriesRows)
        .mockResolvedValueOnce([facet])
        .mockResolvedValueOnce([]),
    },
  });

  /**
   * A sparse aggregation result must not collapse the x-axis onto the days that
   * happened to have traffic — a 14-day chart is 14 points whether or not
   * anyone booked.
   */
  it("zero-fills buckets with no bookings", async () => {
    const service = createService(
      overviewModels([], { channels: [], statuses: [], window: [] }),
    );

    const result = await service.overview(superAdmin, "daily");

    expect(result.series).toHaveLength(14);
    expect(result.series.every((point: any) => point.bookings === 0)).toBe(true);
    expect(result.series.every((point: any) => point.label)).toBe(true);
  });

  it("returns one bucket per period for each range", async () => {
    const expected = { daily: 14, weekly: 12, monthly: 12, yearly: 5 } as const;
    for (const [range, length] of Object.entries(expected)) {
      const service = createService(
        overviewModels([], { channels: [], statuses: [], window: [] }),
      );
      const result = await service.overview(superAdmin, range as never);
      expect(result.series).toHaveLength(length);
    }
  });

  it("splits the channel share by paymentMode", async () => {
    const service = createService(
      overviewModels([], {
        channels: [
          { _id: "online", count: 30, revenue: 300000 },
          { _id: "desk", count: 10, revenue: 50000 },
        ],
        statuses: [],
        window: [],
      }),
    );

    const result = await service.overview(superAdmin, "daily");

    expect(result.channels).toEqual([
      {
        channel: "online",
        label: "Online Gateway",
        count: 30,
        revenue: 300000,
        share: 75,
      },
      {
        channel: "desk",
        label: "Direct Desk",
        count: 10,
        revenue: 50000,
        share: 25,
      },
    ]);
  });

  /**
   * Dividing a fresh bucket by an empty one used to report a 600% rise off a
   * baseline of zero. An unknown change is reported as unknown.
   */
  it("reports no change when the prior bucket has no history", async () => {
    const service = createService(
      overviewModels(
        [
          {
            _id: { bucket: new Date(), channel: "online" },
            bookings: 6,
            revenue: 0,
            gross: 9000,
          },
        ],
        { channels: [], statuses: [], window: [] },
      ),
    );

    const result = await service.overview(superAdmin, "daily");

    expect(result.trend).toEqual({
      revenueChange: 0,
      bookingsChange: 0,
      comparable: false,
    });
  });

  /**
   * Booked value and collected cash are different numbers: a stay settled at
   * the counter has a real `totalAmount` and an `amountPaid` of zero.
   */
  it("reports booked value separately from collected cash", async () => {
    const service = createService(
      overviewModels([], {
        channels: [],
        statuses: [],
        window: [{ bookings: 6, revenue: 0, guests: 11, nightsValue: 9327.82 }],
      }),
    );

    const result = await service.overview(superAdmin, "daily");

    expect(result.totals).toEqual({
      windowBookings: 6,
      windowRevenue: 0,
      windowGrossValue: 9327.82,
      windowGuests: 11,
      averageBookingValue: 1554.64,
      collectionRate: 0,
    });
  });

  it("orders the status breakdown by booking lifecycle", async () => {
    const service = createService(
      overviewModels([], {
        channels: [],
        statuses: [
          { _id: "cancelled", count: 2 },
          { _id: "pending", count: 5 },
          { _id: "confirmed", count: 3 },
        ],
        window: [],
      }),
    );

    const result = await service.overview(superAdmin, "daily");

    expect(result.statuses.map((row: any) => row.status)).toEqual([
      "pending",
      "confirmed",
      "cancelled",
    ]);
    expect(result.statuses[0].share).toBe(50);
  });
});

describe("AnalyticsService.logs", () => {
  const chain = (rows: unknown[]) => ({
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    }),
  });

  it("keeps the fields the audit log page renders", async () => {
    const service = createService({
      platformAudits: chain([
        {
          _id: "log-1",
          action: "ASHRAM_APPROVED",
          module: "GOVERNANCE",
          timestamp: new Date("2026-08-01T10:00:00Z"),
          ipAddress: "10.0.0.1",
          userId: { name: "Asha", email: "asha@example.com" },
        },
      ]),
      audits: chain([]),
    });

    const [entry] = await service.logs();

    expect(entry).toMatchObject({
      _id: "log-1",
      action: "ASHRAM_APPROVED",
      module: "GOVERNANCE",
      ipAddress: "10.0.0.1",
      userId: { name: "Asha", email: "asha@example.com" },
    });
  });

  /**
   * `details` is a Mixed column, so a feed that interpolates it straight into a
   * template string prints "[object Object]".
   */
  it("renders an object detail payload as readable text", async () => {
    const service = createService({
      platformAudits: chain([
        {
          _id: "log-2",
          action: "ROOM_UPDATED",
          module: "INVENTORY",
          occurredAt: new Date("2026-08-02T10:00:00Z"),
          details: { roomNumber: "12", nested: { ignored: true } },
        },
      ]),
      audits: chain([]),
    });

    const [entry] = await service.logs();

    expect(entry.summary).toBe("roomNumber: 12");
    expect(entry.timestamp).toEqual(new Date("2026-08-02T10:00:00Z"));
  });
});
