import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PILGRIMAGE_MODEL } from "./domain/pilgrimage.constants";
import { PilgrimageAccessService } from "./application/pilgrimage-access.service";
import { PilgrimageDiscoveryService } from "./application/pilgrimage-discovery.service";
import { PilgrimageManagementService } from "./application/pilgrimage-management.service";
import { PilgrimagePlannerService } from "./application/pilgrimage-planner.service";
import { PilgrimagePublicController } from "./presentation/controllers/pilgrimage-public.controller";
import { PilgrimageOwnerController } from "./presentation/controllers/pilgrimage-owner.controller";
import { PilgrimageAdminController } from "./presentation/controllers/pilgrimage-admin.controller";
import {
  PilgrimageAshramRefSchema,
  PilgrimageCircuitSchema,
  PilgrimageItinerarySchema,
  PilgrimageSettingSchema,
  PilgrimageStopSchema,
} from "./infrastructure/persistence/pilgrimage.schemas";

const schemas = [
  [PILGRIMAGE_MODEL.Circuit, PilgrimageCircuitSchema],
  [PILGRIMAGE_MODEL.Stop, PilgrimageStopSchema],
  [PILGRIMAGE_MODEL.Itinerary, PilgrimageItinerarySchema],
  [PILGRIMAGE_MODEL.Setting, PilgrimageSettingSchema],
  [PILGRIMAGE_MODEL.AshramRef, PilgrimageAshramRefSchema],
].map(([name, schema]) => ({ name: name as string, schema: schema as any }));

@Module({
  imports: [MongooseModule.forFeature(schemas)],
  controllers: [
    PilgrimagePublicController,
    PilgrimageOwnerController,
    PilgrimageAdminController,
  ],
  providers: [
    PilgrimageAccessService,
    PilgrimageDiscoveryService,
    PilgrimagePlannerService,
    PilgrimageManagementService,
  ],
  exports: [MongooseModule, PilgrimageAccessService, PilgrimageDiscoveryService],
})
export class PilgrimageModule {}
