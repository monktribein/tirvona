import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { environment, validateEnvironment } from "./config/environment";
import { DRIVER_URI, MAIN_DATABASE } from "./database/database";
import { CommonModule } from "./common/common.module";
import { RolesGuard } from "./common/guards/roles.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { JwtAuthGuard } from "./modules/auth/guards/jwt-auth.guard";
import { UsersModule } from "./modules/users/users.module";
import { ParkingModule } from "./modules/parking/parking.module";
import { UrlsModule } from "./modules/urls/urls.module";
import { LegacyUrlModule } from "./modules/urls/legacy-url.module";
import { AshramsModule } from "./modules/ashrams/ashrams.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { HousekeepingModule } from "./modules/housekeeping/housekeeping.module";
import { SupportModule } from "./modules/support/support.module";
import { PlatformSettingsModule } from "./modules/platform-settings/platform-settings.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { VerificationModule } from "./modules/verification/verification.module";
import { ContentModule } from "./modules/content/content.module";
import { CommerceModule } from "./modules/commerce/commerce.module";
import { CommunityModule } from "./modules/community/community.module";
import { GovernanceModule } from "./modules/governance/governance.module";
import { RefundsModule } from "./modules/refunds/refunds.module";
import { SearchModule } from "./modules/search/search.module";
import { TemplesModule } from "./modules/temples/temples.module";
// Self-contained lead-capture product. Owns its own database connection and
// account table; see lead-collection.module.ts for what it deliberately
// does not share with the platform.
import { LeadCollectionModule } from "./modules/lead-collection/lead-collection.module";
import { SmartContactModule } from "./modules/smart-contact/smart-contact.module";
import { PayoutsModule } from "./modules/payouts/payouts.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { AartiModule } from "./modules/aarti/aarti.module";
import { EventsModule } from "./modules/events/events.module";
import { PilgrimageModule } from "./modules/pilgrimage/pilgrimage.module";
import { DayStayModule } from "./modules/day-stay/day-stay.module";
import { MarketplaceModule } from "./modules/marketplace/marketplace.module";
// WhatsApp as a second customer frontend over the existing services. Inbound
// conversation only; outbound transactional delivery stays in WhatsAppModule.
import { WhatsAppChannelModule } from "./modules/whatsapp-channel/whatsapp-channel.module";
import { WalletApiModule } from "./modules/wallet/wallet-api.module";
import {
  hybridRateLimitTracker,
  ipRateLimitTracker,
} from "./common/throttling/rate-limit-trackers";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [environment],
      validate: validateEnvironment,
    }),
    // Supabase Postgres via the storage driver (src/database); the URI is a
    // placeholder, the pool comes from SUPABASE_DB_URL.
    MongooseModule.forRoot(DRIVER_URI, { dbName: MAIN_DATABASE }),
    ...(process.env.NODE_ENV === "production"
      ? [
          LoggerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              pinoHttp: {
                level: config.get<string>("logLevel") ?? "info",
                redact: [
                  "req.headers.authorization",
                  "req.headers.cookie",
                  "req.body.password",
                  "req.body.newPassword",
                  "req.body.adminPassword",
                  "req.body.otp",
                  "req.body.token",
                  "req.body.googleToken",
                  "req.body.credential",
                  "req.body.govtIdNumber",
                  "req.body.razorpay_signature",
                  "req.body.accountNumber",
                  "req.body.confirmAccountNumber",
                  "req.query.token",
                  "res.headers.set-cookie",
                ],
              },
            }),
          }),
        ]
      : []),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: "default",
          ttl: config.get<number>("throttleTtlMs") ?? 60_000,
          limit: config.get<number>("throttleLimit") ?? 120,
          getTracker: hybridRateLimitTracker,
        },
        {
          name: "ipAbuse",
          ttl: config.get<number>("throttleIpAbuseTtlMs") ?? 60_000,
          limit: config.get<number>("throttleIpAbuseLimit") ?? 30_000,
          getTracker: ipRateLimitTracker,
        },
      ],
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    UsersModule,
    AuthModule,
    ParkingModule,
    UrlsModule,
    LegacyUrlModule,
    AshramsModule,
    TemplesModule,
    BookingsModule,
    HousekeepingModule,
    SupportModule,
    PlatformSettingsModule,
    UploadsModule,
    AnalyticsModule,
    NotificationsModule,
    VerificationModule,
    ContentModule,
    CommerceModule,
    CommunityModule,
    GovernanceModule,
    RefundsModule,
    SearchModule,
    LeadCollectionModule,
    SmartContactModule,
    PayoutsModule,
    PaymentsModule,
    AartiModule,
    EventsModule,
    PilgrimageModule,
    DayStayModule,
    MarketplaceModule,
    WhatsAppChannelModule,
    WalletApiModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
