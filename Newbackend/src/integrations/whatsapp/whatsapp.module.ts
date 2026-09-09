import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { whatsappConfig } from "./config/whatsapp.config";
import { WHATSAPP_PROVIDER } from "./constants/whatsapp.constants";
import { AkNexusWhatsAppClient } from "./providers/ak-nexus/ak-nexus-whatsapp.client";
import { AkNexusWhatsAppProvider } from "./providers/ak-nexus/ak-nexus-whatsapp.provider";
import { Msg91WhatsAppClient } from "./providers/msg91/msg91-whatsapp.client";
import { Msg91WhatsAppProvider } from "./providers/msg91/msg91-whatsapp.provider";
import { WhatsAppProviderRouter } from "./providers/whatsapp-provider.router";
import { WhatsAppOtpService } from "./services/whatsapp-otp.service";
import { WhatsAppTemplateService } from "./services/whatsapp-template.service";
import { WhatsAppTransactionalNotificationService } from "./services/whatsapp-transactional-notification.service";

@Module({
  imports: [ConfigModule.forFeature(whatsappConfig)],
  providers: [
    AkNexusWhatsAppClient,
    AkNexusWhatsAppProvider,
    Msg91WhatsAppClient,
    Msg91WhatsAppProvider,
    WhatsAppProviderRouter,
    // The router picks MSG91 first and falls back to AK NEXUS. Both providers
    // stay independently resolvable for the flows and tests that use them.
    { provide: WHATSAPP_PROVIDER, useExisting: WhatsAppProviderRouter },
    WhatsAppTemplateService,
    WhatsAppOtpService,
    WhatsAppTransactionalNotificationService,
  ],
  exports: [WhatsAppOtpService, WhatsAppTransactionalNotificationService],
})
export class WhatsAppModule {}

