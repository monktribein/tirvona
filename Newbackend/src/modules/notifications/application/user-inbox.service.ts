import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

export interface InboxPage {
  data: any[];
  total: number;
  unreadCount: number;
}

/** The signed-in user's own `GET /notifications` feed, fanned out from
 * admin/ashram-owner campaigns by [[notifications-admin.service]]. */
@Injectable()
export class UserInboxService {
  constructor(
    @InjectModel("UserNotification") private readonly notifications: Model<any>,
  ) {}

  async fetchInbox(userId: string, page: number, limit: number): Promise<InboxPage> {
    const filter = { userId };
    const [data, total, unreadCount] = await Promise.all([
      this.notifications
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.notifications.countDocuments(filter),
      this.notifications.countDocuments({ ...filter, read: false }),
    ]);
    return { data, total, unreadCount };
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.notifications.updateOne(
      { _id: id, userId },
      { $set: { read: true, readAt: new Date() } },
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifications.updateMany(
      { userId, read: false },
      { $set: { read: true, readAt: new Date() } },
    );
  }
}
