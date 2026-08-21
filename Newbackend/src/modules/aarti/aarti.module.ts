import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AARTI_MODEL } from "./domain/aarti.constants";
import { AARTI_REPOSITORY } from "./domain/aarti.repository";
import { AartiAccessService } from "./application/aarti-access.service";
import { AartiBookingService } from "./application/aarti-booking.service";
import { AartiDiscoveryService } from "./application/aarti-discovery.service";
import { AartiManagementService } from "./application/aarti-management.service";
import { AartiPricingService } from "./application/aarti-pricing.service";
import { AartiReportService } from "./application/aarti-report.service";
import { AartiScanService } from "./application/aarti-scan.service";
import { AartiStreamService } from "./application/aarti-stream.service";
import { AartiCapabilityGuard } from "./presentation/guards/aarti-capability.guard";
import { AartiPublicController } from "./presentation/controllers/aarti-public.controller";
import { AartiBookingController } from "./presentation/controllers/aarti-booking.controller";
import { AartiScanController } from "./presentation/controllers/aarti-scan.controller";
import { AartiOwnerController } from "./presentation/controllers/aarti-owner.controller";
import { AartiAdminController } from "./presentation/controllers/aarti-admin.controller";
import { MongooseAartiRepository } from "./infrastructure/persistence/mongoose-aarti.repository";
import {
  AartiAshramRefSchema,
  AartiAvailabilitySchema,
  AartiHolidaySchema,
  AartiPassTypeSchema,
  AartiPricingSchema,
  AartiSessionSchema,
  AartiSettingSchema,
  AartiStaffSchema,
} from "./infrastructure/persistence/aarti-catalogue.schemas";
import {
  AartiBookingSchema,
  AartiNotificationSchema,
  AartiQrCodeSchema,
  AartiReviewSchema,
  AartiScanLogSchema,
  AartiStreamSchema,
} from "./infrastructure/persistence/aarti-operation.schemas";
import {
  AartiCommissionSchema,
  AartiPaymentSchema,
  AartiTransactionSchema,
} from "./infrastructure/persistence/aarti-finance.schemas";

const schemas = [
  [AARTI_MODEL.Session, AartiSessionSchema],
  [AARTI_MODEL.PassType, AartiPassTypeSchema],
  [AARTI_MODEL.Pricing, AartiPricingSchema],
  [AARTI_MODEL.Availability, AartiAvailabilitySchema],
  [AARTI_MODEL.Holiday, AartiHolidaySchema],
  [AARTI_MODEL.Setting, AartiSettingSchema],
  [AARTI_MODEL.Staff, AartiStaffSchema],
  [AARTI_MODEL.AshramRef, AartiAshramRefSchema],
  [AARTI_MODEL.Booking, AartiBookingSchema],
  [AARTI_MODEL.QrCode, AartiQrCodeSchema],
  [AARTI_MODEL.ScanLog, AartiScanLogSchema],
  [AARTI_MODEL.Review, AartiReviewSchema],
  [AARTI_MODEL.Notification, AartiNotificationSchema],
  [AARTI_MODEL.Stream, AartiStreamSchema],
  [AARTI_MODEL.Payment, AartiPaymentSchema],
  [AARTI_MODEL.Transaction, AartiTransactionSchema],
  [AARTI_MODEL.Commission, AartiCommissionSchema],
].map(([name, schema]) => ({ name: name as string, schema: schema as any }));

@Module({
  imports: [MongooseModule.forFeature(schemas)],
  controllers: [
    AartiPublicController,
    AartiBookingController,
    AartiScanController,
    AartiOwnerController,
    AartiAdminController,
  ],
  providers: [
    AartiAccessService,
    AartiCapabilityGuard,
    AartiPricingService,
    AartiDiscoveryService,
    AartiBookingService,
    AartiScanService,
    AartiStreamService,
    AartiReportService,
    AartiManagementService,
    { provide: AARTI_REPOSITORY, useClass: MongooseAartiRepository },
  ],
  exports: [
    MongooseModule,
    AartiAccessService,
    AartiCapabilityGuard,
    AartiPricingService,
    AARTI_REPOSITORY,
  ],
})
export class AartiModule {}
