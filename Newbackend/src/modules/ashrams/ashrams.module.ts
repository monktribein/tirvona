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
  OfflineInventoryTransferSchema,
  OfflineRoomSchema,
  RoomSchema,
} from "./infrastructure/persistence/ashram.schemas";
import { BookingSchema } from "../bookings/infrastructure/persistence/booking.schemas";
import { ParkingModule } from "../parking/parking.module";
import { AshramSlugService } from "./application/ashram-slug.service";
import { OfflineInventoryService } from "./application/offline-inventory.service";
import { OfflineInventoryController } from "./presentation/offline-inventory.controller";

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
      { name: "OfflineRoom", schema: OfflineRoomSchema },
      {
        name: "OfflineInventoryTransfer",
        schema: OfflineInventoryTransferSchema,
      },
    ]),
  ],
  controllers: [
    AshramsController,
    RoomsController,
    OfflineInventoryController,
  ],
  providers: [AshramsService, AshramSlugService, OfflineInventoryService],
  exports: [
    MongooseModule,
    AshramsService,
    AshramSlugService,
    OfflineInventoryService,
  ],
})
export class AshramsModule {}
