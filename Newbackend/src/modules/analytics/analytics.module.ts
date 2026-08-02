import { Module } from "@nestjs/common";
import { AshramsModule } from "../ashrams/ashrams.module";
import { BookingsModule } from "../bookings/bookings.module";
import { UsersModule } from "../users/users.module";
import { AuditModule } from "../audit/audit.module";
import { AnalyticsService } from "./application/analytics.service";
import { AnalyticsController } from "./presentation/analytics.controller";
@Module({
  imports: [AshramsModule, BookingsModule, UsersModule, AuditModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
