import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { FcmService } from "../fcm/fcm.service";
import { NotificationsGateway } from "../notifications.gateway";

export interface InAppNotificationInput {
  title: string;
  body: string;
  deepLink?: string;
  /** Short machine tag, e.g. "support.reply", so clients can group or style it. */
  kind?: string;
}

/**
 * One notification to specific users through the existing channels: the
 * inbox row behind `GET /notifications`, a live socket event, and an FCM
 * push to their devices. Delivery failures are logged and never thrown, so a
 * notification can never break the business action that raised it.
 */
@Injectable()
export class InAppNotificationService {
  private readonly logger = new Logger(InAppNotificationService.name);

  constructor(
    @InjectModel("UserNotification") private readonly notifications: Model<any>,
    private readonly gateway: NotificationsGateway,
    private readonly fcm: FcmService,
  ) {}

  async notifyUsers(userIds: string[], input: InAppNotificationInput): Promise<void> {
    const recipients = [...new Set(userIds.filter(Boolean).map(String))];
    if (!recipients.length) return;
    try {
      const rows = await this.notifications.insertMany(
        recipients.map((userId) => ({
          userId,
          title: input.title.slice(0, 200),
          body: input.body.slice(0, 500),
          deepLink: input.deepLink,
          kind: input.kind,
        })),
      );
      for (const row of rows as any[])
        this.gateway.send(String(row.userId), "notification", {
          _id: String(row._id),
          title: row.title,
          body: row.body,
          deepLink: row.deepLink,
          kind: row.kind,
          createdAt: row.createdAt,
        });
    } catch (error) {
      this.logger.error(`In-app notification failed: ${(error as Error).message}`);
    }
    if (!this.fcm.isConfigured) return;
    for (const userId of recipients)
      await this.fcm
        .sendToUser(userId, {
          title: input.title,
          body: input.body,
          data: input.deepLink ? { deepLink: input.deepLink } : undefined,
        })
        .catch((error: Error) => this.logger.warn(`Push failed for ${userId}: ${error.message}`));
  }
}
