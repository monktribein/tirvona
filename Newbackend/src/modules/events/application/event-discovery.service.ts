import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { escapeRegex } from "../../../common/utils/escape-regex";
import {
  EVENT_FACILITIES,
  EVENT_MODEL,
  EVENT_TYPES,
  EVENT_TYPE_META,
} from "../domain/event.constants";
import {
  combineDateAndTime,
  datesInRange,
  toDateKey,
} from "../domain/event.utils";
import { EventSettingsService } from "./event-settings.service";
import type { EventSearchDto } from "../presentation/dtos/event.dto";

const PUBLIC_EVENT_FIELDS =
  "name slug eventType deity tagline description highlights dressCode instructions termsAndConditions images coverImage venue latitude longitude googleMapsUrl startDate endDate startTime durationMinutes timezone dailySchedule facilities contactPhone requiresRegistration dailyCapacity maxSeatsPerRegistration isFeatured ashramId status viewCount";

@Injectable()
export class EventDiscoveryService {
  constructor(
    @InjectModel(EVENT_MODEL.Event) private readonly events: Model<any>,
    @InjectModel(EVENT_MODEL.Availability)
    private readonly availability: Model<any>,
    private readonly settingsService: EventSettingsService,
  ) {}

  filters(): Record<string, unknown> {
    return {
      eventTypes: EVENT_TYPES.map((type) => ({
        value: type,
        label: EVENT_TYPE_META[type].label,
      })),
      facilities: EVENT_FACILITIES.map((facility) => ({
        value: facility,
        label: facility
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
      })),
      sort: [
        { value: "upcoming", label: "Starting soonest" },
        { value: "recommended", label: "Recommended" },
        { value: "newest", label: "Recently added" },
      ],
    };
  }

  cities(): Promise<any[]> {
    return this.events.aggregate([
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

  async search(query: EventSearchDto): Promise<any> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 12, 50);
    const filter: Record<string, unknown> = { status: "approved" };

    if (query.city)
      filter["venue.city"] = new RegExp(`^${escapeRegex(query.city)}$`, "i");
    if (query.state)
      filter["venue.state"] = new RegExp(`^${escapeRegex(query.state)}$`, "i");
    if (query.eventType) filter.eventType = query.eventType;
    if (query.ashramId) filter.ashramId = query.ashramId;
    if (query.facilities?.length) filter.facilities = { $all: query.facilities };
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q), "i");
      filter.$or = [
        { name: pattern },
        { deity: pattern },
        { tagline: pattern },
        { "venue.name": pattern },
        { "venue.city": pattern },
      ];
    }

    // A festival that started yesterday and runs all week is still "on", so the
    // window test is against endDate, not startDate.
    if (query.date) {
      const day = toDateKey(query.date);
      filter.startDate = { $lte: day };
      filter.endDate = { $gte: day };
    } else if (!query.includePast) {
      filter.endDate = { $gte: toDateKey(new Date()) };
    }

    const sort: Record<string, 1 | -1> =
      query.sort === "newest"
        ? { createdAt: -1 }
        : query.sort === "recommended"
          ? { isFeatured: -1, startDate: 1 }
          : { startDate: 1 };

    const [rows, total] = await Promise.all([
      this.events
        .find(filter)
        .select(PUBLIC_EVENT_FIELDS)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.events.countDocuments(filter),
    ]);

    return {
      success: true,
      count: rows.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      data: rows.map((row) => this.decorate(row)),
    };
  }

  private decorate(event: any): any {
    const now = new Date();
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return {
      ...event,
      eventTypeLabel:
        EVENT_TYPE_META[event.eventType as keyof typeof EVENT_TYPE_META]
          ?.label ?? "Event",
      isOnNow: start <= now && end >= toDateKey(now),
      hasEnded: end < toDateKey(now),
      dayCount: datesInRange(event.startDate, event.endDate).length,
      startsAt: combineDateAndTime(
        event.startDate,
        event.startTime || "09:00",
        event.timezone,
      ).toISOString(),
    };
  }

  async detail(idOrSlug: string): Promise<any | null> {
    const filter = /^[0-9a-f]{24}$/i.test(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug.toLowerCase() };
    const event = await this.events
      .findOne({ ...filter, status: "approved" })
      .select(PUBLIC_EVENT_FIELDS)
      .lean();
    if (!event) return null;

    await this.events.updateOne({ _id: event._id }, { $inc: { viewCount: 1 } });

    const settings = await this.settingsService.resolve(
      String(event._id),
      String(event.ashramId),
    );

    return {
      ...this.decorate(event),
      days: await this.dayAvailability(event, settings),
      policy: {
        allowRegistration:
          settings.allowRegistration && event.requiresRegistration !== false,
        allowCancellation: settings.allowCancellation,
        maxSeatsPerRegistration: Math.min(
          Number(event.maxSeatsPerRegistration || settings.maxSeatsPerRegistration),
          Number(settings.maxSeatsPerRegistration),
        ),
        gateOpensBeforeMinutes: settings.gateOpensBeforeMinutes,
        registrationClosesBeforeMinutes:
          settings.registrationClosesBeforeMinutes,
      },
    };
  }

  /**
   * One row per day the event runs, with seats left and whether registration is
   * still open for that day. This is what the date picker on the public page is
   * built from, so a closed or sold-out day is visible before a devotee tries.
   */
  async dayAvailability(
    event: any,
    settings?: Record<string, any>,
  ): Promise<any[]> {
    const resolved =
      settings ??
      (await this.settingsService.resolve(
        String(event._id),
        String(event.ashramId),
      ));
    const dates = datesInRange(event.startDate, event.endDate);
    const rows = await this.availability
      .find({ eventId: event._id, date: { $in: dates } })
      .lean();

    const capacity = Number(event.dailyCapacity ?? 0);
    return dates.map((date) => {
      const row = rows.find(
        (candidate) => toDateKey(candidate.date).getTime() === date.getTime(),
      );
      const total = Number(row?.totalCapacity ?? capacity);
      const taken =
        Number(row?.bookedCount ?? 0) + Number(row?.blockedCount ?? 0);
      const startsAt = combineDateAndTime(
        date,
        event.startTime || "09:00",
        event.timezone,
      );
      const closesAt = new Date(
        startsAt.getTime() -
          Number(resolved.registrationClosesBeforeMinutes) * 60_000,
      );
      return {
        date: date.toISOString().slice(0, 10),
        startsAt: startsAt.toISOString(),
        totalCapacity: total,
        seatsRemaining: total > 0 ? Math.max(0, total - taken) : null,
        isClosed: Boolean(row?.isClosed),
        registrationOpen:
          !row?.isClosed &&
          closesAt.getTime() > Date.now() &&
          (total <= 0 || total - taken > 0),
        note: row?.note ?? "",
      };
    });
  }
}
