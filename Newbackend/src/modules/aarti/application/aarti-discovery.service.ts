import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { escapeRegex } from "../../../common/utils/escape-regex";
import {
  AARTI_FACILITIES,
  AARTI_KINDS,
  AARTI_KIND_META,
  AARTI_MODEL,
} from "../domain/aarti.constants";
import {
  combineDateAndTime,
  runsOnDate,
  toDateKey,
} from "../domain/aarti.utils";
import { AartiPricingService } from "./aarti-pricing.service";
import type { AartiSearchDto } from "../presentation/dtos/aarti.dto";

const PUBLIC_SESSION_FIELDS =
  "name slug kind deity description dressCode instructions images coverImage venue latitude longitude googleMapsUrl startTime durationMinutes timezone daysOfWeek startDate endDate facilities contactPhone totalCapacity isFeatured allowLiveStream rating ashramId status";

@Injectable()
export class AartiDiscoveryService {
  constructor(
    @InjectModel(AARTI_MODEL.Session) private readonly sessions: Model<any>,
    @InjectModel(AARTI_MODEL.PassType) private readonly passTypes: Model<any>,
    @InjectModel(AARTI_MODEL.Availability)
    private readonly availability: Model<any>,
    private readonly pricing: AartiPricingService,
  ) {}

  filters(): Record<string, unknown> {
    return {
      kinds: AARTI_KINDS.map((kind) => ({
        value: kind,
        label: AARTI_KIND_META[kind].label,
      })),
      facilities: AARTI_FACILITIES.map((facility) => ({
        value: facility,
        label: facility
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
      })),
      sort: [
        { value: "recommended", label: "Recommended" },
        { value: "price_low", label: "Price: Low to High" },
        { value: "price_high", label: "Price: High to Low" },
        { value: "rating", label: "Top rated" },
      ],
    };
  }

  async cities(): Promise<any[]> {
    return this.sessions.aggregate([
      { $match: { status: "approved" } },
      {
        $group: {
          _id: { $ifNull: ["$venue.city", ""] },
          count: { $sum: 1 },
          state: { $first: "$venue.state" },
        },
      },
      { $match: { _id: { $ne: "" } } },
      { $sort: { count: -1 } },
      { $limit: 40 },
      { $project: { _id: 0, city: "$_id", state: 1, count: 1 } },
    ]);
  }

