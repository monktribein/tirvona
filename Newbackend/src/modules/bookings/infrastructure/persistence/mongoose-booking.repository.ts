import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model } from "mongoose";
import type { BookingRepository } from "../../domain/booking.repository";

@Injectable()
export class MongooseBookingRepository implements BookingRepository {
  constructor(
    @InjectModel("BookingInventory") private readonly inventory: Model<any>,
  ) {}

  async holdInventory({
    ashramId,
    roomId,
    dates,
    count,
    capacity,
    session,
  }: {
    ashramId: string;
    roomId: string;
    dates: Date[];
    count: number;
    capacity: number;
    session: ClientSession;
  }): Promise<void> {
    for (const date of dates) {
      await this.inventory.updateOne(
        { roomId, date },
        {
          $setOnInsert: {
            ashramId,
            roomId,
            date,
            totalInventory: capacity,
            heldCount: 0,
            bookedCount: 0,
            maintenanceCount: 0,
          },
        },
        { upsert: true, session },
      );
      const held = await this.inventory.findOneAndUpdate(
        {
          roomId,
          date,
          isClosed: { $ne: true },
          $expr: {
            $lte: [
              {
                $add: [
                  "$heldCount",
                  "$bookedCount",
                  "$maintenanceCount",
                  count,
                ],
              },
              "$totalInventory",
            ],
          },
        },
        { $inc: { heldCount: count } },
        { new: true, session },
      );
      if (!held)
        throw new ConflictException(
          `Rooms are no longer available on ${date.toISOString().slice(0, 10)}. Please choose alternate dates.`,
        );
    }
  }

  async confirmInventory({
    roomId,
    dates,
    count,
    session,
  }: {
    roomId: string;
    dates: Date[];
    count: number;
    session: ClientSession;
  }): Promise<void> {
    for (const date of dates) {
      const row = await this.inventory.updateOne(
        { roomId, date, heldCount: { $gte: count } },
        { $inc: { heldCount: -count, bookedCount: count } },
        { session },
      );
      if (!row.modifiedCount)
        throw new ConflictException(
          "The reservation inventory hold is no longer available.",
        );
    }
  }

  async releaseInventory({
    roomId,
    dates,
    count,
    state,
    session,
  }: {
    roomId: string;
    dates: Date[];
    count: number;
    state: "held" | "booked";
    session: ClientSession;
  }): Promise<void> {
    const field = state === "held" ? "heldCount" : "bookedCount";
    for (const date of dates)
      await this.inventory.updateOne(
        { roomId, date, [field]: { $gte: count } },
        { $inc: { [field]: -count } },
        { session },
      );
  }
}
