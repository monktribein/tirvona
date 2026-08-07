import { Module } from "@nestjs/common";
import { AshramsModule } from "../ashrams/ashrams.module";
import { BookingsModule } from "../bookings/bookings.module";
import { UsersModule } from "../users/users.module";
import { AuditModule } from "../audit/audit.module";
import { ParkingModule } from "../parking/parking.module";
import { AnalyticsService } from "./application/analytics.service";
import { AnalyticsController } from "./presentation/analytics.controller";
@Module({
  imports: [
    AshramsModule,
    BookingsModule,
    UsersModule,
    AuditModule,
    // Parking is a separate revenue stream with its own collections; the
    // executive dashboard counts it, so its models must be reachable here.
    ParkingModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
