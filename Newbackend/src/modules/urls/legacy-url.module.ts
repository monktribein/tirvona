import { Module } from "@nestjs/common";
import { AartiModule } from "../aarti/aarti.module";
import { BookingsModule } from "../bookings/bookings.module";
import { CommerceModule } from "../commerce/commerce.module";
import { CommunityModule } from "../community/community.module";
import { ContentModule } from "../content/content.module";
import { EventsModule } from "../events/events.module";
import { ParkingModule } from "../parking/parking.module";
import { LegacyUrlService } from "./application/legacy-url.service";

/**
 * A leaf module: it imports the feature modules purely to reach their models
 * and is imported by nobody, so it cannot introduce a cycle.
 */
@Module({
  imports: [
    BookingsModule,
    AartiModule,
    ParkingModule,
    CommerceModule,
    CommunityModule,
    ContentModule,
    EventsModule,
  ],
  providers: [LegacyUrlService],
})
export class LegacyUrlModule {}
