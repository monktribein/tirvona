import { Module } from "@nestjs/common";
import { AshramsModule } from "../ashrams/ashrams.module";
import { BookingsModule } from "../bookings/bookings.module";
import { ParkingModule } from "../parking/parking.module";
import { UsersModule } from "../users/users.module";
import { SearchService } from "./application/search.service";
import { SearchController } from "./presentation/search.controller";

/**
 * Cross-domain lookup for the admin console's global search bar.
 *
 * It reads other domains' models rather than owning collections of its own,
 * which is why it imports their modules for the Mongoose providers alone. It
 * writes nothing, so the domain-isolation rule (parking never touches booking
 * finance, and vice versa) is not weakened by the shared read path.
 */
@Module({
  imports: [AshramsModule, UsersModule, BookingsModule, ParkingModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
