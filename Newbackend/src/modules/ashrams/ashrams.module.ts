import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AshramsService } from "./application/ashrams.service";
import { AshramsController } from "./presentation/ashrams.controller";
import { RoomsController } from "./presentation/rooms.controller";
import { RoomRatesController } from "./presentation/room-rates.controller";
import {
  AshramSchema,
  BookingAddonSchema,
  BookingInventorySchema,
  BookingPricingSchema,
  HousekeepingUnitSchema,
  InventoryReturnRequestSchema,
  OfflineInventoryTransferSchema,
  OfflineRoomSchema,
  RoomRateSchema,
  RoomSchema,
} from "./infrastructure/persistence/ashram.schemas";
import { BookingSchema } from "../bookings/infrastructure/persistence/booking.schemas";
import { UserSchema } from "../users/infrastructure/persistence/user.schema";
import { ParkingModule } from "../parking/parking.module";
import { AuditModule } from "../audit/audit.module";
import { AshramSlugService } from "./application/ashram-slug.service";
import { OfflineInventoryService } from "./application/offline-inventory.service";
import { RoomSummaryService } from "./application/room-summary.service";
import { RoomRatesService } from "./application/room-rates.service";
import { OfflineInventoryController } from "./presentation/offline-inventory.controller";

@Module({
  imports: [
    ParkingModule,
    AuditModule,
    MongooseModule.forFeature([
      { name: "Ashram", schema: AshramSchema },
      { name: "Room", schema: RoomSchema },
      { name: "RoomRate", schema: RoomRateSchema },
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
      {
        name: "InventoryReturnRequest",
        schema: InventoryReturnRequestSchema,
      },
      { name: "User", schema: UserSchema },
    ]),
  ],
  controllers: [
    AshramsController,
    RoomsController,
    RoomRatesController,
    OfflineInventoryController,
  ],
  providers: [
    AshramsService,
    AshramSlugService,
    OfflineInventoryService,
    RoomSummaryService,
    RoomRatesService,
  ],
  exports: [
    MongooseModule,
    AshramsService,
    AshramSlugService,
    OfflineInventoryService,
    RoomSummaryService,
    RoomRatesService,
  ],
})
export class AshramsModule {}
