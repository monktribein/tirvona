import { Global, Module } from "@nestjs/common";
import { TransactionService } from "./database/transaction.service";
import { HealthController } from "./health.controller";

@Global()
@Module({
  controllers: [HealthController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class CommonModule {}
