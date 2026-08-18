import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { environment, validateEnvironment } from "./config/environment";
import { CommonModule } from "./common/common.module";
import { RolesGuard } from "./common/guards/roles.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { JwtAuthGuard } from "./modules/auth/guards/jwt-auth.guard";
import { UsersModule } from "./modules/users/users.module";
import { ParkingModule } from "./modules/parking/parking.module";
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
// Self-contained lead-capture product. Owns its own database connection and
// account table; see lead-collection.module.ts for what it deliberately
// does not share with the platform.
import { LeadCollectionModule } from "./modules/lead-collection/lead-collection.module";
// Smart Contact QR. Same arrangement as Lead Collection: own database
// connection, own audit and analytics, no exports; see smart-contact.module.ts
// for the boundary it keeps and what extracting it would take.
import { SmartContactModule } from "./modules/smart-contact/smart-contact.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [environment],
      validate: validateEnvironment,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.getOrThrow<string>("mongoUri");
        const credentialsAreInUri = /^mongodb(?:\+srv)?:\/\/[^/@]+@/i.test(uri);
        return {
          uri,
          dbName: config.get<string>("mongoDbName") || undefined,
          user: credentialsAreInUri
            ? undefined
            : config.get<string>("mongoUsername") || undefined,
          pass: credentialsAreInUri
            ? undefined
            : config.get<string>("mongoPassword") || undefined,
          autoIndex: config.get<string>("nodeEnv") !== "production",
          minPoolSize: config.get<number>("mongoMinPoolSize"),
          maxPoolSize: config.get<number>("mongoMaxPoolSize"),
          serverSelectionTimeoutMS: config.get<number>(
            "mongoServerSelectionTimeoutMs",
          ),
          socketTimeoutMS: config.get<number>("mongoSocketTimeoutMs"),
        };
      },
    }),
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
        },
      ],
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    UsersModule,
    AuthModule,
    ParkingModule,
    AshramsModule,
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
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
