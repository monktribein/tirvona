import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { whatsappConfig } from "./config/whatsapp.config";
import { WHATSAPP_PROVIDER } from "./constants/whatsapp.constants";
import { AkNexusWhatsAppClient } from "./providers/ak-nexus/ak-nexus-whatsapp.client";
import { AkNexusWhatsAppProvider } from "./providers/ak-nexus/ak-nexus-whatsapp.provider";
import { WhatsAppOtpService } from "./services/whatsapp-otp.service";
import { WhatsAppTemplateService } from "./services/whatsapp-template.service";
import { WhatsAppTransactionalNotificationService } from "./services/whatsapp-transactional-notification.service";

@Module({
  imports: [ConfigModule.forFeature(whatsappConfig)],
  providers: [
    AkNexusWhatsAppClient,
    AkNexusWhatsAppProvider,
    { provide: WHATSAPP_PROVIDER, useExisting: AkNexusWhatsAppProvider },
    WhatsAppTemplateService,
    WhatsAppOtpService,
    WhatsAppTransactionalNotificationService,
  ],
  exports: [WhatsAppOtpService, WhatsAppTransactionalNotificationService],
})
export class WhatsAppModule {}

