import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { AnalyticsService } from "./analytics.service";

const superAdmin = { id: "admin-1", role: "super_admin" } as AuthenticatedUser;

const createService = (models: {
  bookings?: Record<string, unknown>;
  ashrams?: Record<string, unknown>;
  platformAudits?: Record<string, unknown>;
  audits?: Record<string, unknown>;
  parking?: Record<string, unknown>;
}) =>
  new AnalyticsService(
    (models.bookings ?? {}) as never,
    (models.ashrams ?? {}) as never,
    {} as never,
    {} as never,
    (models.audits ?? {}) as never,
    (models.platformAudits ?? {}) as never,
    (models.parking ?? { aggregate: jest.fn().mockResolvedValue([]) }) as never,
  );

const emptyAshramFacet = [
  { statuses: [], owners: [], destinations: [], districts: [] },
];

describe("AnalyticsService.system", () => {
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

  it("zero-fills buckets with no bookings", async () => {
    const service = createService(
      overviewModels([], { channels: [], statuses: [], window: [] }),
    );

    const result = await service.overview(superAdmin, "daily");

    expect(result.series).toHaveLength(14);
    expect(result.series.every((point: any) => point.bookings === 0)).toBe(
      true,
    );
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

describe("AnalyticsService parking inclusion", () => {
  const parkingModel = (rows: unknown[]) => ({
    aggregate: jest.fn().mockResolvedValue(rows),
  });

  it("adds parking revenue to the platform financials", async () => {
    const service = createService({
      ashrams: { aggregate: jest.fn().mockResolvedValue(emptyAshramFacet) },
      bookings: {
        aggregate: jest.fn().mockResolvedValue([
          {
            totals: [
              {
                totalBookings: 16,
                revenue: 0,
                grossValue: 40006.02,
                cancellations: 0,
              },
            ],
            pilgrims: [{ count: 5 }],
          },
        ]),
      },
      parking: parkingModel([
        {
          totalBookings: 18,
          revenue: 2284,
          grossValue: 7677,
          cancellations: 1,
        },
      ]),
    });

    const result = await service.system(superAdmin);

    expect(result.financials.revenue).toBe(2284);
    expect(result.financials.totalBookings).toBe(34);
    expect(result.financials.grossValue).toBe(47683.02);
  });

  it("excludes parking from a jurisdiction-scoped caller", async () => {
    const parking = parkingModel([
      { totalBookings: 18, revenue: 2284, grossValue: 7677, cancellations: 0 },
    ]);
    const service = createService({
      ashrams: {
        aggregate: jest.fn().mockResolvedValue(emptyAshramFacet),
        distinct: jest.fn().mockResolvedValue([]),
      },
      bookings: {
        aggregate: jest.fn().mockResolvedValue([{ totals: [], pilgrims: [] }]),
      },
      parking,
    });

    const result = await service.system({
      id: "officer-1",
      role: "district_officer",
      state: "Uttarakhand",
      district: "Haridwar",
    } as never);

    expect(parking.aggregate).not.toHaveBeenCalled();
    expect(result.financials.revenue).toBe(0);
  });

  it("reports the per-module split so streams stay legible", async () => {
    const service = createService({
      bookings: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              channels: [],
              statuses: [],
              window: [{ bookings: 16, revenue: 0 }],
            },
          ])
          .mockResolvedValueOnce([]),
      },
      parking: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              window: [{ bookings: 4, revenue: 30, gross: 467 }],
              allTime: [{ bookings: 18, revenue: 2284, gross: 7677 }],
            },
          ]),
      },
    });

    const result = await service.overview(superAdmin, "daily");

    expect(result.modules).toEqual([
      {
        module: "ashram_booking",
        label: "Ashram stays",
        bookings: 16,
        revenue: 0,
      },
      {
        module: "parking_booking",
        label: "Parking",
        bookings: 4,
        revenue: 30,
        allTimeBookings: 18,
        allTimeRevenue: 2284,
      },
    ]);
    expect(result.totals.windowBookings).toBe(20);
    expect(result.totals.windowRevenue).toBe(30);
  });

  it("reconciles channel and status breakdowns with combined window totals", async () => {
    const bookingAggregate = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          channels: [
            { _id: "online", count: 3, revenue: 300 },
            { _id: "desk", count: 1, revenue: 50 },
          ],
          statuses: [
            { _id: "confirmed", count: 3 },
            { _id: "expired", count: 1 },
          ],
          window: [{ bookings: 4, revenue: 350 }],
        },
      ])
      .mockResolvedValueOnce([]);
    const parkingAggregate = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          window: [{ bookings: 2, revenue: 40, gross: 40 }],
          allTime: [{ bookings: 9, revenue: 180, gross: 180 }],
          statuses: [{ _id: "upcoming", count: 2 }],
        },
      ]);
    const service = createService({
      bookings: { aggregate: bookingAggregate },
      parking: { aggregate: parkingAggregate },
    });

    const result = await service.overview(superAdmin, "daily");

    expect(result.totals.windowBookings).toBe(6);
    expect(result.channels).toEqual([
      {
        channel: "online",
        label: "Online Gateway",
        count: 5,
        revenue: 340,
        share: 83.33,
      },
      {
        channel: "desk",
        label: "Direct Desk",
        count: 1,
        revenue: 50,
        share: 16.67,
      },
    ]);
    expect(result.statuses).toEqual([
      { status: "confirmed", count: 3, share: 50 },
      { status: "upcoming", count: 2, share: 33.33 },
      { status: "expired", count: 1, share: 16.67 },
    ]);
    expect(
      result.channels.reduce((sum: number, row: any) => sum + row.count, 0),
    ).toBe(result.totals.windowBookings);
    expect(
      result.statuses.reduce((sum: number, row: any) => sum + row.count, 0),
    ).toBe(result.totals.windowBookings);
    expect(
      bookingAggregate.mock.calls[1][0][1].$facet.channels[0].$match,
    ).toEqual({ createdAt: { $gte: expect.any(Date) } });
    expect(
      bookingAggregate.mock.calls[1][0][1].$facet.statuses[0].$match,
    ).toEqual({ createdAt: { $gte: expect.any(Date) } });
    expect(
      parkingAggregate.mock.calls[1][0][0].$facet.statuses[0].$match,
    ).toEqual({ createdAt: { $gte: expect.any(Date) } });
  });
});
