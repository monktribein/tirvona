import { Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { InAppNotificationService } from "../../notifications/application/in-app-notification.service";

/**
 * HR notifications go through the existing in-app channel (inbox row, live socket event and,
 * when FCM is configured, a push). That service never throws, so a failed notification never
 * undoes the task change that raised it.
 *
 * Duplicates are prevented where the notification is raised, not here: every task action is a
 * conditional status change (a retried request finds the status already changed and fails
 * before notifying), task creation is idempotent, and the deadline reminders are claimed with
 * a one-time flag on the task.
 */
@Injectable()
export class HrNotificationService {
  constructor(
    @InjectModel("HrEmployee") private readonly employees: Model<any>,
    private readonly inApp: InAppNotificationService,
  ) {}

  /** Login ids for the given employees (employees without a linked login get nothing). */
  async userIdsOf(employeeIds: unknown[]): Promise<string[]> {
    const ids = [...new Set(employeeIds.filter(Boolean).map(String))];
    if (!ids.length) return [];
    const rows = await this.employees.find({ _id: { $in: ids }, status: "active" }).select("userId").lean();
    return rows.map((r: any) => r.userId).filter(Boolean).map(String);
  }

  /** The reporting manager's login id for an employee, if there is one. */
  async managerUserIdOf(employeeId: unknown): Promise<string | null> {
    if (!employeeId) return null;
    const employee = await this.employees.findById(employeeId).select("reportingManagerId").lean();
    if (!employee?.reportingManagerId) return null;
    const [userId] = await this.userIdsOf([employee.reportingManagerId]);
    return userId ?? null;
  }

  async send(userIds: Array<string | null | undefined>, title: string, body: string, deepLink: string, kind: string) {
    const recipients = [...new Set(userIds.filter((id): id is string => !!id))];
    if (!recipients.length) return;
    await this.inApp.notifyUsers(recipients, { title, body, deepLink, kind });
  }
}
