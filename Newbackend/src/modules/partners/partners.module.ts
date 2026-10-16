import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { OrmModule } from "../../database/orm-nest";
import { PARTNER_WEBHOOK_QUEUE } from "./domain/partner.constants";
import {
  PartnerApiKeySchema,
  PartnerSchema,
  PartnerWebhookDeliveryLogSchema,
  PartnerWebhookEventSchema,
  PartnerWebhookSchema,
} from "./infrastructure/partner.schemas";
import {
  AshramSchema,
  BookingInventorySchema,
  RoomSchema,
} from "../ashrams/infrastructure/persistence/ashram.schemas";
import { BookingSchema } from "../bookings/infrastructure/persistence/booking.schemas";
import { BookingPaymentSchema } from "../bookings/infrastructure/persistence/booking-finance.schemas";
import { PartnerCryptoService } from "./application/partner-crypto.service";
import { PartnerManagementService } from "./application/partner-management.service";
import { PartnerApiService } from "./application/partner-api.service";
import { PartnerWebhookDispatcherService } from "./application/partner-webhook-dispatcher.service";
import { PartnerWebhookWorker } from "./application/partner-webhook.worker";
import { PartnerApiKeyGuard } from "./guards/partner-api-key.guard";
import { PartnerPermissionsGuard } from "./guards/partner-permissions.guard";
import { PartnerAdminController } from "./presentation/partner-admin.controller";
import { PartnerV1Controller } from "./presentation/partner-v1.controller";

@Module({
  imports: [
    OrmModule.forFeature([
      { name: "Partner", schema: PartnerSchema },
      { name: "PartnerApiKey", schema: PartnerApiKeySchema },
      { name: "PartnerWebhook", schema: PartnerWebhookSchema },
      { name: "PartnerWebhookEvent", schema: PartnerWebhookEventSchema },
      {
        name: "PartnerWebhookDeliveryLog",
        schema: PartnerWebhookDeliveryLogSchema,
      },
      { name: "Ashram", schema: AshramSchema },
      { name: "Room", schema: RoomSchema },
      { name: "BookingInventory", schema: BookingInventorySchema },
      { name: "Booking", schema: BookingSchema },
      { name: "BookingPayment", schema: BookingPaymentSchema },
    ]),
    BullModule.registerQueue({
      name: PARTNER_WEBHOOK_QUEUE,
    }),
  ],
  controllers: [PartnerAdminController, PartnerV1Controller],
  providers: [
    PartnerCryptoService,
    PartnerManagementService,
    PartnerApiService,
    PartnerWebhookDispatcherService,
    PartnerWebhookWorker,
    PartnerApiKeyGuard,
    PartnerPermissionsGuard,
  ],
  exports: [
    PartnerManagementService,
    PartnerApiService,
    PartnerWebhookDispatcherService,
    PartnerCryptoService,
  ],
})
export class PartnersModule {}
