import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { FoodOrderService } from "./food-order.service";

/**
 * Background upkeep for food orders. Each run is idempotent: an order is
 * claimed with a conditional update, so several API instances running this at
 * once cannot time out (or refund) the same order twice.
 * Set FOOD_MAINTENANCE_ENABLED=false to switch it off on an instance.
 */
@Injectable()
export class FoodMaintenanceService {
  private readonly logger = new Logger(FoodMaintenanceService.name);
  private running = false;
  private refunding = false;

  constructor(private readonly orders: FoodOrderService) {}

  /** Follows refunds the gateway had not finished, and retries the ones that failed. */
  @Interval(300_000)
  async sweepRefunds(): Promise<number> {
    if (process.env.FOOD_MAINTENANCE_ENABLED === "false" || this.refunding) return 0;
    this.refunding = true;
    try {
      const reconciled = await this.orders.reconcileRefunds();
      const retried = await this.orders.retryFailedRefunds();
      return reconciled + retried;
    } catch (error) {
      this.logger.error(`Refund sweep failed: ${(error as Error).message}`);
      return 0;
    } finally {
      this.refunding = false;
    }
  }

  /** Paid orders the kitchen did not accept in time are cancelled and refunded. */
  @Interval(30_000)
  async sweepVendorTimeouts(): Promise<number> {
    if (process.env.FOOD_MAINTENANCE_ENABLED === "false" || this.running) return 0;
    this.running = true;
    try {
      const count = await this.orders.checkVendorTimeouts();
      if (count) this.logger.log(`Timed out ${count} food order(s) the kitchen did not accept`);
      return count;
    } catch (error) {
      this.logger.error(`Vendor timeout sweep failed: ${(error as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
