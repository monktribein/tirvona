import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OrmModule } from "../../database/orm-nest";
import { AuditModule } from "../audit/audit.module";
import { HrLocationModule } from "../hr/hr-location.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { payoutConfig } from "../payouts/config/payout.config";
import { BankAccountCrypto } from "../payouts/infrastructure/bank-account.crypto";
import { WalletModule } from "../wallet/wallet.module";
import { WhatsAppModule } from "../../integrations/whatsapp/whatsapp.module";
import { YatraBookingService } from "./application/yatra-booking.service";
import { YatraCatalogService } from "./application/yatra-catalog.service";
import { RAZORPAY_RECON_CLIENT, RazorpayReconHttpClient, YatraFinanceService } from "./application/yatra-finance.service";
import { YatraOpsService } from "./application/yatra-ops.service";
import { YatraRideService } from "./application/yatra-ride.service";
import { YATRA_P5_SCHEMAS } from "./infrastructure/yatra-p5.schemas";
import {
  YatraFinanceController,
  YatraOperatorPayoutController,
  YatraOpsController,
  YatraRideAdminController,
  YatraRideCustomerController,
  YatraRidePartnerController,
} from "./presentation/yatra-p5.controller";
import { YatraInsightsService, YatraMaintenanceService, YatraWebhookService } from "./application/yatra-insights.service";
import { YatraInventoryService } from "./application/yatra-inventory.service";
import { YatraJourneyService } from "./application/yatra-journey.service";
import { YatraOperatorService } from "./application/yatra-operator.service";
import {
  YatraAccessService,
  YatraAuditService,
  YatraDocumentStorage,
  YatraGatewayService,
  YatraNotifier,
  YatraSettingsService,
} from "./application/yatra-support.service";
import { YATRA_REF_SCHEMAS } from "./infrastructure/yatra-ref.schemas";
import { YATRA_SCHEMAS } from "./infrastructure/yatra.schemas";
import { YatraAdminController } from "./presentation/yatra-admin.controller";
import { YatraOperatorController } from "./presentation/yatra-operator.controller";
import { YatraCustomerController, YatraPublicController } from "./presentation/yatra-public.controller";
import { YatraEnabledGuard } from "./presentation/yatra-http";
import { YatraRatingService } from "./application/yatra-rating.service";
import { YatraCharterService } from "./application/yatra-charter.service";
import { YatraTripService } from "./application/yatra-trip.service";
import { UserSchema } from "../users/infrastructure/persistence/user.schema";

/**
 * Tirvona Yatra: organisers, tours, departures, the central seat inventory,
 * bookings, journeys and add-on requests. Switched off unless
 * YATRA_ENABLED=true. Money moves only through Tirvona's existing Razorpay
 * account (via the shared webhook) and the existing pilgrim wallet.
 */
@Module({
  imports: [
    ConfigModule.forFeature(payoutConfig),
    OrmModule.forFeature([...YATRA_SCHEMAS, ...YATRA_P5_SCHEMAS, ...YATRA_REF_SCHEMAS].map(([name, schema]): { name: string; schema: any } => ({ name, schema: schema as any })).concat([{ name: "User", schema: UserSchema as any }])),
    AuditModule,
    HrLocationModule,
    NotificationsModule,
    WhatsAppModule,
    WalletModule,
  ],
  controllers: [
    YatraPublicController,
    YatraCustomerController,
    YatraOperatorController,
    YatraOperatorPayoutController,
    YatraAdminController,
    YatraRideAdminController,
    YatraRidePartnerController,
    YatraRideCustomerController,
    YatraFinanceController,
    YatraOpsController,
  ],
  providers: [
    YatraEnabledGuard,
    YatraAccessService,
    YatraAuditService,
    YatraSettingsService,
    YatraGatewayService,
    YatraNotifier,
    YatraDocumentStorage,
    BankAccountCrypto,
    { provide: RAZORPAY_RECON_CLIENT, useClass: RazorpayReconHttpClient },
    YatraFinanceService,
    YatraRideService,
    YatraOpsService,
    YatraOperatorService,
    YatraCatalogService,
    YatraInventoryService,
    YatraBookingService,
    YatraJourneyService,
    YatraRatingService,
    YatraTripService,
    YatraCharterService,
    YatraInsightsService,
    YatraWebhookService,
    YatraMaintenanceService,
  ],
  exports: [YatraWebhookService],
})
export class YatraModule {}
