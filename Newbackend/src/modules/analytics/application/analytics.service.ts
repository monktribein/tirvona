import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { canManageAllAshrams } from "../../../common/auth/ashram-access";
import { resolveAshramScope } from "../../../common/auth/ashram-scope";
import { PARKING_MODEL } from "../../parking/domain/parking.constants";
import type { AnalyticsRange } from "../presentation/dtos/analytics.dto";

const RANGE_WINDOW: Record<
  AnalyticsRange,
  { unit: "day" | "week" | "month" | "year"; buckets: number }
> = {
  daily: { unit: "day", buckets: 14 },
  weekly: { unit: "week", buckets: 12 },
  monthly: { unit: "month", buckets: 12 },
  yearly: { unit: "year", buckets: 5 },
};

const truncate = (date: Date, unit: string): Date => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  if (unit === "week") d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  if (unit === "month") d.setUTCDate(1);
  if (unit === "year") {
    d.setUTCMonth(0);
    d.setUTCDate(1);
  }
  return d;
};

const shift = (date: Date, unit: string, amount: number): Date => {
  const d = new Date(date);
  if (unit === "day") d.setUTCDate(d.getUTCDate() + amount);
  if (unit === "week") d.setUTCDate(d.getUTCDate() + amount * 7);
  if (unit === "month") d.setUTCMonth(d.getUTCMonth() + amount);
  if (unit === "year") d.setUTCFullYear(d.getUTCFullYear() + amount);
  return d;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const bucketLabel = (date: Date, unit: string): string => {
  if (unit === "year") return String(date.getUTCFullYear());
  if (unit === "month")
    return `${MONTHS[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(2)}`;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;
const percent = (part: number, whole: number): number =>
  whole > 0 ? round2((part * 100) / whole) : 0;

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("Room") private readonly rooms: Model<any>,
    @InjectModel("User") private readonly users: Model<any>,
    @InjectModel("BookingAuditLog") private readonly audits: Model<any>,
    @InjectModel("AuditLog") private readonly platformAudits: Model<any>,
    @InjectModel(PARKING_MODEL.Booking)
    private readonly parkingBookings: Model<any>,
  ) {}

  private includesParking(ashramFilter: Record<string, any>): boolean {
    return Object.keys(ashramFilter).length === 0;
  }
  private async scope(
    user: AuthenticatedUser,
    requested?: string,
  ): Promise<any> {
    if (canManageAllAshrams(user)) return requested ? requested : undefined;
    const ids = (await resolveAshramScope(user, this.ashrams)) ?? [];
    if (requested && !ids.includes(requested))
      throw new ForbiddenException("Not authorized for this ashram");
    return requested ?? { $in: ids };
  }
  async dashboard(user: AuthenticatedUser, requested?: string): Promise<any> {
    const ashramId = await this.scope(user, requested);
    const query: any = ashramId ? { ashramId } : {};
    const [bookings, stays, rooms] = await Promise.all([
      this.bookings.find(query).lean(),
      this.ashrams.find(ashramId ? { _id: ashramId } : {}).lean(),
      this.rooms.find(ashramId ? { ashramId } : {}).lean(),
    ]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const month = new Date(today.getFullYear(), today.getMonth(), 1);
    const paid = (b: any) => Number(b.pricing?.amountPaid ?? 0);
    const total = (b: any) => Number(b.pricing?.totalAmount ?? 0);
    const totalInventory = rooms.reduce(
      (n: number, r: any) => n + Number(r.totalInventory ?? 0),
      0,
    );
    const occupied = bookings
      .filter(
        (b: any) =>
          ["confirmed", "checked_in"].includes(b.status) &&
          new Date(b.checkInDate) <= new Date() &&
          new Date(b.checkOutDate) >= new Date(),
      )
      .reduce((n: number, b: any) => n + Number(b.roomsBookedCount ?? 1), 0);
    const activeBookings = bookings.filter((b: any) =>
      ["confirmed", "checked_in"].includes(b.status),
    ).length;
    const checkInsToday = bookings.filter((b: any) => {
      const checkIn = new Date(b.checkInDate);
      return (
        ["confirmed", "checked_in"].includes(b.status) &&
        checkIn >= today &&
        checkIn < new Date(today.getTime() + 86_400_000)
      );
    }).length;
    const checkoutsToday = bookings.filter((b: any) => {
      const checkOut = new Date(b.checkOutDate);
      return (
        ["confirmed", "checked_in"].includes(b.status) &&
        checkOut >= today &&
        checkOut < new Date(today.getTime() + 86_400_000)
      );
    }).length;
    return {
      totalAshrams: stays.length,
      totalRoomCategories: rooms.length,
      totalInventory,
      occupiedRooms: occupied,
      totalBookings: bookings.length,
      activeBookings,
      occupancyRate: totalInventory
        ? Math.min(100, Math.round((occupied * 100) / totalInventory))
        : 0,
      revenue: bookings.reduce((n: number, b: any) => n + paid(b), 0),
      grossBookingValue: bookings.reduce(
        (n: number, b: any) => n + total(b),
        0,
      ),
      pendingPayments: bookings.reduce(
        (n: number, b: any) =>
          n + Math.max(0, Number(b.pricing?.totalAmount ?? 0) - paid(b)),
        0,
      ),
      checkInsToday,
      checkoutSoon: checkoutsToday,
      todayRevenue: bookings
        .filter((b: any) => new Date(b.createdAt) >= today)
        .reduce((n: number, b: any) => n + paid(b), 0),
      monthlyRevenue: bookings
        .filter((b: any) => new Date(b.createdAt) >= month)
        .reduce((n: number, b: any) => n + paid(b), 0),
      availableRooms: Math.max(0, totalInventory - occupied),
      cancelledBookings: bookings.filter((b: any) => b.status === "cancelled")
        .length,
      averageRating: stays.length
        ? Number(
            (
              stays.reduce(
                (n: number, a: any) => n + Number(a.rating?.average ?? 0),
                0,
              ) / stays.length
            ).toFixed(1),
          )
        : 0,
    };
  }
  private jurisdictionFilter(user: AuthenticatedUser): Record<string, any> {
    if (["super_admin", "national_admin"].includes(user.role)) return {};
    if (!user.state)
      throw new ForbiddenException("A state jurisdiction must be assigned");
    if (["district_officer", "inspector"].includes(user.role)) {
      if (!user.district)
        throw new ForbiddenException(
          "A district jurisdiction must be assigned",
        );
      return { "address.state": user.state, "address.district": user.district };
    }
    return { "address.state": user.state };
  }

  private async bookingScope(
    ashramFilter: Record<string, any>,
  ): Promise<Record<string, any>> {
    if (Object.keys(ashramFilter).length === 0) return {};
    const ids = await this.ashrams.distinct("_id", ashramFilter);
    return { ashramId: { $in: ids } };
  }

  async system(user: AuthenticatedUser): Promise<any> {
    const ashramFilter = this.jurisdictionFilter(user);
    const bookingFilter = await this.bookingScope(ashramFilter);

    const withParking = this.includesParking(ashramFilter);
    const [ashramFacet, bookingFacet, parkingFacet] = await Promise.all([
      this.ashrams.aggregate([
        { $match: ashramFilter },
        {
          $facet: {
            statuses: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
            owners: [
              { $match: { ownerId: { $ne: null } } },
              { $group: { _id: "$ownerId" } },
              { $count: "count" },
            ],
            destinations: [
              { $match: { status: "approved" } },
              { $group: { _id: "$address.city", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 5 },
            ],
            districts: [
              {
                $group: {
                  _id: "$address.district",
                  approved: {
                    $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
                  },
                  pending: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "pending_inspection"] }, 1, 0],
                    },
                  },
                },
              },
              { $sort: { approved: -1 } },
            ],
          },
        },
      ]),
      this.bookings.aggregate([
        { $match: bookingFilter },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalBookings: { $sum: 1 },
                  revenue: { $sum: { $ifNull: ["$pricing.amountPaid", 0] } },
                  grossValue: {
                    $sum: { $ifNull: ["$pricing.totalAmount", 0] },
                  },
                  cancellations: {
                    $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
                  },
                },
              },
            ],
            pilgrims: [
              { $match: { customerId: { $ne: null } } },
              { $group: { _id: "$customerId" } },
              { $count: "count" },
            ],
          },
        },
      ]),
      withParking
        ? this.parkingBookings.aggregate([
            {
              $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                revenue: { $sum: { $ifNull: ["$pricing.amountPaid", 0] } },
                grossValue: { $sum: { $ifNull: ["$pricing.totalAmount", 0] } },
                cancellations: {
                  $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
                },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    const statusCounts = new Map<string, number>(
      (ashramFacet[0]?.statuses ?? []).map((row: any) => [
        String(row._id),
        Number(row.count),
      ]),
    );
    const countOf = (...names: string[]): number =>
      names.reduce((sum, name) => sum + (statusCounts.get(name) ?? 0), 0);
    const total = [...statusCounts.values()].reduce((a, b) => a + b, 0);
    const approved = countOf("approved");
    const pending = countOf("pending_docs", "pending_inspection");
    const rejected = countOf("rejected");

    const totals = bookingFacet[0]?.totals?.[0] ?? {};
    const parking = (parkingFacet as any[])[0] ?? {};
    const totalBookings =
      Number(totals.totalBookings ?? 0) + Number(parking.totalBookings ?? 0);
    const cancellations =
      Number(totals.cancellations ?? 0) + Number(parking.cancellations ?? 0);

    return {
      ashrams: { total, approved, pending, rejected },
      users: {
        pilgrims: Number(bookingFacet[0]?.pilgrims?.[0]?.count ?? 0),
        owners: Number(ashramFacet[0]?.owners?.[0]?.count ?? 0),
      },
      financials: {
        revenue: round2(
          Number(totals.revenue ?? 0) + Number(parking.revenue ?? 0),
        ),
        grossValue: round2(
          Number(totals.grossValue ?? 0) + Number(parking.grossValue ?? 0),
        ),
        cancellationRate: percent(cancellations, totalBookings),
        totalBookings,
        approvalRate: percent(approved, approved + rejected),
        monthlyInspections: [],
      },
      popularDestinations: (ashramFacet[0]?.destinations ?? []).map(
        (x: any) => ({ city: x._id || "Unknown", count: x.count }),
      ),
      districtStats: (ashramFacet[0]?.districts ?? []).map((x: any) => ({
        district: x._id || "Unknown",
        approved: x.approved,
        pending: x.pending,
      })),
    };
  }

  async overview(user: AuthenticatedUser, range: AnalyticsRange): Promise<any> {
    const ashramFilter = this.jurisdictionFilter(user);
    const bookingFilter = await this.bookingScope(ashramFilter);
    const { unit, buckets } = RANGE_WINDOW[range];

    const currentBucket = truncate(new Date(), unit);
    const windowStart = shift(currentBucket, unit, -(buckets - 1));
    const channelBranch = {
      $cond: [{ $eq: ["$paymentMode", "online"] }, "online", "desk"],
    };

    const withParking = this.includesParking(ashramFilter);

    const [seriesRows, facet, topAshrams, parkingSeries, parkingTotals] =
      await Promise.all([
        this.bookings.aggregate([
          { $match: { ...bookingFilter, createdAt: { $gte: windowStart } } },
          {
            $group: {
              _id: {
                bucket: { $dateTrunc: { date: "$createdAt", unit } },
                channel: channelBranch,
              },
              bookings: { $sum: 1 },
              revenue: { $sum: { $ifNull: ["$pricing.amountPaid", 0] } },
              gross: { $sum: { $ifNull: ["$pricing.totalAmount", 0] } },
            },
          },
        ]),
        this.bookings.aggregate([
          { $match: bookingFilter },
          {
            $facet: {
              channels: [
                { $match: { createdAt: { $gte: windowStart } } },
                {
                  $group: {
                    _id: channelBranch,
                    count: { $sum: 1 },
                    revenue: { $sum: { $ifNull: ["$pricing.amountPaid", 0] } },
                  },
                },
              ],
              statuses: [
                { $match: { createdAt: { $gte: windowStart } } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
              ],
              window: [
                { $match: { createdAt: { $gte: windowStart } } },
                {
                  $group: {
                    _id: null,
                    bookings: { $sum: 1 },
                    revenue: { $sum: { $ifNull: ["$pricing.amountPaid", 0] } },
                    guests: { $sum: { $ifNull: ["$guestsCount", 0] } },
                    nightsValue: {
                      $sum: { $ifNull: ["$pricing.totalAmount", 0] },
                    },
                  },
                },
              ],
            },
          },
        ]),
        this.bookings.aggregate([
          { $match: bookingFilter },
          {
            $group: {
              _id: "$ashramId",
              revenue: { $sum: { $ifNull: ["$pricing.amountPaid", 0] } },
              gross: { $sum: { $ifNull: ["$pricing.totalAmount", 0] } },
              bookings: { $sum: 1 },
            },
          },
          { $sort: { gross: -1, bookings: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: "ashrams",
              localField: "_id",
              foreignField: "_id",
              as: "ashram",
            },
          },
          { $unwind: { path: "$ashram", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              ashramId: "$_id",
              revenue: 1,
              gross: 1,
              bookings: 1,
              name: { $ifNull: ["$ashram.name", "Unknown ashram"] },
              city: { $ifNull: ["$ashram.address.city", ""] },
            },
          },
        ]),
        withParking
          ? this.parkingBookings.aggregate([
              { $match: { createdAt: { $gte: windowStart } } },
              {
                $group: {
                  _id: { $dateTrunc: { date: "$createdAt", unit } },
                  bookings: { $sum: 1 },
                  revenue: { $sum: { $ifNull: ["$pricing.amountPaid", 0] } },
                  gross: { $sum: { $ifNull: ["$pricing.totalAmount", 0] } },
                },
              },
            ])
          : Promise.resolve([]),
        withParking
          ? this.parkingBookings.aggregate([
              {
                $facet: {
                  window: [
                    { $match: { createdAt: { $gte: windowStart } } },
                    {
                      $group: {
                        _id: null,
                        bookings: { $sum: 1 },
                        revenue: {
                          $sum: { $ifNull: ["$pricing.amountPaid", 0] },
                        },
                        gross: {
                          $sum: { $ifNull: ["$pricing.totalAmount", 0] },
                        },
                      },
                    },
                  ],
                  allTime: [
                    {
                      $group: {
                        _id: null,
                        bookings: { $sum: 1 },
                        revenue: {
                          $sum: { $ifNull: ["$pricing.amountPaid", 0] },
                        },
                        gross: {
                          $sum: { $ifNull: ["$pricing.totalAmount", 0] },
                        },
                      },
                    },
                  ],
                  statuses: [
                    { $match: { createdAt: { $gte: windowStart } } },
                    { $group: { _id: "$status", count: { $sum: 1 } } },
                  ],
                },
              },
            ])
          : Promise.resolve([]),
      ]);

    const parkingByBucket = new Map<string, any>(
      (parkingSeries as any[]).map((row) => [
        new Date(row._id).toISOString(),
        row,
      ]),
    );

    const emptyChannel = () => ({ bookings: 0, revenue: 0, gross: 0 });
    const byBucket = new Map<string, { online: any; desk: any }>();
    for (const row of seriesRows) {
      const key = new Date(row._id.bucket).toISOString();
      const entry = byBucket.get(key) ?? {
        online: emptyChannel(),
        desk: emptyChannel(),
      };
      entry[row._id.channel as "online" | "desk"] = {
        bookings: Number(row.bookings ?? 0),
        revenue: Number(row.revenue ?? 0),
        gross: Number(row.gross ?? 0),
      };
      byBucket.set(key, entry);
    }

    const series = Array.from({ length: buckets }, (_, index) => {
      const bucket = shift(windowStart, unit, index);
      const entry = byBucket.get(bucket.toISOString());
      const online = entry?.online ?? emptyChannel();
      const desk = entry?.desk ?? emptyChannel();
      const parking = parkingByBucket.get(bucket.toISOString()) ?? {
        bookings: 0,
        revenue: 0,
        gross: 0,
      };
      return {
        bucket: bucket.toISOString(),
        label: bucketLabel(bucket, unit),
        onlineBookings: online.bookings + Number(parking.bookings ?? 0),
        deskBookings: desk.bookings,
        onlineRevenue: round2(online.revenue + Number(parking.revenue ?? 0)),
        deskRevenue: round2(desk.revenue),
        onlineGross: round2(online.gross + Number(parking.gross ?? 0)),
        deskGross: round2(desk.gross),
        stayBookings: online.bookings + desk.bookings,
        parkingBookings: Number(parking.bookings ?? 0),
        parkingRevenue: round2(Number(parking.revenue ?? 0)),
        bookings:
          online.bookings + desk.bookings + Number(parking.bookings ?? 0),
        revenue: round2(
          online.revenue + desk.revenue + Number(parking.revenue ?? 0),
        ),
        gross: round2(online.gross + desk.gross + Number(parking.gross ?? 0)),
      };
    });

    const channelRows = facet[0]?.channels ?? [];
    const parkingFacet = (parkingTotals as any[])[0] ?? {};
    const parkingWindowForBreakdowns = parkingFacet.window?.[0] ?? {};
    const parkingChannelCount = Number(
      parkingWindowForBreakdowns.bookings ?? 0,
    );
    const parkingChannelRevenue = Number(
      parkingWindowForBreakdowns.revenue ?? 0,
    );
    const channelTotal =
      parkingChannelCount +
      channelRows.reduce(
        (sum: number, row: any) => sum + Number(row.count ?? 0),
        0,
      );
    const channels = ["online", "desk"].map((key) => {
      const row = channelRows.find((r: any) => r._id === key);
      const isOnline = key === "online";
      const count =
        Number(row?.count ?? 0) + (isOnline ? parkingChannelCount : 0);
      return {
        channel: key,
        label: key === "online" ? "Online Gateway" : "Direct Desk",
        count,
        revenue: round2(
          Number(row?.revenue ?? 0) + (isOnline ? parkingChannelRevenue : 0),
        ),
        share: percent(count, channelTotal),
      };
    });

    const statusCounts = new Map<string, number>();
    for (const row of [
      ...(facet[0]?.statuses ?? []),
      ...(parkingFacet.statuses ?? []),
    ]) {
      const status = String(row._id ?? "unknown");
      statusCounts.set(
        status,
        (statusCounts.get(status) ?? 0) + Number(row.count ?? 0),
      );
    }
    const statusTotal = [...statusCounts.values()].reduce(
      (sum, count) => sum + count,
      0,
    );
    const STATUS_ORDER = [
      "pending",
      "confirmed",
      "upcoming",
      "checked_in",
      "checked_out",
      "completed",
      "cancelled",
      "refunded",
      "no_show",
      "expired",
    ];
    const statusRank = (status: string): number => {
      const rank = STATUS_ORDER.indexOf(status);
      return rank === -1 ? STATUS_ORDER.length : rank;
    };
    const statuses = [...statusCounts.entries()]
      .map(([status, count]) => ({
        status,
        count,
        share: percent(count, statusTotal),
      }))
      .sort((a, b) => statusRank(a.status) - statusRank(b.status));

    const windowTotals = facet[0]?.window?.[0] ?? {};
    const parkingWindow = (parkingTotals as any[])[0]?.window?.[0] ?? {};
    const parkingAllTime = (parkingTotals as any[])[0]?.allTime?.[0] ?? {};

    const stayBookings = Number(windowTotals.bookings ?? 0);
    const stayRevenue = round2(Number(windowTotals.revenue ?? 0));
    const parkingBookingCount = Number(parkingWindow.bookings ?? 0);
    const parkingRevenue = round2(Number(parkingWindow.revenue ?? 0));
    const windowBookings = stayBookings + parkingBookingCount;
    const windowRevenue = round2(stayRevenue + parkingRevenue);
    const windowGrossValue = round2(
      Number(windowTotals.nightsValue ?? 0) + Number(parkingWindow.gross ?? 0),
    );

    const last = series[series.length - 1];
    const previous = series[series.length - 2];
    const comparable = Boolean(
      previous && (previous.revenue > 0 || previous.bookings > 0),
    );
    const trend = comparable
      ? {
          revenueChange: percent(
            last.revenue - previous.revenue,
            previous.revenue || 1,
          ),
          bookingsChange: percent(
            last.bookings - previous.bookings,
            previous.bookings || 1,
          ),
          comparable: true,
        }
      : { revenueChange: 0, bookingsChange: 0, comparable: false };

    return {
      range,
      unit,
      windowStart: windowStart.toISOString(),
      series,
      channels,
      statuses,
      topAshrams: topAshrams.map((row: any) => ({
        ...row,
        revenue: round2(Number(row.revenue ?? 0)),
        gross: round2(Number(row.gross ?? 0)),
      })),
      modules: [
        {
          module: "ashram_booking",
          label: "Ashram stays",
          bookings: stayBookings,
          revenue: stayRevenue,
        },
        {
          module: "parking_booking",
          label: "Parking",
          bookings: parkingBookingCount,
          revenue: parkingRevenue,
          allTimeBookings: Number(parkingAllTime.bookings ?? 0),
          allTimeRevenue: round2(Number(parkingAllTime.revenue ?? 0)),
        },
      ],
      totals: {
        windowBookings,
        windowRevenue,
        windowGrossValue,
        windowGuests: Number(windowTotals.guests ?? 0),
        averageBookingValue: windowBookings
          ? round2(windowGrossValue / windowBookings)
          : 0,
        collectionRate: percent(windowRevenue, windowGrossValue),
      },
      trend,
    };
  }

  async recentBookings(user: AuthenticatedUser, limit: number): Promise<any[]> {
    const bookingFilter = await this.bookingScope(
      this.jurisdictionFilter(user),
    );
    const rows = await this.bookings
      .find(bookingFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("customerId", "name email")
      .populate("ashramId", "name address.city")
      .lean();
    return rows.map((row: any) => ({
      id: String(row._id),
      bookingId: row.bookingId ?? "",
      reservationNumber: row.reservationNumber ?? "",
      customerName: row.customerId?.name ?? "Deleted account",
      ashramName: row.ashramId?.name ?? "Unknown ashram",
      city: row.ashramId?.address?.city ?? "",
      status: row.status,
      paymentStatus: row.paymentStatus,
      paymentMode: row.paymentMode,
      totalAmount: round2(Number(row.pricing?.totalAmount ?? 0)),
      amountPaid: round2(Number(row.pricing?.amountPaid ?? 0)),
      checkInDate: row.checkInDate,
      checkOutDate: row.checkOutDate,
      createdAt: row.createdAt,
    }));
  }

  async logs(module?: string, action?: string): Promise<any[]> {
    const filter = {
      ...(module ? { module } : {}),
      ...(action ? { action } : {}),
    };
    const [platform, booking] = await Promise.all([
      this.platformAudits
        .find(filter)
        .populate("userId", "name email role")
        .sort({ timestamp: -1 })
        .limit(100)
        .lean(),
      this.audits
        .find(filter)
        .populate("userId", "name email role")
        .sort({ timestamp: -1 })
        .limit(100)
        .lean(),
    ]);
    return [...platform, ...booking]
      .sort(
        (a: any, b: any) =>
          new Date(b.timestamp ?? b.occurredAt).getTime() -
          new Date(a.timestamp ?? a.occurredAt).getTime(),
      )
      .slice(0, 100)
      .map((entry: any) => ({
        ...entry,
        timestamp: entry.timestamp ?? entry.occurredAt ?? entry.createdAt,
        summary: this.describe(entry),
      }));
  }

  private describe(entry: any): string {
    const detail = entry?.details;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    if (detail && typeof detail === "object") {
      const parts = Object.entries(detail)
        .filter(([, value]) => value !== null && typeof value !== "object")
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${String(value)}`);
      if (parts.length) return parts.join(" · ");
    }
    return String(entry?.module ?? "System");
  }
}
