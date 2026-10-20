import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { ProviderBookingService } from "./provider-booking.service";
import { ProviderBookingPaymentService } from "./provider-booking-payment.service";
import { ProviderConsultationService } from "./provider-consultation.service";
import { ProviderVerificationService } from "./provider-verification.service";
import { providerConfig } from "./provider.helpers";

/** Calendar blocks that expired this long ago and still were not released are swept regardless of their owner. */
const ORPHAN_GRACE_MS = 5 * 60_000;

/**
 * Background upkeep. Every job is idempotent and works through conditional
 * updates, so running on several API instances at once is safe (the extra
 * runs simply find nothing left to do).
 */
@Injectable()
export class ProviderMaintenanceService {
  private readonly logger = new Logger(ProviderMaintenanceService.name);
  private sweeping = false;

  constructor(
    @InjectModel("ProviderBooking") private readonly bookings: Model<any>,
    @InjectModel("ProviderCalendarBlock") private readonly blocks: Model<any>,
    private readonly bookingService: ProviderBookingService,
    private readonly consultations: ProviderConsultationService,
    private readonly verification: ProviderVerificationService,
    private readonly payments: ProviderBookingPaymentService,
  ) {}

  /** Unpaid bookings and unanswered consultation requests give their time back. */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweepHolds(): Promise<{ bookings: number; consultations: number; blocks: number }> {
    const none = { bookings: 0, consultations: 0, blocks: 0 };
    if (!providerConfig().maintenanceEnabled || this.sweeping) return none;
    this.sweeping = true;
    try {
      const now = new Date();
      const stale: any[] = await this.bookings
        .find({ status: "PAYMENT_PENDING", holdExpiresAt: { $ne: null, $lte: now } })
        .select("_id")
        .limit(100)
        .lean();
      let released = 0;
      for (const row of stale) {
        try {
          await this.bookingService.expireHold(String(row._id));
          released += 1;
        } catch (error) {
          // Paid or cancelled a moment ago: nothing to release.
          this.logger.debug(`Hold ${row._id} not expired: ${(error as Error).message}`);
        }
      }
      const consultations = await this.consultations.expireUnanswered(now);
      const swept = await this.blocks.updateMany(
        {
          status: "ACTIVE",
          expiresAt: { $ne: null, $lte: new Date(now.getTime() - ORPHAN_GRACE_MS) },
        },
        { $set: { status: "EXPIRED", releasedAt: now } },
      );
      return { bookings: released, consultations, blocks: swept.modifiedCount ?? 0 };
    } catch (error) {
      this.logger.error(`Hold sweep failed: ${(error as Error).message}`);
      return none;
    } finally {
      this.sweeping = false;
    }
  }

  /**
   * Gateway refunds are asynchronous: ask the gateway how pending ones ended and retry the ones that failed to
   * be issued. Until then a refund is shown as pending, never as done.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileRefunds(): Promise<{ checked: number; changed: number }> {
    if (!providerConfig().maintenanceEnabled) return { checked: 0, changed: 0 };
    try {
      return await this.payments.reconcileRefunds();
    } catch (error) {
      this.logger.error(`Refund reconciliation failed: ${(error as Error).message}`);
      return { checked: 0, changed: 0 };
    }
  }

  /** Verifications whose validity ended stop counting toward the public badge. */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepVerifications(): Promise<number> {
    if (!providerConfig().maintenanceEnabled) return 0;
    try {
      return await this.verification.expireLapsed();
    } catch (error) {
      this.logger.error(`Verification expiry sweep failed: ${(error as Error).message}`);
      return 0;
    }
  }
}
