import { Inject, Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { TransactionService } from "../../../common/database/transaction.service";
import {
  BOOKING_REPOSITORY,
  type BookingRepository,
} from "../domain/booking.repository";

@Injectable()
export class BookingMaintenanceService {
  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly repository: BookingRepository,
    private readonly transactions: TransactionService,
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel("BookingInventoryHold") private readonly holds: Model<any>,
    @InjectModel("BookingStatusHistory") private readonly history: Model<any>,
    @InjectModel("BookingCoupon") private readonly coupons: Model<any>,
    @InjectModel("BookingOfferRedemption")
    private readonly redemptions: Model<any>,
    @InjectModel("BookingNotification")
    private readonly notifications: Model<any>,
  ) {}

  @Interval(60_000)
  async expireHolds(): Promise<void> {
    const ids = await this.bookings
      .find({ status: "pending", reservationExpiresAt: { $lte: new Date() } })
      .select("_id")
      .limit(100)
      .lean();
    for (const { _id } of ids)
      await this.transactions.run(async (session) => {
        const booking = await this.bookings.findOneAndUpdate(
          {
            _id,
            status: "pending",
            reservationExpiresAt: { $lte: new Date() },
          },
          { $set: { status: "expired", reservationExpiresAt: null } },
          { new: true, session },
        );
        if (!booking) return;
        await this.repository.releaseInventory({
          roomId: String(booking.roomId),
          dates: booking.occupiedDates,
          count: booking.roomsBookedCount,
          state: "held",
          session,
        });
        await this.holds.updateOne(
          { bookingId: booking._id, state: "held" },
          {
            $set: {
              state: "expired",
              releasedAt: new Date(),
              releaseReason: "Payment hold expired",
              expiresAt: null,
            },
          },
          { session },
        );
        if (booking.offerId) {
          await this.coupons.updateOne(
            { _id: booking.offerId },
            { $inc: { remainingRedemptions: 1, redemptionsCount: -1 } },
            { session },
          );
          await this.redemptions.updateOne(
            { bookingId: booking._id, status: "reserved" },
            { $set: { status: "released", releasedAt: new Date() } },
            { session },
          );
        }
        await Promise.all([
          this.history.create(
            [
              {
                bookingId: booking._id,
                fromStatus: "pending",
                toStatus: "expired",
                note: "Payment hold expired",
              },
            ],
            { session },
          ),
          this.notifications.create(
            [
              {
                userId: booking.customerId,
                bookingId: booking._id,
                ashramId: booking.ashramId,
                event: "booking_expired",
                title: "Reservation expired",
                message: `The payment hold for ${booking.bookingId} expired.`,
              },
            ],
            { session },
          ),
        ]);
      });
  }
}
