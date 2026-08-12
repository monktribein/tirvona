import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AshramsService } from "./application/ashrams.service";
import { AshramsController } from "./presentation/ashrams.controller";
import { RoomsController } from "./presentation/rooms.controller";
import {
  AshramSchema,
  BookingAddonSchema,
  BookingInventorySchema,
  BookingPricingSchema,
  HousekeepingUnitSchema,
  RoomSchema,
} from "./infrastructure/persistence/ashram.schemas";
// Read-only here: removing a room category has to know whether anyone is
// still booked into it. This imports the schema, not BookingsModule, so no
// module cycle is created — BookingsModule already imports this one.
import { BookingSchema } from "../bookings/infrastructure/persistence/booking.schemas";
import { ParkingModule } from "../parking/parking.module";

@Module({
  imports: [
    ParkingModule,
    MongooseModule.forFeature([
      { name: "Ashram", schema: AshramSchema },
      { name: "Room", schema: RoomSchema },
      { name: "Booking", schema: BookingSchema },
      { name: "BookingInventory", schema: BookingInventorySchema },
      { name: "BookingPricing", schema: BookingPricingSchema },
      { name: "BookingAddon", schema: BookingAddonSchema },
      { name: "HousekeepingUnit", schema: HousekeepingUnitSchema },
    ]),
  ],
  controllers: [AshramsController, RoomsController],
  providers: [AshramsService],
  exports: [MongooseModule, AshramsService],
})
export class AshramsModule {}
