import { Global, Module } from "@nestjs/common";
import { TransactionService } from "./database/transaction.service";
import { HealthController } from "./health.controller";
import { RobotsController } from "./robots.controller";
import { SitemapController } from "./sitemap.controller";

@Global()
@Module({
  controllers: [HealthController, RobotsController, SitemapController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class CommonModule {}
