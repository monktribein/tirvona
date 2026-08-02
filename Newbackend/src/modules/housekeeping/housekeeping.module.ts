import { Module } from "@nestjs/common";
import { AshramsModule } from "../ashrams/ashrams.module";
import { BookingsModule } from "../bookings/bookings.module";
import { HousekeepingService } from "./application/housekeeping.service";
import { HousekeepingController } from "./presentation/housekeeping.controller";
@Module({
  imports: [AshramsModule, BookingsModule],
  controllers: [HousekeepingController],
  providers: [HousekeepingService],
})
export class HousekeepingModule {}
