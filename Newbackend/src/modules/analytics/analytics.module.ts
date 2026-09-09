import { Module } from "@nestjs/common";
import { AshramsModule } from "../ashrams/ashrams.module";
import { BookingsModule } from "../bookings/bookings.module";
import { UsersModule } from "../users/users.module";
import { AuditModule } from "../audit/audit.module";
import { ParkingModule } from "../parking/parking.module";
import { AartiModule } from "../aarti/aarti.module";
import { EventsModule } from "../events/events.module";
import { CommerceModule } from "../commerce/commerce.module";
import { AnalyticsService } from "./application/analytics.service";
import { SectionSummaryService } from "./application/section-summary.service";
import { AnalyticsController } from "./presentation/analytics.controller";
@Module({
  imports: [
    AshramsModule,
    BookingsModule,
    UsersModule,
    AuditModule,
    ParkingModule,
    AartiModule,
    EventsModule,
    CommerceModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, SectionSummaryService],
})
export class AnalyticsModule {}
