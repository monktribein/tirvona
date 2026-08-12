import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { json } from "express";
import { LeadAuthService } from "./application/lead-auth.service";
import { LeadUsersService } from "./application/lead-users.service";
import { LeadsService } from "./application/leads.service";
import { leadCollectionConfig } from "./config/lead-collection.config";
import { LeadDatabaseModule } from "./infrastructure/lead-database.module";
import { LeadAdminController } from "./presentation/lead-admin.controller";
import { LeadAgentController } from "./presentation/lead-agent.controller";
import { LeadAuthController } from "./presentation/lead-auth.controller";
import { LeadAgentGuard } from "./presentation/guards/lead-agent.guard";
import { LeadUploadController } from "./presentation/lead-upload.controller";
import { UploadsModule } from "../uploads/uploads.module";
import { AshramsModule } from "../ashrams/ashrams.module";

/**
 * Lead Collection — the backend for the leadTirvona field app.
 *
 * A self-contained product mounted inside the platform API for deployment
 * convenience, not for coupling:
 *
 *  - its data lives on its own Mongoose connection and its own database
 *    (`LeadDatabaseModule`), so it shares no collection with the platform;
 *  - its accounts live in `lead_users` and are unrelated to platform `users`;
 *  - its tokens carry their own issuer/audience, so neither population's
 *    tokens work on the other's routes;
 *  - it exports nothing; lead data and identities remain isolated, while its
 *    admin region catalogue reads platform ashram state/district pairs and
 *    uploads reuse the platform Cloudinary service;
 *
 * The one intentional seam is the admin console: `LeadAdminController` is
 * gated by the platform's `super_admin` role, because Tirvona staff review
 * these leads with their normal platform login.
 *
 * Its own `JwtModule` instance rather than the platform's: registering it
 * locally keeps the lead signing options out of the shared auth module.
 */
@Module({
  imports: [
    LeadDatabaseModule,
    UploadsModule,
    AshramsModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const config = leadCollectionConfig();
        return {
          secret: config.jwtSecret,
          signOptions: {
            expiresIn: config.jwtExpiresIn as never,
            issuer: config.jwtIssuer,
            audience: config.jwtAudience,
          },
        };
      },
    }),
  ],
  controllers: [
    LeadAuthController,
    LeadAgentController,
    LeadAdminController,
    LeadUploadController,
  ],
  providers: [LeadAuthService, LeadUsersService, LeadsService, LeadAgentGuard],
})
export class LeadCollectionModule implements NestModule {
  /**
   * A field agent photographs an ashram with no signal and the app posts the
   * photos as base64 data URLs, so a lead body is megabytes where a normal API
   * body is kilobytes. Express's default 100kb JSON limit would reject those
   * with a 413.
   *
   * Scoped to the lead routes rather than raised globally: every other
   * endpoint keeps the tighter limit, which is the point of having one.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(json({ limit: "12mb" }))
      .forRoutes("lead-collection/agent/leads", "lead-collection/admin/leads");
  }
}
