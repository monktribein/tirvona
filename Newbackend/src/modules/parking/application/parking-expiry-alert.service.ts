import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { PARKING_MODEL } from "../domain/parking.constants";

const ALERT_WINDOW_START_MS = 10 * 60 * 1000;
const ALERT_WINDOW_END_MS = 15 * 60 * 1000;

/** Warns a guest ~15 minutes before their hourly parking session ends, once
 * per booking. Mirrors ParkingManagementService's @Interval maintenance
 * sweep but lives in its own file since it's a distinct concern. */
@Injectable()
export class ParkingExpiryAlertService {
  private readonly logger = new Logger(ParkingExpiryAlertService.name);

  constructor(
    @InjectModel(PARKING_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(PARKING_MODEL.Notification)
    private readonly notifications: Model<any>,
  ) {}

  @Interval(60_000)
  async sendExpiryAlerts(): Promise<void> {
    const now = Date.now();
    const windowStart = new Date(now + ALERT_WINDOW_START_MS);
    const windowEnd = new Date(now + ALERT_WINDOW_END_MS);

    const due = await this.bookings
      .find({
        status: "checked_in",
        exitAt: { $gte: windowStart, $lte: windowEnd },
        expiryAlertSentAt: null,
      })
      .select("_id customerId bookingReference")
      .limit(200)
      .lean();

    for (const booking of due) {
      const result = await this.bookings.updateOne(
        { _id: booking._id, expiryAlertSentAt: null },
        { $set: { expiryAlertSentAt: new Date() } },
      );
      if (!result.modifiedCount) continue;

      await this.notifications.create({
        userId: booking.customerId,
        bookingId: booking._id,
        event: "exit_reminder",
        title: "Parking expiring soon",
        message: "Your parking pass expires in 15 minutes. Tap here to extend it.",
        channel: "in_app",
        status: "queued",
        pushEnabled: true,
        data: { bookingId: String(booking._id) },
        meta: { correlationId: `parking:${String(booking._id)}:exit_reminder` },
      });
    }

    if (due.length)
      this.logger.log(
        JSON.stringify({
          event: "parking.expiry_alerts_dispatched",
          count: due.length,
        }),
      );
  }
}
