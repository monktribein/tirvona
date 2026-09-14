import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { whatsappConfig } from "./config/whatsapp.config";
import { WHATSAPP_PROVIDER } from "./constants/whatsapp.constants";
import { AkNexusWhatsAppClient } from "./providers/ak-nexus/ak-nexus-whatsapp.client";
import { AkNexusWhatsAppProvider } from "./providers/ak-nexus/ak-nexus-whatsapp.provider";
import { Msg91WhatsAppClient } from "./providers/msg91/msg91-whatsapp.client";
import { Msg91WhatsAppProvider } from "./providers/msg91/msg91-whatsapp.provider";
import { MetaCloudWhatsAppClient } from "./providers/meta-cloud/meta-cloud-whatsapp.client";
import { MetaCloudWhatsAppProvider } from "./providers/meta-cloud/meta-cloud-whatsapp.provider";
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
    MetaCloudWhatsAppClient,
    MetaCloudWhatsAppProvider,
    WhatsAppProviderRouter,
    // Meta Cloud handles the approved authentication template first. Existing
    // MSG91 and AK NEXUS delivery remains available as the fallback chain.
    { provide: WHATSAPP_PROVIDER, useExisting: WhatsAppProviderRouter },
    WhatsAppTemplateService,
    WhatsAppOtpService,
    WhatsAppTransactionalNotificationService,
  ],
  exports: [WhatsAppOtpService, WhatsAppTransactionalNotificationService],
})
export class WhatsAppModule {}

