import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { InjectModel } from "@nestjs/mongoose";
import { Interval } from "@nestjs/schedule";
import type { Queue } from "bullmq";
import type { Model } from "mongoose";
import type { NotificationJob } from "./notification.worker";
@Injectable()
export class NotificationOutboxService {
  constructor(
    @InjectQueue("notifications")
    private readonly queue: Queue<NotificationJob>,
    @InjectModel("BookingNotification") private readonly booking: Model<any>,
    @InjectModel("ParkingNotification") private readonly parking: Model<any>,
    @InjectModel("CommunityNotification") private readonly community: Model<any>,
  ) {}
  @Interval(15_000) async dispatch(): Promise<void> {
    await this.enqueue("booking", this.booking);
    await this.enqueue("parking", this.parking);
    await this.enqueue("community", this.community);
  }
  private async enqueue(
    domain: "booking" | "parking" | "community",
    model: Model<any>,
  ): Promise<void> {
    const rows = await model
      .find({ status: "queued", "meta.queueJobId": { $exists: false } })
      .limit(100)
      .lean();
    for (const row of rows as any[]) {
      const jobId = `${domain}-${row._id}`;
      await this.queue.add(
        "deliver",
        {
          domain,
          notificationId: String(row._id),
          userId: String(row.userId),
          event: row.event,
          title: row.title,
          message: row.message,
          channel: row.channel,
        },
        {
          jobId,
          attempts: 5,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
      await model.updateOne(
        {
          _id: row._id,
          status: "queued",
          "meta.queueJobId": { $exists: false },
        },
        { $set: { "meta.queueJobId": jobId } },
      );
    }
  }
}
