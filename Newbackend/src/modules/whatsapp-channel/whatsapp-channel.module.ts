import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { whatsappConfig } from "../../integrations/whatsapp/config/whatsapp.config";
import { MetaCloudWhatsAppClient } from "../../integrations/whatsapp/providers/meta-cloud/meta-cloud-whatsapp.client";
import { AshramsModule } from "../ashrams/ashrams.module";
import { RefundsModule } from "../refunds/refunds.module";
import { BookingsModule } from "../bookings/bookings.module";
import { UsersModule } from "../users/users.module";
import { ConversationService } from "./application/conversation.service";
import { WhatsAppActionsService } from "./application/whatsapp-actions.service";
import { WhatsAppIdentityService } from "./application/whatsapp-identity.service";
import { WhatsAppReplyService } from "./application/whatsapp-reply.service";
import { WhatsAppSessionStore } from "./application/whatsapp-session.store";
import { WhatsAppWebhookService } from "./application/whatsapp-webhook.service";
import {
  WHATSAPP_CHANNEL_MODEL,
  WHATSAPP_INBOUND_QUEUE,
} from "./domain/whatsapp-channel.constants";
import { WhatsAppCustomerSchema } from "./infrastructure/persistence/whatsapp-customer.schema";
import { WhatsAppInboundEventSchema } from "./infrastructure/persistence/whatsapp-inbound-event.schema";
import { WhatsAppWebhookController } from "./presentation/whatsapp-webhook.controller";
import { WhatsAppInboundWorker } from "./whatsapp-inbound.worker";

/**
 * WhatsApp as a second customer-facing frontend over the existing backend.
 *
 * Deliberately a separate module from `WhatsAppModule`, which owns outbound
 * delivery: that one is imported *by* `NotificationsModule`, so importing the
 * domain modules into it would make a cycle. Keeping the conversation here
 * lets it depend on Bookings and Ashrams while the transactional pipeline
 * carries on untouched.
 *
 * Nothing in this module implements a business rule. Availability, pricing,
 * booking creation, payment verification, cancellation and refunds all belong
 * to the services the website already calls; this module only understands
 * what a guest asked for and phrases the answer.
 */
@Module({
  imports: [
    ConfigModule.forFeature(whatsappConfig),
    BookingsModule,
    AshramsModule,
    RefundsModule,
    // Read-only access to the "User" model, so a WhatsApp sender can be
    // matched against an existing registered account by phone number. This
    // module never writes to it — see WhatsAppIdentityService.findWebsiteAccount.
    UsersModule,
    MongooseModule.forFeature([
      {
        name: WHATSAPP_CHANNEL_MODEL.Customer,
        schema: WhatsAppCustomerSchema,
      },
      {
        name: WHATSAPP_CHANNEL_MODEL.InboundEvent,
        schema: WhatsAppInboundEventSchema,
      },
    ]),
    BullModule.registerQueue({ name: WHATSAPP_INBOUND_QUEUE }),
  ],
  controllers: [WhatsAppWebhookController],
  providers: [
    // The Meta client is constructed here rather than imported, because
    // WhatsAppModule exports only its OTP and transactional services and
    // widening those exports would give the conversation layer reach into the
    // transactional path it must not have.
    MetaCloudWhatsAppClient,
    WhatsAppIdentityService,
    WhatsAppSessionStore,
    WhatsAppReplyService,
    WhatsAppActionsService,
    ConversationService,
    WhatsAppWebhookService,
    WhatsAppInboundWorker,
  ],
  exports: [WhatsAppIdentityService, MongooseModule],
})
export class WhatsAppChannelModule {}
