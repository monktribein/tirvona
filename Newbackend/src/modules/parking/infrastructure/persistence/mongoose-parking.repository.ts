import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model } from "mongoose";
import { PARKING_MODEL } from "../../domain/parking.constants";
import type { ParkingRepository } from "../../domain/parking.repository";
import { toDateKey } from "../../domain/parking.utils";

@Injectable()
export class MongooseParkingRepository implements ParkingRepository {
  constructor(
    @InjectModel(PARKING_MODEL.Location) private readonly locations: Model<any>,
    @InjectModel(PARKING_MODEL.SlotType) private readonly slotTypes: Model<any>,
    @InjectModel(PARKING_MODEL.Availability)
    private readonly availability: Model<any>,
    @InjectModel(PARKING_MODEL.Booking) private readonly bookings: Model<any>,
  ) {}

  findLocationById(id: string, session?: ClientSession): Promise<any | null> {
    return this.locations
      .findById(id)
      .session(session ?? null)
      .exec();
  }

  findLocationBySlugOrId(value: string): Promise<any | null> {
    const filter = /^[0-9a-f]{24}$/i.test(value)
      ? { _id: value }
      : { slug: value.toLowerCase() };
    return this.locations.findOne(filter).exec();
  }

  findSlotType(
    id: string,
    locationId?: string,
    session?: ClientSession,
  ): Promise<any | null> {
    return this.slotTypes
      .findOne({
        _id: id,
        ...(locationId ? { locationId } : {}),
        isActive: true,
      })
      .session(session ?? null)
      .exec();
  }

  async reserveInventory(input: {
    locationId: string;
    slotTypeId: string;
    dates: Date[];
    units: number;
    capacity: number;
    session: ClientSession;
  }): Promise<{ ok: boolean; failedDate?: string }> {
    for (const rawDate of input.dates) {
      const date = toDateKey(rawDate);
      await this.availability.updateOne(
        { slotTypeId: input.slotTypeId, date },
        {
          $setOnInsert: {
            locationId: input.locationId,
            slotTypeId: input.slotTypeId,
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
          slotTypeId: input.slotTypeId,
          date,
          isClosed: { $ne: true },
          $expr: {
            $lte: [
              { $add: ["$bookedCount", input.units] },
              { $subtract: ["$totalCapacity", "$blockedCount"] },
            ],
          },
        },
        { $inc: { bookedCount: input.units } },
        { new: true, session: input.session },
      );
      if (!row)
        return { ok: false, failedDate: date.toISOString().slice(0, 10) };
    }
    return { ok: true };
  }

  async releaseInventory(input: {
    slotTypeId: string;
    dates: Date[];
    units: number;
    session: ClientSession;
  }): Promise<void> {
    for (const rawDate of input.dates) {
      await this.availability.updateOne(
        {
          slotTypeId: input.slotTypeId,
          date: toDateKey(rawDate),
          bookedCount: { $gte: input.units },
        },
        { $inc: { bookedCount: -input.units } },
        { session: input.session },
      );
    }
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
          "locationId",
          "name slug address latitude longitude contactPhone images coverImage openingHours instructions termsAndConditions googleMapsUrl",
        )
        .populate("slotTypeId", "name code isCovered hasEvCharging floorLabel")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.bookings.countDocuments(filter),
    ]);
    return { items, total };
  }
}
