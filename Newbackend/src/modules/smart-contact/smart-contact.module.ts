import { Module } from "@nestjs/common";
import { QrService } from "./application/qr.service";
import { ContactCardService } from "./application/contact-card.service";
import { SmartContactAnalyticsService } from "./application/smart-contact-analytics.service";
import { SmartContactAuditService } from "./application/smart-contact-audit.service";
import { SmartContactProfilesService } from "./application/smart-contact-profiles.service";
import { SmartContactQrCodesService } from "./application/smart-contact-qr-codes.service";
import { VcardService } from "./application/vcard.service";
import { SmartContactDatabaseModule } from "./infrastructure/smart-contact-database.module";
import { SmartContactAdminController } from "./presentation/smart-contact-admin.controller";
import { SmartContactPublicController } from "./presentation/smart-contact-public.controller";

/**
 * Smart Contact QR — the Tirvona-branded implementation of what spec §43 calls
 * the NEP Smart Identity & Contact Engine.
 *
 * A self-contained product mounted inside the platform API for deployment
 * convenience, not for coupling:
 *
 *  - its data lives on its own Mongoose connection and its own database
 *    (`SmartContactDatabaseModule`), so it shares no collection with the
 *    platform and none of its models can be resolved from outside;
 *  - it holds no accounts of its own: admins are platform staff using their
 *    normal login, and the public surface has no identity at all;
 *  - its audit trail and analytics are local, so an extracted service carries
 *    its own history rather than leaving it behind;
 *  - it exports nothing, and imports nothing from another feature module —
 *    profile photographs arrive as URLs already produced by the platform's
 *    existing upload endpoint, which keeps this module off the file-handling
 *    path entirely.
 *
 * The one intentional seam is the console: `SmartContactAdminController` is
 * gated by the platform's `RolesGuard`, because Tirvona staff manage these
 * profiles from the same admin session they use for everything else.
 *
 * Extraction checklist, if this becomes its own service: move this folder,
 * point `SMART_CONTACT_MONGODB_URI` at its own cluster, and replace the
 * `@Roles`/`@CurrentUser` imports with the new host's equivalents. Nothing
 * else in the platform references it.
 */
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
  ],
})
export class SmartContactModule {}
