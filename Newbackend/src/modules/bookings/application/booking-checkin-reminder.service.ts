import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

const REMINDER_WINDOW_START_MS = 23 * 60 * 60 * 1000;
const REMINDER_WINDOW_END_MS = 24 * 60 * 60 * 1000;

/** Sends a "your visit is tomorrow" push ~24h before check-in, once per
 * booking. Runs alongside BookingMaintenanceService in the same module. */
@Injectable()
export class BookingCheckinReminderService {
  private readonly logger = new Logger(BookingCheckinReminderService.name);

  constructor(
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel("BookingNotification")
    private readonly notifications: Model<any>,
  ) {}

  @Interval(15 * 60_000)
  async sendReminders(): Promise<void> {
    const now = Date.now();
    const windowStart = new Date(now + REMINDER_WINDOW_START_MS);
    const windowEnd = new Date(now + REMINDER_WINDOW_END_MS);

    const due = await this.bookings
      .find({
        status: "confirmed",
        checkInDate: { $gte: windowStart, $lte: windowEnd },
        checkinReminderSentAt: null,
      })
      .select("_id customerId ashramId bookingId")
      .limit(200)
      .lean();

    for (const booking of due) {
      const result = await this.bookings.updateOne(
        { _id: booking._id, checkinReminderSentAt: null },
        { $set: { checkinReminderSentAt: new Date() } },
      );
      if (!result.modifiedCount) continue;

      await this.notifications.create({
        userId: booking.customerId,
        bookingId: booking._id,
        ashramId: booking.ashramId,
        event: "checkin_reminder",
        title: "Your visit is tomorrow!",
        message:
          "Don't forget to keep your QR code handy for a smooth check-in.",
        channel: "in_app",
        status: "queued",
        pushEnabled: true,
        meta: { correlationId: `booking:${String(booking._id)}:checkin_reminder` },
      });
    }

    if (due.length)
      this.logger.log(
        JSON.stringify({
          event: "booking.checkin_reminders_dispatched",
          count: due.length,
        }),
      );
  }
}
