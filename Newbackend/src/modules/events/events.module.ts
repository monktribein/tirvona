import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EVENT_MODEL } from "./domain/event.constants";
import { EVENT_REPOSITORY } from "./domain/event.repository";
import { EventAccessService } from "./application/event-access.service";
import { EventDiscoveryService } from "./application/event-discovery.service";
import { EventManagementService } from "./application/event-management.service";
import { EventRegistrationService } from "./application/event-registration.service";
import { EventScanService } from "./application/event-scan.service";
import { EventSettingsService } from "./application/event-settings.service";
import { EventCapabilityGuard } from "./presentation/guards/event-capability.guard";
import { EventPublicController } from "./presentation/controllers/event-public.controller";
import { EventRegistrationController } from "./presentation/controllers/event-registration.controller";
import { EventGateController } from "./presentation/controllers/event-gate.controller";
import { EventOwnerController } from "./presentation/controllers/event-owner.controller";
import { EventAdminController } from "./presentation/controllers/event-admin.controller";
import { MongooseEventRepository } from "./infrastructure/persistence/mongoose-event.repository";
import {
  EventAshramRefSchema,
  EventAvailabilitySchema,
  EventFestivalSchema,
  EventNotificationSchema,
  EventQrCodeSchema,
  EventRegistrationSchema,
  EventScanLogSchema,
  EventSettingSchema,
  EventStaffSchema,
} from "./infrastructure/persistence/event.schemas";

const schemas = [
  [EVENT_MODEL.Event, EventFestivalSchema],
  [EVENT_MODEL.Availability, EventAvailabilitySchema],
  [EVENT_MODEL.Registration, EventRegistrationSchema],
  [EVENT_MODEL.QrCode, EventQrCodeSchema],
  [EVENT_MODEL.ScanLog, EventScanLogSchema],
  [EVENT_MODEL.Notification, EventNotificationSchema],
  [EVENT_MODEL.Staff, EventStaffSchema],
  [EVENT_MODEL.Setting, EventSettingSchema],
  [EVENT_MODEL.AshramRef, EventAshramRefSchema],
].map(([name, schema]) => ({ name: name as string, schema: schema as any }));

@Module({
  imports: [MongooseModule.forFeature(schemas)],
  controllers: [
    EventPublicController,
    EventRegistrationController,
    EventGateController,
    EventOwnerController,
    EventAdminController,
  ],
  providers: [
    EventAccessService,
    EventCapabilityGuard,
    EventSettingsService,
    EventDiscoveryService,
    EventRegistrationService,
    EventScanService,
    EventManagementService,
    { provide: EVENT_REPOSITORY, useClass: MongooseEventRepository },
  ],
  exports: [
    MongooseModule,
    EventAccessService,
    EventCapabilityGuard,
    EventSettingsService,
    EVENT_REPOSITORY,
  ],
})
export class EventsModule {}
