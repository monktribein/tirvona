import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PARKING_MODEL } from "./domain/parking.constants";
import { PARKING_REPOSITORY } from "./domain/parking.repository";
import { ParkingAccessService } from "./application/parking-access.service";
import { ParkingBookingService } from "./application/parking-booking.service";
import { ParkingDiscoveryService } from "./application/parking-discovery.service";
import { ParkingPricingService } from "./application/parking-pricing.service";
import { ParkingScanService } from "./application/parking-scan.service";
import { ParkingReportService } from "./application/parking-report.service";
import { ParkingManagementService } from "./application/parking-management.service";
import { ParkingCapabilityGuard } from "./presentation/guards/parking-capability.guard";
import { ParkingPublicController } from "./presentation/controllers/parking-public.controller";
import { ParkingBookingController } from "./presentation/controllers/parking-booking.controller";
import { ParkingScanController } from "./presentation/controllers/parking-scan.controller";
import { ParkingPartnerController } from "./presentation/controllers/parking-partner.controller";
import { ParkingAdminController } from "./presentation/controllers/parking-admin.controller";
import { MongooseParkingRepository } from "./infrastructure/persistence/mongoose-parking.repository";
import {
  ParkingPartnerSchema,
  ParkingLocationSchema,
  ParkingSlotTypeSchema,
  ParkingSlotSchema,
  ParkingVehicleTypeSchema,
  ParkingPricingSchema,
  ParkingAvailabilitySchema,
  ParkingSettingSchema,
  ParkingHolidaySchema,
  ParkingStaffSchema,
} from "./infrastructure/persistence/parking-catalogue.schemas";
import {
  ParkingBookingSchema,
  ParkingQrCodeSchema,
  ParkingScanLogSchema,
  ParkingReviewSchema,
  ParkingNotificationSchema,
} from "./infrastructure/persistence/parking-operation.schemas";
import {
  ParkingPaymentSchema,
  ParkingTransactionSchema,
  ParkingCommissionSchema,
} from "./infrastructure/persistence/parking-finance.schemas";

const schemas = [
  [PARKING_MODEL.Partner, ParkingPartnerSchema],
  [PARKING_MODEL.Location, ParkingLocationSchema],
  [PARKING_MODEL.SlotType, ParkingSlotTypeSchema],
  [PARKING_MODEL.Slot, ParkingSlotSchema],
  [PARKING_MODEL.VehicleType, ParkingVehicleTypeSchema],
  [PARKING_MODEL.Pricing, ParkingPricingSchema],
  [PARKING_MODEL.Availability, ParkingAvailabilitySchema],
  [PARKING_MODEL.Setting, ParkingSettingSchema],
  [PARKING_MODEL.Holiday, ParkingHolidaySchema],
  [PARKING_MODEL.Staff, ParkingStaffSchema],
  [PARKING_MODEL.Booking, ParkingBookingSchema],
  [PARKING_MODEL.QrCode, ParkingQrCodeSchema],
  [PARKING_MODEL.ScanLog, ParkingScanLogSchema],
  [PARKING_MODEL.Review, ParkingReviewSchema],
  [PARKING_MODEL.Notification, ParkingNotificationSchema],
  [PARKING_MODEL.Payment, ParkingPaymentSchema],
  [PARKING_MODEL.Transaction, ParkingTransactionSchema],
  [PARKING_MODEL.Commission, ParkingCommissionSchema],
].map(([name, schema]) => ({ name: name as string, schema: schema as any }));

@Module({
  imports: [MongooseModule.forFeature(schemas)],
  controllers: [
    ParkingPublicController,
    ParkingBookingController,
    ParkingScanController,
    ParkingPartnerController,
    ParkingAdminController,
  ],
  providers: [
    ParkingAccessService,
    ParkingCapabilityGuard,
    ParkingPricingService,
    ParkingDiscoveryService,
    ParkingBookingService,
    ParkingScanService,
    ParkingReportService,
    ParkingManagementService,
    { provide: PARKING_REPOSITORY, useClass: MongooseParkingRepository },
  ],
  exports: [
    MongooseModule,
    ParkingAccessService,
    ParkingCapabilityGuard,
    ParkingPricingService,
    PARKING_REPOSITORY,
  ],
})
export class ParkingModule {}
