import { Module } from "@nestjs/common";
import { AshramsModule } from "../ashrams/ashrams.module";
import { BookingsModule } from "../bookings/bookings.module";
import { ParkingModule } from "../parking/parking.module";
import { UsersModule } from "../users/users.module";
import { TemplesModule } from "../temples/temples.module";
import { SearchService } from "./application/search.service";
import { SearchController } from "./presentation/search.controller";

@Module({
  imports: [AshramsModule, UsersModule, BookingsModule, ParkingModule, TemplesModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