  async search(query: AartiSearchDto): Promise<any> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 12, 50);
    const filter: Record<string, unknown> = { status: "approved" };

    if (query.city)
      filter["venue.city"] = new RegExp(`^${escapeRegex(query.city)}$`, "i");
    if (query.state)
      filter["venue.state"] = new RegExp(`^${escapeRegex(query.state)}$`, "i");
    if (query.kind) filter.kind = query.kind;
    if (query.ashramId) filter.ashramId = query.ashramId;
    if (query.facilities?.length) filter.facilities = { $all: query.facilities };
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q), "i");
      filter.$or = [
        { name: pattern },
        { deity: pattern },
        { "venue.name": pattern },
        { "venue.city": pattern },
      ];
    }
    if (query.date) {
      const weekday = toDateKey(query.date).getUTCDay();
      filter.$and = [
        {
          $or: [
            { daysOfWeek: { $size: 0 } },
            { daysOfWeek: weekday },
            { daysOfWeek: { $exists: false } },
          ],
        },
      ];
    }

    const sort: Record<string, 1 | -1> =
      query.sort === "rating"
        ? { "rating.average": -1, createdAt: -1 }
        : { isFeatured: -1, "rating.average": -1, createdAt: -1 };

    const [rows, total] = await Promise.all([
      this.sessions
        .find(filter)
        .select(PUBLIC_SESSION_FIELDS)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.sessions.countDocuments(filter),
    ]);

    const priced = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        kindLabel:
          AARTI_KIND_META[row.kind as keyof typeof AARTI_KIND_META]?.label ??
          "Aarti",
        nextOccurrence: this.nextOccurrence(row, query.date),
        fromPrice: await this.fromPrice(String(row._id)),
      })),
    );

    const ordered =
      query.sort === "price_low"
        ? priced.sort((a, b) => (a.fromPrice ?? 0) - (b.fromPrice ?? 0))
        : query.sort === "price_high"
          ? priced.sort((a, b) => (b.fromPrice ?? 0) - (a.fromPrice ?? 0))
          : priced;

    return {
      success: true,
      count: ordered.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      data: ordered,
    };
  }

  private async fromPrice(sessionId: string): Promise<number | null> {
    const [cheapest] = await this.passTypes
      .find({ sessionId, isActive: true })
      .select("basePrice")
      .sort({ basePrice: 1 })
      .limit(1)
      .lean();
    return cheapest ? Number(cheapest.basePrice) : null;
  }

  /**
   * The next date this aarti actually runs, walking forward from `from` over
   * the weekday schedule. Capped at 60 days so a session whose `daysOfWeek`
   * never matches (a misconfigured listing) returns null instead of looping.
   */
  nextOccurrence(session: any, from?: string | Date): string | null {
    try {
      let cursor = toDateKey(from ?? new Date());
      for (let attempt = 0; attempt < 60; attempt += 1) {
        if (runsOnDate(session, cursor)) {
          const startsAt = combineDateAndTime(
            cursor,
            session.startTime,
            session.timezone,
          );
          if (startsAt.getTime() > Date.now()) return startsAt.toISOString();
        }
        cursor = new Date(cursor.getTime() + 86_400_000);
      }
    } catch {
      return null;
    }
    return null;
  }

  async detail(idOrSlug: string, date?: string): Promise<any | null> {
    const filter = /^[0-9a-f]{24}$/i.test(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug.toLowerCase() };
    const session = await this.sessions
      .findOne({ ...filter, status: "approved" })
      .select(PUBLIC_SESSION_FIELDS)
      .lean();
    if (!session) return null;

    await this.sessions.updateOne(
      { _id: session._id },
      { $inc: { viewCount: 1 } },
    );

    const settings = await this.pricing.resolveSettings(
      String(session._id),
      String(session.ashramId),
    );

    return {
      ...session,
      kindLabel:
        AARTI_KIND_META[session.kind as keyof typeof AARTI_KIND_META]?.label ??
        "Aarti",
      nextOccurrence: this.nextOccurrence(session, date),
      upcomingDates: this.upcomingDates(session, Number(settings.bookingOpensDaysAhead)),
      passTypes: await this.passTypesFor(session, date),
      policy: {
        allowOnlineBooking: settings.allowOnlineBooking,
        allowCancellation: settings.allowCancellation,
        freeCancellationHours: settings.freeCancellationHours,
        refundPercentInsideWindow: settings.refundPercentInsideWindow,
        refundPercentOutsideWindow: settings.refundPercentOutsideWindow,
        maxPassesPerBooking: settings.maxPassesPerBooking,
        gateOpensBeforeMinutes: settings.gateOpensBeforeMinutes,
        bookingClosesBeforeMinutes: settings.bookingClosesBeforeMinutes,
      },
    };
  }

  private upcomingDates(session: any, daysAhead: number): string[] {
    const dates: string[] = [];
    let cursor = toDateKey(new Date());
    for (let attempt = 0; attempt < Math.min(daysAhead, 120); attempt += 1) {
      if (runsOnDate(session, cursor)) {
        const startsAt = combineDateAndTime(cursor, session.startTime, session.timezone);
        if (startsAt.getTime() > Date.now())
          dates.push(cursor.toISOString().slice(0, 10));
      }
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
    return dates;
  }

  async passTypesFor(session: any, date?: string): Promise<any[]> {
    const rows = await this.passTypes
      .find({ sessionId: session._id, isActive: true })
      .sort({ displayOrder: 1, basePrice: 1 })
      .lean();
    if (!date) {
      return rows.map((row) => ({
        ...row,
        seatsRemaining: Number(row.totalCapacity),
        unitPrice: Number(row.basePrice),
      }));
    }
    return Promise.all(
      rows.map(async (row) => {
        const quote = await this.pricing.quote(session, row, {
          sessionDate: date,
          passCount: 1,
        });
        return {
          ...row,
          available: quote.ok,
          unavailableReason: quote.ok ? null : quote.message,
          unitPrice: quote.ok ? quote.quote.unitPrice : Number(row.basePrice),
          seatsRemaining: quote.ok
            ? quote.quote.seatsRemaining
            : Number(row.totalCapacity),
          isPeak: quote.ok ? quote.quote.isPeak : false,
        };
      }),
    );
  }

  async availabilityCalendar(
    session: any,
    fromDate: string,
    toDate: string,
  ): Promise<any[]> {
    const start = toDateKey(fromDate);
    const end = toDateKey(toDate);
    const rows = await this.availability
      .find({ sessionId: session._id, date: { $gte: start, $lte: end } })
      .lean();
    const passTypes = await this.passTypes
      .find({ sessionId: session._id, isActive: true })
      .lean();
    const capacity = passTypes.reduce(
      (total, row) => total + Number(row.totalCapacity ?? 0),
      0,
    );

    const days: any[] = [];
    for (
      let cursor = start;
      cursor <= end;
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      if (!runsOnDate(session, cursor)) continue;
      const dayRows = rows.filter(
        (row) => toDateKey(row.date).getTime() === cursor.getTime(),
      );
      const booked = dayRows.reduce(
        (total, row) => total + Number(row.bookedCount ?? 0),
        0,
      );
      const blocked = dayRows.reduce(
        (total, row) => total + Number(row.blockedCount ?? 0),
        0,
      );
      days.push({
        date: cursor.toISOString().slice(0, 10),
        startsAt: combineDateAndTime(cursor, session.startTime, session.timezone).toISOString(),
        totalCapacity: capacity,
        seatsRemaining: Math.max(0, capacity - booked - blocked),
        isClosed: dayRows.some((row) => row.isClosed),
      });
    }
    return days;
  }
}
