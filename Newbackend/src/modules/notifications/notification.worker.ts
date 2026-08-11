import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import type { Model } from "mongoose";
import { Resend } from "resend";
import { ConfigService } from "@nestjs/config";
import { NotificationsGateway } from "./notifications.gateway";
export interface NotificationJob {
  domain: "booking" | "parking" | "community";
  notificationId: string;
  userId: string;
  event: string;
  title: string;
  message: string;
  channel: "in_app" | "email" | "sms" | "push" | "socket";
}
@Processor("notifications")
@Injectable()
export class NotificationWorker extends WorkerHost {
  constructor(
    @InjectModel("BookingNotification") private readonly booking: Model<any>,
    @InjectModel("ParkingNotification") private readonly parking: Model<any>,
    @InjectModel("CommunityNotification") private readonly community: Model<any>,
    @InjectModel("User") private readonly users: Model<any>,
    private readonly gateway: NotificationsGateway,
    private readonly config: ConfigService,
  ) {
    super();
  }
  async process(job: Job<NotificationJob>): Promise<void> {
    const data = job.data;
    const model =
      data.domain === "booking"
        ? this.booking
        : data.domain === "parking"
          ? this.parking
          : this.community;
    try {
      const user = await this.users
        .findById(data.userId)
        .select("email phone")
        .lean();
      let providerMessageId = "";
      if (
        data.channel === "socket" ||
        data.channel === "push" ||
        data.channel === "in_app"
      )
        this.gateway.send(data.userId, data.event, {
          id: data.notificationId,
          title: data.title,
          message: data.message,
        });
      const resendApiKey = this.config.get<string>("resendApiKey");
      const msg91AuthKey = this.config.get<string>("msg91AuthKey");
      // Every authoritative in-app lifecycle notification also receives an
      // email copy. This keeps booking, payment, parking and volunteer updates
      // consistent without requiring each domain to enqueue duplicate rows.
      if (
        (data.channel === "email" || data.channel === "in_app") &&
        resendApiKey &&
        user?.email
      ) {
        const result: any = await new Resend(resendApiKey).emails.send({
          from: this.config.getOrThrow<string>("resendFromEmail"),
          replyTo: this.config.get<string>("resendReplyTo"),
          to: user.email,
          subject: data.title,
          html: `<h2>${escapeHtml(data.title)}</h2><p>${escapeHtml(data.message)}</p>`,
        });
        providerMessageId = result.data?.id ?? "";
      }
      if (data.channel === "sms" && msg91AuthKey && user?.phone) {
        const response = await fetch("https://control.msg91.com/api/v5/flow/", {
          method: "POST",
          headers: {
            authkey: msg91AuthKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            template_id: this.config.get<string>("msg91TemplateId"),
            short_url: "0",
            recipients: [
              {
                mobiles: `${this.config.get<string>("msg91CountryCode") ?? "91"}${user.phone.replace(/\D/g, "").replace(/^91/, "")}`,
                message: data.message,
              },
            ],
          }),
        });
        if (!response.ok) throw new Error(`MSG91 returned ${response.status}`);
        providerMessageId = await response.text();
      }
      await model.updateOne(
        { _id: data.notificationId },
        { $set: { status: "sent", sentAt: new Date(), providerMessageId } },
      );
    } catch (error) {
      await model.updateOne(
        { _id: data.notificationId },
        {
          $set: {
            status: "failed",
            deliveryError:
              error instanceof Error
                ? error.message
                : "Notification delivery failed",
          },
        },
      );
      throw error;
    }
  }
}
const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ]!,
  );
