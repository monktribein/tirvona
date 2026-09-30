import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UploadsModule } from "../uploads/uploads.module";
import { UsersModule } from "../users/users.module";
import { SupportAttachmentService } from "./application/support-attachment.service";
import { SupportCategoryService } from "./application/support-category.service";
import { SupportDashboardService } from "./application/support-dashboard.service";
import { SupportEntityService } from "./application/support-entity.service";
import { SupportMigrationService } from "./application/support-migration.service";
import { SupportTicketService } from "./application/support-ticket.service";
import { SUPPORT_MODELS } from "./infrastructure/support.schema";
import { SupportAdminController } from "./presentation/support-admin.controller";
import { SupportController } from "./presentation/support.controller";

/**
 * Support Management (tickets, conversation, internal notes, SLA, KPIs).
 * Reuses users/auth (JWT + RolesGuard), audit_logs, the uploads service and
 * the notifications inbox/socket/FCM. See ./README.md.
 */
@Module({
  imports: [
    AuditModule,
    UsersModule,
    UploadsModule,
    NotificationsModule,
    MongooseModule.forFeature(SUPPORT_MODELS),
  ],
  controllers: [SupportController, SupportAdminController],
  providers: [
    SupportCategoryService,
    SupportEntityService,
    SupportAttachmentService,
    SupportTicketService,
    SupportDashboardService,
    SupportMigrationService,
  ],
})
export class SupportModule {}
