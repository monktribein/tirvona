import { Global, Module } from "@nestjs/common";
import { TransactionService } from "./database/transaction.service";
import { HealthController } from "./health.controller";
import { RobotsController } from "./robots.controller";

@Global()
@Module({
  controllers: [HealthController, RobotsController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class CommonModule {}
