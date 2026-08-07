import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { PARKING_MODEL } from "../../parking/domain/parking.constants";
import type { AnalyticsRange } from "../presentation/dtos/analytics.dto";

/**
 * Bucket unit and window length per dashboard tab.
 *
 * `unit` is passed straight to `$dateTrunc`, so the JS bucket generator below
 * has to agree with it exactly — a mismatch produces buckets that never join
 * against the aggregation result and a chart that silently reads all zeros.
 */
const RANGE_WINDOW: Record<
  AnalyticsRange,
  { unit: "day" | "week" | "month" | "year"; buckets: number }
> = {
  daily: { unit: "day", buckets: 14 },
  weekly: { unit: "week", buckets: 12 },
  monthly: { unit: "month", buckets: 12 },
  yearly: { unit: "year", buckets: 5 },
};

/** Truncate to the start of the bucket, matching `$dateTrunc`'s UTC semantics. */
const truncate = (date: Date, unit: string): Date => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  // $dateTrunc's default startOfWeek is Sunday, which is what getUTCDay() === 0
  // reports, so subtracting the weekday index lands on the same instant.
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

  /**
   * Whether parking belongs in this caller's figures.
   *
   * A parking booking references a partner and a location, never an ashram, so
   * there is no honest way to attribute it to a state or district. Only
   * national-scope callers — whose ashram filter is empty — see it; a district
   * officer's numbers stay ashram-only rather than being inflated with revenue
   * from a car park that may sit outside their jurisdiction.
   */
  private includesParking(ashramFilter: Record<string, any>): boolean {
    return Object.keys(ashramFilter).length === 0;
  }
  private async scope(
    user: AuthenticatedUser,
    requested?: string,
  ): Promise<any> {
    if (user.role === "super_admin") return requested ? requested : undefined;
    const ids =
      user.role === "owner"
        ? (
            await this.ashrams.find({ ownerId: user.id }).select("_id").lean()
          ).map((a: any) => String(a._id))
        : [
            ...new Set([
              ...(user.scopedAshramIds ?? []),
              ...(user.employerAshramId ? [user.employerAshramId] : []),
            ]),
          ];
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
    const confirmed = bookings.filter(
      (b: any) => b.status === "confirmed",
    ).length;
    const checkedIn = bookings.filter(
      (b: any) => b.status === "checked_in",
    ).length;
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
    return {
      totalBookings: bookings.length,
      occupancyRate: bookings.length
        ? Math.min(
            100,
            Math.round(((confirmed + checkedIn) * 100) / bookings.length),
          )
        : 0,
      revenue: bookings.reduce((n: number, b: any) => n + paid(b), 0),
      pendingPayments: bookings.reduce(
        (n: number, b: any) =>
          n + Math.max(0, Number(b.pricing?.totalAmount ?? 0) - paid(b)),
        0,
      ),
      checkInsToday: checkedIn,
      checkoutSoon: checkedIn,
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

  /**
   * Translate an ashram-level jurisdiction filter into a booking-level one.
   *
   * A national role has no filter, and materialising every ashram `_id` just to
   * write `{ $in: [...every id...] }` is both slower and larger than the empty
   * match it is equivalent to — so that case short-circuits. Scoped roles are
   * bounded by their state or district, which keeps the id list small.
   */
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
                  grossValue: { $sum: { $ifNull: ["$pricing.totalAmount", 0] } },
                  cancellations: {
                    $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
                  },
                },
              },
            ],
            // The pilgrim count is distinct customers with a booking. This used
            // to read `booking.userId`, a field the booking schema does not
            // have, so every document contributed the same `undefined` and the
            // dashboard reported exactly one pilgrim forever.
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
    // Platform financials, not stay financials. Parking revenue is real money
    // the platform collected and belongs in the same totals.
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

  /**
   * Everything the admin dashboard charts need, in one round trip.
   *
   * The channel split is a real field — `paymentMode` — not an invented ratio:
   * `online` means the pilgrim paid through the gateway, anything else was
   * settled at the counter. That is exactly the "Online vs Direct Desk"
   * distinction the dashboard has always claimed to draw.
   */
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
              {
                $group: {
                  _id: channelBranch,
                  count: { $sum: 1 },
                  revenue: { $sum: { $ifNull: ["$pricing.amountPaid", 0] } },
                },
              },
            ],
            statuses: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
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
        // Ranked on booked value, not cash collected: a counter-settled ashram
        // would otherwise rank last regardless of how much it actually sold.
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
      // Parking settles in its own collection, so it is aggregated separately
      // and merged below rather than joined — the two domains share no key.
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
                      revenue: { $sum: { $ifNull: ["$pricing.amountPaid", 0] } },
                      gross: { $sum: { $ifNull: ["$pricing.totalAmount", 0] } },
                    },
                  },
                ],
                allTime: [
                  {
                    $group: {
                      _id: null,
                      bookings: { $sum: 1 },
                      revenue: { $sum: { $ifNull: ["$pricing.amountPaid", 0] } },
                      gross: { $sum: { $ifNull: ["$pricing.totalAmount", 0] } },
                    },
                  },
                ],
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    // Parking contributions indexed by bucket, so the series below can add them
    // to the matching night without a second pass over the data.
    const parkingByBucket = new Map<string, any>(
      (parkingSeries as any[]).map((row) => [
        new Date(row._id).toISOString(),
        row,
      ]),
    );

    // Index the sparse aggregation result so empty buckets render as real
    // zeroes rather than collapsing the x-axis onto whichever days had traffic.
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
      // Parking is a gateway-settled stream, so it joins the "online" series;
      // the module split below is what keeps the two distinguishable.
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
    const channelTotal = channelRows.reduce(
      (sum: number, row: any) => sum + Number(row.count ?? 0),
      0,
    );
    const channels = ["online", "desk"].map((key) => {
      const row = channelRows.find((r: any) => r._id === key);
      const count = Number(row?.count ?? 0);
      return {
        channel: key,
        label: key === "online" ? "Online Gateway" : "Direct Desk",
        count,
        revenue: round2(Number(row?.revenue ?? 0)),
        share: percent(count, channelTotal),
      };
    });

    const statusRows = facet[0]?.statuses ?? [];
    const statusTotal = statusRows.reduce(
      (sum: number, row: any) => sum + Number(row.count ?? 0),
      0,
    );
    // Lifecycle order, so the breakdown reads as a pipeline rather than as an
    // arbitrary list. Statuses with no documents are dropped, not zero-filled —
    // an empty row carries no information in a ranked bar list.
    const STATUS_ORDER = [
      "pending",
      "confirmed",
      "checked_in",
      "checked_out",
      "completed",
      "cancelled",
      "refunded",
      "no_show",
      "expired",
    ];
    const statuses = statusRows
      .map((row: any) => ({
        status: String(row._id ?? "unknown"),
        count: Number(row.count ?? 0),
        share: percent(Number(row.count ?? 0), statusTotal),
      }))
      .sort(
        (a: any, b: any) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
      );

    const windowTotals = facet[0]?.window?.[0] ?? {};
    const parkingWindow = (parkingTotals as any[])[0]?.window?.[0] ?? {};
    const parkingAllTime = (parkingTotals as any[])[0]?.allTime?.[0] ?? {};

    // Platform totals span every revenue stream. Parking used to be omitted
    // entirely, so a platform that had collected real money through car parks
    // reported zero.
    const stayBookings = Number(windowTotals.bookings ?? 0);
    const stayRevenue = round2(Number(windowTotals.revenue ?? 0));
    const parkingBookingCount = Number(parkingWindow.bookings ?? 0);
    const parkingRevenue = round2(Number(parkingWindow.revenue ?? 0));
    const windowBookings = stayBookings + parkingBookingCount;
    const windowRevenue = round2(stayRevenue + parkingRevenue);
    // Booked value and collected cash are different numbers, and on a platform
    // where stays are paid at the counter they can differ by everything. The
    // dashboard needs both or a fully unpaid ledger reads as "no activity".
    const windowGrossValue = round2(
      Number(windowTotals.nightsValue ?? 0) + Number(parkingWindow.gross ?? 0),
    );

    // Compare the latest bucket against the one before it. When the prior
    // bucket is empty there is no baseline, so the change is reported as
    // unknown rather than as a percentage of nothing — dividing 6 new bookings
    // by a floor of 1 would otherwise claim a 600% rise.
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
      // Which stream the money came from. The headline figures are the
      // platform total; this is what keeps stays and parking legible.
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
        // Booked value per booking, not collected — an average that divides
        // unpaid cash by real bookings would report zero on a healthy pipeline.
        averageBookingValue: windowBookings
          ? round2(windowGrossValue / windowBookings)
          : 0,
        collectionRate: percent(windowRevenue, windowGrossValue),
      },
      trend,
    };
  }

  /**
   * The most recent bookings in the caller's jurisdiction.
   *
   * The dashboard table used to call `/bookings/history`, which is
   * `@Roles("customer")` and returns only the caller's own stays — so an admin
   * got a 403 and the page fell back to hardcoded sample rows.
   */
  async recentBookings(
    user: AuthenticatedUser,
    limit: number,
  ): Promise<any[]> {
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
        // `timestamp` is what every consumer renders, but only the booking
        // audit schema also carries `occurredAt`; normalising here keeps the
        // activity feed from printing "Invalid Date" for those rows.
        timestamp: entry.timestamp ?? entry.occurredAt ?? entry.createdAt,
        // `details` is a Mixed column: a string on some writers, an object on
        // others. A feed that interpolates it directly renders "[object
        // Object]", so the readable form is resolved once, here.
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
