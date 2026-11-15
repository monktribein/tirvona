import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { TransactionService } from "../../../common/database/transaction.service";
import { AARTI_MODEL } from "../domain/aarti.constants";
import { AARTI_REPOSITORY, AartiRepository } from "../domain/aarti.repository";
import { WalletService } from "../../wallet/application/wallet.service";

/**
 * Background upkeep for aarti passes.
 *
 * An unpaid booking holds its passes only until `reservationExpiresAt`.
 * Without this sweep an abandoned checkout stayed "pending" forever and kept
 * its passes counted as booked, so a session could read "fully booked" while
 * nobody had paid. Each booking is claimed with a conditional update, so
 * several API instances running the sweep at once cannot release the same
 * passes twice. A payment that still arrives afterwards is handled by
 * `AartiBookingService.confirmPayment`: the passes are taken again if free,
 * otherwise the money is refunded to the pilgrim's wallet.
 *
 * Set AARTI_MAINTENANCE_ENABLED=false to switch it off on an instance.
 */
@Injectable()
export class AartiMaintenanceService {
  private readonly logger = new Logger(AartiMaintenanceService.name);
  private running = false;

  constructor(
    @Inject(AARTI_REPOSITORY) private readonly repository: AartiRepository,
    private readonly transactions: TransactionService,
    @InjectModel(AARTI_MODEL.Booking) private readonly bookings: Model<any>,
    private readonly wallet: WalletService,
  ) {}

  @Interval(60_000)
  async expireHolds(): Promise<number> {
    if (process.env.AARTI_MAINTENANCE_ENABLED === "false" || this.running)
      return 0;
    this.running = true;
    try {
      const stale: any[] = await this.bookings
        .find({
          status: "pending",
          reservationExpiresAt: { $ne: null, $lt: new Date() },
        })
        .select("_id")
        .limit(200)
        .lean();
      let expired = 0;
      for (const row of stale) {
        try {
          if (await this.expireOne(row._id)) expired += 1;
        } catch (error) {
          this.logger.error(
            `Could not expire aarti booking ${String(row._id)}: ${(error as Error).message}`,
          );
        }
      }
      if (expired)
        this.logger.log(`Released the passes of ${expired} unpaid aarti booking(s)`);
      return expired;
    } catch (error) {
      this.logger.error(`Aarti hold sweep failed: ${(error as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async expireOne(id: unknown): Promise<boolean> {
    return this.transactions.run(async (session) => {
      const booking = await this.bookings.findOneAndUpdate(
        {
          _id: id,
          status: "pending",
          reservationExpiresAt: { $ne: null, $lt: new Date() },
        },
        { $set: { status: "expired", reservationExpiresAt: null } },
        { new: true, session },
      );
      if (!booking) return false;
      // Not a `$push` in the claim above: the Postgres driver cannot
      // serialise a pushed sub-document next to existing ones.
      booking.history.push({
        status: "expired",
        note: "Payment hold expired before payment",
        at: new Date(),
      });
      await booking.save({ session });
      await this.repository.releaseSeats({
        passTypeId: String(booking.passTypeId),
        date: booking.sessionDate,
        seats: Number(booking.passCount),
        session,
      });
      await this.wallet.releaseHold("aarti", booking._id, session);
      return true;
    });
  }
}
