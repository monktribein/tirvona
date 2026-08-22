import { Module } from "@nestjs/common";
import { QrService } from "./application/qr.service";
import { ContactCardService } from "./application/contact-card.service";
import { IdCardService } from "./application/id-card.service";
import { SmartContactAnalyticsService } from "./application/smart-contact-analytics.service";
import { SmartContactAuditService } from "./application/smart-contact-audit.service";
import { SmartContactProfilesService } from "./application/smart-contact-profiles.service";
import { SmartContactQrCodesService } from "./application/smart-contact-qr-codes.service";
import { VcardService } from "./application/vcard.service";
import { SmartContactDatabaseModule } from "./infrastructure/smart-contact-database.module";
import { SmartContactAdminController } from "./presentation/smart-contact-admin.controller";
import { SmartContactPublicController } from "./presentation/smart-contact-public.controller";

@Module({
  imports: [SmartContactDatabaseModule],
  controllers: [SmartContactPublicController, SmartContactAdminController],
  providers: [
    SmartContactProfilesService,
    SmartContactQrCodesService,
    SmartContactAnalyticsService,
    SmartContactAuditService,
    VcardService,
    QrService,
    ContactCardService,
    IdCardService,
  ],
})
export class SmartContactModule {}
