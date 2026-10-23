import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { HrTasksService } from "./hr-tasks.service";

/**
 * Sends "due soon" and "overdue" task reminders every five minutes. Off unless
 * HR_REMINDERS_ENABLED=true, because it notifies real employees. Each reminder is claimed on
 * the task before it is sent, so several instances running this at once cannot send it twice.
 */
@Injectable()
export class HrReminderService {
  private readonly logger = new Logger(HrReminderService.name);
  private running = false;

  constructor(private readonly tasks: HrTasksService) {}

  @Interval(300_000)
  async sweep(): Promise<void> {
    if (process.env.HR_REMINDERS_ENABLED !== "true" || this.running) return;
    this.running = true;
    try {
      await this.tasks.sweepReminders();
    } catch (error) {
      this.logger.error(`HR reminder sweep failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
