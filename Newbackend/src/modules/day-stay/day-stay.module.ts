import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
import { CommonModule } from "../../common/common.module";
import { DayStayProductSchema } from "./infrastructure/persistence/day-stay-product.schemas";
import { AshramSchema, RoomSchema } from "../ashrams/infrastructure/persistence/ashram.schemas";
import { BookingSchema, BookingStatusHistorySchema } from "../bookings/infrastructure/persistence/booking.schemas";
import { BookingNotificationSchema } from "../bookings/infrastructure/persistence/booking-support.schemas";
import { DayStayProductsService } from "./application/day-stay-products.service";
import { DayStayInventoryService } from "./application/day-stay-inventory.service";
import { DayStayBookingService } from "./application/day-stay-booking.service";
import { DayStayVendorService } from "./application/day-stay-vendor.service";
import { DayStayController } from "./presentation/day-stay.controller";

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    MongooseModule.forFeature([
      { name: "DayStayProduct", schema: DayStayProductSchema },
      { name: "Ashram", schema: AshramSchema },
      { name: "Room", schema: RoomSchema },
      { name: "Booking", schema: BookingSchema },
      { name: "BookingStatusHistory", schema: BookingStatusHistorySchema },
      { name: "BookingNotification", schema: BookingNotificationSchema },
    ]),
  ],
  controllers: [DayStayController],
  providers: [
    DayStayProductsService,
    DayStayInventoryService,
    DayStayBookingService,
    DayStayVendorService,
  ],
  exports: [
    DayStayProductsService,
    DayStayInventoryService,
    DayStayBookingService,
    DayStayVendorService,
  ],
})
export class DayStayModule {}
