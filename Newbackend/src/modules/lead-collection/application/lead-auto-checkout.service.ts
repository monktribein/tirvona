import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { LeadAttendanceService } from "./lead-attendance.service";
import { LeadTrackingService } from "./lead-tracking.service";

/**
 * Every five minutes, checks out any field executive who checked in 9+ hours
 * ago and never checked out. It only closes attendance rows on its own
 * authority (nothing is sent to anyone); set LEAD_AUTO_CHECKOUT_ENABLED=false
 * to switch it off.
 */
@Injectable()
export class LeadAutoCheckoutService {
  private readonly logger = new Logger(LeadAutoCheckoutService.name);
  private running = false;

  constructor(
    private readonly attendance: LeadAttendanceService,
    private readonly tracking: LeadTrackingService,
  ) {}

  @Interval(300_000)
  async sweep(): Promise<void> {
    if (process.env.LEAD_AUTO_CHECKOUT_ENABLED === "false" || this.running) return;
    this.running = true;
    try {
      const closed = await this.attendance.autoCheckOutStale();
      // The shift is over, so save its distance like a normal check-out does.
      // A failure here must not undo the check-out.
      for (const shift of closed)
        await this.tracking
          .saveShiftDistance(shift.agentId, shift.attendanceId)
          .catch((error) => this.logger.warn(`Distance not saved for ${shift.attendanceId}: ${(error as Error).message}`));
      if (closed.length > 0) this.logger.log(`Auto checked out ${closed.length} open lead check-in(s).`);
    } catch (error) {
      this.logger.error(`Lead auto check-out sweep failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
