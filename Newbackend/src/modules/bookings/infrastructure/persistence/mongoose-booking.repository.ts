import { ConflictException, Injectable, Optional } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model } from "mongoose";
import type { BookingRepository } from "../../domain/booking.repository";
import {
  activeDayStayFilter,
  nightWindow,
  peakDayStayUnits,
  policyClockMinutes,
} from "../../../day-stay/domain/day-stay-occupancy";

@Injectable()
export class MongooseBookingRepository implements BookingRepository {
  constructor(
    @InjectModel("BookingInventory") private readonly inventory: Model<any>,
    @Optional() @InjectModel("Booking") private readonly bookings?: Model<any>,
    @Optional() @InjectModel("Ashram") private readonly ashrams?: Model<any>,
  ) {}

  /**
   * Units of this room taken by Short Stay guests during each night's real
   * stay window (check-in time → next day's check-out time). Short Stay
   * bookings don't write to the nightly ledger, so without this an overnight
   * guest could be sold a room someone is resting in that afternoon.
   */
  private async dayStayUnitsByNight(
    ashramId: string,
    roomId: string,
    dates: Date[],
    session: ClientSession,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (!this.bookings || !dates.length) return result;
    const ashram = this.ashrams
      ? await this.ashrams.findById(ashramId).select("policies").session(session).lean()
      : null;
    const clocks = policyClockMinutes((ashram as any)?.policies);
    const windows = dates.map((d) => {
      const key = d.toISOString().slice(0, 10);
      return { key, ...nightWindow(key, clocks) };
    });
    const from = windows[0].start;
    const to = windows[windows.length - 1].end;
    const dayStays = await this.bookings
      .find(activeDayStayFilter(roomId, from, to))
      .select("dayStayDetails roomsBookedCount")
      .session(session)
      .lean();
    for (const w of windows) result.set(w.key, peakDayStayUnits(dayStays as any[], w));
    return result;
  }

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
    const dayStayUnits = await this.dayStayUnitsByNight(ashramId, roomId, dates, session);
    for (const date of dates) {
      const dateKey = date.toISOString().slice(0, 10);
      const shortStayUnits = dayStayUnits.get(dateKey) ?? 0;
      const units = Number(capacity);
      const validCapacity = Number.isFinite(units) ? Math.max(0, units) : 0;
      // $setOnInsert and $max can't target the same path in one update (it is
      // rejected as a conflicting update operator), so the insert-default and
      // the heal-stale-value steps have to run as two separate updates.
      await this.inventory.updateOne(
        { roomId, date },
        {
          $setOnInsert: {
            ashramId,
            roomId,
            date,
            totalInventory: validCapacity,
            heldCount: 0,
            bookedCount: 0,
            maintenanceCount: 0,
          },
        },
        { upsert: true, session },
      );
      await this.inventory.updateOne(
        { roomId, date },
        { $max: { totalInventory: validCapacity } },
        { session },
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
                  count + shortStayUnits,
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
          shortStayUnits > 0
            ? `Rooms are no longer available on ${dateKey}: some are booked for Short Stay that day. Please choose another room or date.`
            : `Rooms are no longer available on ${dateKey}. Please choose alternate dates.`,
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
