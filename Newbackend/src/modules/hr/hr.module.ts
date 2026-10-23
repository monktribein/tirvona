import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { AuditLogSchema } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UserSchema } from "../users/infrastructure/persistence/user.schema";
import {
  HrAttendanceCorrectionSchema,
  HrAttendanceSchema,
  HrDepartmentSchema,
  HrDesignationSchema,
  HrEmployeeSchema,
  HrLeaveSchema,
  HrOfficeSchema,
  HrSettingsSchema,
  HrTaskEventSchema,
  HrTaskSchema,
} from "./infrastructure/persistence/hr.schemas";
import { HrAccessService } from "./application/hr-access.service";
import { HrAuditService } from "./application/hr-audit.service";
import { HrOrganisationService } from "./application/hr-organisation.service";
import { HrEmployeesService } from "./application/hr-employees.service";
import { HrNotificationService } from "./application/hr-notification.service";
import { HrTasksService } from "./application/hr-tasks.service";
import { HrAttendanceService } from "./application/hr-attendance.service";
import { HrReportsService } from "./application/hr-reports.service";
import { HrReminderService } from "./application/hr-reminder.service";
import { HrAdminController } from "./presentation/hr-admin.controller";
import { HrTasksController } from "./presentation/hr-tasks.controller";
import { HrAttendanceController } from "./presentation/hr-attendance.controller";
import { HrSelfController } from "./presentation/hr-self.controller";

/** HR Management: Tirvona's employees across its offices, their daily tasks and attendance. */
@Module({
  imports: [
    NotificationsModule,
    OrmModule.forFeature([
      { name: "HrOffice", schema: HrOfficeSchema },
      { name: "HrDepartment", schema: HrDepartmentSchema },
      { name: "HrDesignation", schema: HrDesignationSchema },
      { name: "HrEmployee", schema: HrEmployeeSchema },
      { name: "HrTask", schema: HrTaskSchema },
      { name: "HrTaskEvent", schema: HrTaskEventSchema },
      { name: "HrAttendance", schema: HrAttendanceSchema },
      { name: "HrLeave", schema: HrLeaveSchema },
      { name: "HrAttendanceCorrection", schema: HrAttendanceCorrectionSchema },
      { name: "HrSettings", schema: HrSettingsSchema },
      { name: "AuditLog", schema: AuditLogSchema },
      { name: "User", schema: UserSchema },
    ]),
  ],
  controllers: [HrAdminController, HrTasksController, HrAttendanceController, HrSelfController],
  providers: [
    HrAccessService,
    HrAuditService,
    HrOrganisationService,
    HrEmployeesService,
    HrNotificationService,
    HrTasksService,
    HrAttendanceService,
    HrReportsService,
    HrReminderService,
  ],
})
export class HrModule {}
