import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PayoutsService } from "./payouts.service";

@Injectable()
export class PayoutReconciliationService {
  private readonly logger = new Logger(PayoutReconciliationService.name);
  constructor(
    private readonly payouts: PayoutsService,
    private readonly config: ConfigService,
  ) {}

  @Cron("0 */5 * * * *")
  async reconcile(): Promise<void> {
    if (!this.config.get<boolean>("payout.enabled")) return;
    const ids = await this.payouts.reconciliationCandidates();
    for (const id of ids) {
      try {
        await this.payouts.reconcileOne(id);
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: "payout.reconciliation_failed",
            payoutId: id,
            error: error instanceof Error ? error.name : "UnknownError",
          }),
        );
      }
    }
  }
}
