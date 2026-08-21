import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model } from "mongoose";
import { AARTI_MODEL } from "../../domain/aarti.constants";
import type { AartiRepository } from "../../domain/aarti.repository";
import { toDateKey } from "../../domain/aarti.utils";

@Injectable()
export class MongooseAartiRepository implements AartiRepository {
  constructor(
    @InjectModel(AARTI_MODEL.Session) private readonly sessions: Model<any>,
    @InjectModel(AARTI_MODEL.PassType) private readonly passTypes: Model<any>,
    @InjectModel(AARTI_MODEL.Availability)
    private readonly availability: Model<any>,
    @InjectModel(AARTI_MODEL.Booking) private readonly bookings: Model<any>,
  ) {}

  findSessionById(id: string, session?: ClientSession): Promise<any | null> {
    return this.sessions
      .findById(id)
      .session(session ?? null)
      .exec();
  }

  findSessionBySlugOrId(value: string): Promise<any | null> {
    const filter = /^[0-9a-f]{24}$/i.test(value)
      ? { _id: value }
      : { slug: value.toLowerCase() };
    return this.sessions.findOne(filter).exec();
  }

  findPassType(
    id: string,
    sessionId?: string,
    session?: ClientSession,
  ): Promise<any | null> {
    return this.passTypes
      .findOne({
        _id: id,
        ...(sessionId ? { sessionId } : {}),
        isActive: true,
      })
      .session(session ?? null)
      .exec();
  }

  async reserveSeats(input: {
    sessionId: string;
    passTypeId: string;
    date: Date;
    seats: number;
    capacity: number;
    session: ClientSession;
  }): Promise<{ ok: boolean; remaining?: number }> {
    const date = toDateKey(input.date);
    await this.availability.updateOne(
      { passTypeId: input.passTypeId, date },
      {
        $setOnInsert: {
          sessionId: input.sessionId,
          passTypeId: input.passTypeId,
          date,
          totalCapacity: input.capacity,
          bookedCount: 0,
          blockedCount: 0,
        },
      },
      { upsert: true, session: input.session },
    );
    const row = await this.availability.findOneAndUpdate(
      {
        passTypeId: input.passTypeId,
        date,
        isClosed: { $ne: true },
        $expr: {
          $lte: [
            { $add: ["$bookedCount", input.seats] },
            { $subtract: ["$totalCapacity", "$blockedCount"] },
          ],
        },
      },
      { $inc: { bookedCount: input.seats } },
      { new: true, session: input.session },
    );
    if (!row) {
      const current = await this.availability
        .findOne({ passTypeId: input.passTypeId, date })
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
    return { ok: true, remaining: row.totalCapacity - row.blockedCount - row.bookedCount };
  }

  async releaseSeats(input: {
    passTypeId: string;
    date: Date;
    seats: number;
    session: ClientSession;
  }): Promise<void> {
    await this.availability.updateOne(
      {
        passTypeId: input.passTypeId,
        date: toDateKey(input.date),
        bookedCount: { $gte: input.seats },
      },
      { $inc: { bookedCount: -input.seats } },
      { session: input.session },
    );
  }

  findBooking(id: string, session?: ClientSession): Promise<any | null> {
    return this.bookings
      .findById(id)
      .session(session ?? null)
      .exec();
  }

  findBookingForCustomer(id: string, customerId: string): Promise<any | null> {
    return this.bookings.findOne({ _id: id, customerId }).exec();
  }

  async listBookings(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<{ items: any[]; total: number }> {
    const [items, total] = await Promise.all([
      this.bookings
        .find(filter)
        .populate(
          "sessionId",
          "name slug kind deity venue latitude longitude contactPhone images coverImage startTime durationMinutes instructions dressCode termsAndConditions googleMapsUrl",
        )
        .populate("passTypeId", "name code zoneLabel includesPrasad includesSankalp")
        .sort({ sessionDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.bookings.countDocuments(filter),
    ]);
    return { items, total };
  }
}
