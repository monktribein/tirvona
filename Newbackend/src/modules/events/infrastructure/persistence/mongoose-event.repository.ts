import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model } from "mongoose";
import { EVENT_MODEL } from "../../domain/event.constants";
import type { EventRepository } from "../../domain/event.repository";
import { toDateKey } from "../../domain/event.utils";

@Injectable()
export class MongooseEventRepository implements EventRepository {
  constructor(
    @InjectModel(EVENT_MODEL.Event) private readonly events: Model<any>,
    @InjectModel(EVENT_MODEL.Availability)
    private readonly availability: Model<any>,
    @InjectModel(EVENT_MODEL.Registration)
    private readonly registrations: Model<any>,
  ) {}

  findEventById(id: string, session?: ClientSession): Promise<any | null> {
    return this.events
      .findById(id)
      .session(session ?? null)
      .exec();
  }

  findEventBySlugOrId(value: string): Promise<any | null> {
    const filter = /^[0-9a-f]{24}$/i.test(value)
      ? { _id: value }
      : { slug: value.toLowerCase() };
    return this.events.findOne(filter).exec();
  }

  /**
   * A capacity of 0 means the ashram has not capped the day, so the conditional
   * guard is skipped entirely rather than blocking every registration.
   */
  async reserveSeats(input: {
    eventId: string;
    date: Date;
    seats: number;
    capacity: number;
    session: ClientSession;
  }): Promise<{ ok: boolean; remaining?: number }> {
    const date = toDateKey(input.date);
    await this.availability.updateOne(
      { eventId: input.eventId, date },
      {
        $setOnInsert: {
          eventId: input.eventId,
          date,
          totalCapacity: input.capacity,
          bookedCount: 0,
          blockedCount: 0,
        },
      },
      { upsert: true, session: input.session },
    );

    const uncapped = { totalCapacity: { $lte: 0 } };
    const withinCapacity = {
      $expr: {
        $lte: [
          { $add: ["$bookedCount", input.seats] },
          { $subtract: ["$totalCapacity", "$blockedCount"] },
        ],
      },
    };
    const row = await this.availability.findOneAndUpdate(
      {
        eventId: input.eventId,
        date,
        isClosed: { $ne: true },
        $or: [uncapped, withinCapacity],
      },
      { $inc: { bookedCount: input.seats } },
      { new: true, session: input.session },
    );

    if (!row) {
      const current = await this.availability
        .findOne({ eventId: input.eventId, date })
        .session(input.session)
        .lean();
      return {
        ok: false,
        remaining: Math.max(
          0,
          Number(current?.totalCapacity ?? input.capacity) -
            Number(current?.blockedCount ?? 0) -
            Number(current?.bookedCount ?? 0),
        ),
      };
    }
    return {
      ok: true,
      remaining:
        row.totalCapacity > 0
          ? Math.max(0, row.totalCapacity - row.blockedCount - row.bookedCount)
          : undefined,
    };
  }

  async releaseSeats(input: {
    eventId: string;
    date: Date;
    seats: number;
    session: ClientSession;
  }): Promise<void> {
    await this.availability.updateOne(
      {
        eventId: input.eventId,
        date: toDateKey(input.date),
        bookedCount: { $gte: input.seats },
      },
      { $inc: { bookedCount: -input.seats } },
      { session: input.session },
    );
  }

  findRegistration(id: string, session?: ClientSession): Promise<any | null> {
    return this.registrations
      .findById(id)
      .session(session ?? null)
      .exec();
  }

  findRegistrationForCustomer(
    id: string,
    customerId: string,
  ): Promise<any | null> {
    return this.registrations.findOne({ _id: id, customerId }).exec();
  }

  async listRegistrations(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<{ items: any[]; total: number }> {
    const [items, total] = await Promise.all([
      this.registrations
        .find(filter)
        .populate(
          "eventId",
          "name slug eventType deity venue latitude longitude contactPhone images coverImage startDate endDate startTime durationMinutes instructions dressCode googleMapsUrl",
        )
        .sort({ attendDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.registrations.countDocuments(filter),
    ]);
    return { items, total };
  }
}
