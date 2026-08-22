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
import { LeadSupervisorController } from "./presentation/lead-supervisor.controller";
import { LeadUploadController } from "./presentation/lead-upload.controller";
import { LeadAgentGuard } from "./presentation/guards/lead-agent.guard";
import { LeadSupervisorGuard } from "./presentation/guards/lead-supervisor.guard";
import { LeadRateLimitIdentityMiddleware } from "./presentation/lead-rate-limit-identity.middleware";
import { UploadsModule } from "../uploads/uploads.module";
import { AshramsModule } from "../ashrams/ashrams.module";

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
    LeadSupervisorController,
    LeadUploadController,
  ],
  providers: [
    LeadAuthService,
    LeadUsersService,
    LeadsService,
    LeadAgentGuard,
    LeadSupervisorGuard,
    LeadRateLimitIdentityMiddleware,
  ],
})
export class LeadCollectionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(LeadRateLimitIdentityMiddleware)
      .forRoutes(
        LeadAuthController,
        LeadAgentController,
        LeadSupervisorController,
        LeadUploadController,
      );

    consumer
      .apply(json({ limit: "12mb" }))
      .forRoutes(
        "lead-collection/agent/leads",
        "lead-collection/admin/leads",
        "lead-collection/supervisor/agents",
      );
  }
}
