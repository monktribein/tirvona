import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import type { Model } from "mongoose";
import { Resend } from "resend";
import { ConfigService } from "@nestjs/config";
import { NotificationsGateway } from "./notifications.gateway";
import { PARKING_MODEL } from "../parking/domain/parking.constants";
import { WhatsAppTransactionalNotificationService } from "../../integrations/whatsapp/services/whatsapp-transactional-notification.service";
export interface NotificationJob {
  domain: "booking" | "parking" | "community";
  notificationId: string;
  userId: string;
  event: string;
  title: string;
  message: string;
  channel: "in_app" | "email" | "sms" | "push" | "socket";
  bookingId?: string;
  phone?: string;
  correlationId?: string;
  deliveryScope?: "all" | "whatsapp_only";
}
@Processor("notifications")
@Injectable()
export class NotificationWorker
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(
    @InjectModel("BookingNotification") private readonly booking: Model<any>,
    @InjectModel("ParkingNotification") private readonly parking: Model<any>,
    @InjectModel("CommunityNotification") private readonly community: Model<any>,
    @InjectModel("User") private readonly users: Model<any>,
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel(PARKING_MODEL.Booking)
    private readonly parkingBookings: Model<any>,
    @InjectModel(PARKING_MODEL.QrCode)
    private readonly parkingQrCodes: Model<any>,
    private readonly gateway: NotificationsGateway,
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppTransactionalNotificationService,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    this.logger.log(
      JSON.stringify({
        event: "notification.worker_initialized",
        queue: "notifications",
        running: this.worker.isRunning(),
      }),
    );
    this.worker.on("ready", () =>
      this.logger.log(
        JSON.stringify({
          event: "notification.worker_ready",
          queue: "notifications",
        }),
      ),
    );
    this.worker.on("error", (error) =>
      this.logger.error(
        JSON.stringify({
          event: "notification.worker_error",
          queue: "notifications",
          errorType: error.name,
        }),
      ),
    );
  }
  async process(job: Job<NotificationJob>): Promise<void> {
    const data = job.data;
    const model =
      data.domain === "booking"
        ? this.booking
        : data.domain === "parking"
          ? this.parking
          : this.community;
    const correlationId =
      data.correlationId || String(job.id || data.notificationId);
    const whatsappOnly = data.deliveryScope === "whatsapp_only";
    this.logger.log(
      JSON.stringify({
        event: "notification.outbox_consumed",
        domain: data.domain,
        eventType: data.event,
        notificationId: data.notificationId,
        bookingId: data.bookingId,
        correlationId,
        queueJobId: job.id,
      }),
    );
    let whatsappAttempted = false;
    let whatsappAccepted = false;
    try {
      const outboxRow = await model
        .findById(data.notificationId)
        .select("meta recipientPhone bookingId")
        .lean();
      const user = await this.users
        .findById(data.userId)
        .select("name email phone")
        .lean();
      let providerMessageId = "";
      let whatsappProviderMessageId = "";
      let deferredDeliveryError: unknown;
      if (
        !whatsappOnly &&
        ["socket", "push", "in_app"].includes(data.channel)
      ) {
        try {
          this.gateway.send(data.userId, data.event, {
            id: data.notificationId,
            title: data.title,
            message: data.message,
          });
        } catch (error) {
          deferredDeliveryError = error;
          this.logChannelFailure(data, correlationId, "socket");
        }
      }
      const resendApiKey = this.config.get<string>("resendApiKey");
      const msg91AuthKey = this.config.get<string>("msg91AuthKey");
      if (
        !whatsappOnly &&
        (data.channel === "email" || data.channel === "in_app") &&
        resendApiKey &&
        user?.email
      ) {
        try {
          const result: any = await new Resend(resendApiKey).emails.send({
            from: this.config.getOrThrow<string>("resendFromEmail"),
            replyTo: this.config.get<string>("resendReplyTo"),
            to: user.email,
            subject: data.title,
            html: `<h2>${escapeHtml(data.title)}</h2><p>${escapeHtml(data.message)}</p>`,
          });
          providerMessageId = result.data?.id ?? "";
        } catch (error) {
          deferredDeliveryError ??= error;
          this.logChannelFailure(data, correlationId, "email");
        }
      }
      if (
        !whatsappOnly &&
        data.channel === "sms" &&
        msg91AuthKey &&
        user?.phone
      ) {
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
      if (!(data.channel === "in_app" || whatsappOnly)) {
        await model.updateOne(
          { _id: data.notificationId },
          {
            $set: {
              "meta.whatsappStatus": "skipped",
              "meta.whatsappReason": `channel_not_eligible:${data.channel}`,
            },
          },
        );
        this.logger.warn(
          JSON.stringify({
            event: "notification.whatsapp_skipped",
            eventType: data.event,
            notificationId: data.notificationId,
            correlationId,
            reason: "channel_not_eligible",
            channel: data.channel,
          }),
        );
      }
      if (data.channel === "in_app" || whatsappOnly) {
        const whatsappStatus = outboxRow?.meta?.whatsappStatus;
        const phone = data.phone || outboxRow?.recipientPhone || user?.phone;
        if (whatsappStatus === "sent") {
          this.logger.log(
            JSON.stringify({
              event: "notification.whatsapp_duplicate_skipped",
              eventType: data.event,
              notificationId: data.notificationId,
              correlationId,
            }),
          );
        } else if (!phone) {
          await model.updateOne(
            { _id: data.notificationId },
            {
              $set: {
                "meta.whatsappStatus": "skipped",
                "meta.whatsappReason": "recipient_phone_missing",
              },
            },
          );
          this.logger.warn(
            JSON.stringify({
              event: "notification.whatsapp_skipped",
              eventType: data.event,
              notificationId: data.notificationId,
              correlationId,
              reason: "recipient_phone_missing",
            }),
          );
        } else {
          whatsappAttempted = true;
          this.logger.log(
            JSON.stringify({
              event: "notification.whatsapp_attempt",
              eventType: data.event,
              notificationId: data.notificationId,
              bookingId: data.bookingId,
              correlationId,
            }),
          );
          const bookingRef = data.bookingId || outboxRow?.bookingId;
          const [stay, parkingPass] = await Promise.all([
            data.domain === "booking"
              ? this.stayContext(bookingRef)
              : Promise.resolve(null),
            data.domain === "parking"
              ? this.parkingContext(bookingRef)
              : Promise.resolve(null),
          ]);

          const whatsapp = await this.whatsapp.sendOutboxEvent({
            domain: data.domain,
            notificationId: data.notificationId,
            event: data.event,
            phone,
            recipientName: user?.name,
            title: data.title,
            message: data.message,
            reference: stay?.reference ?? parkingPass?.reference,
            stay: stay ?? undefined,
            parking: parkingPass ?? undefined,
            correlationId,
          });
          if (whatsapp?.status === "accepted") {
            whatsappAccepted = true;
            whatsappProviderMessageId = whatsapp.providerMessageId ?? "";
            await model.updateOne(
              {
                _id: data.notificationId,
                "meta.whatsappStatus": { $ne: "sent" },
              },
              {
                $set: {
                  "meta.whatsappStatus": "sent",
                  "meta.whatsappDeliveredAt": new Date(),
                  "meta.whatsappIdempotencyKey": `${data.domain}:${data.notificationId}:whatsapp`,
                  ...(whatsappProviderMessageId
                    ? {
                        "meta.whatsappProviderMessageId":
                          whatsappProviderMessageId,
                      }
                    : {}),
                },
              },
            );
          } else {
            await model.updateOne(
              { _id: data.notificationId },
              {
                $set: {
                  "meta.whatsappStatus": "skipped",
                  "meta.whatsappReason": whatsapp
                    ? whatsapp.reason || "provider_skipped"
                    : "event_not_handled",
                },
              },
            );
          }
          this.logger.log(
            JSON.stringify({
              event: "notification.whatsapp_result",
              eventType: data.event,
              notificationId: data.notificationId,
              correlationId,
              providerStatus: whatsapp?.status || "not_handled",
              reason: whatsapp?.reason,
            }),
          );
        }
      }
      if (deferredDeliveryError) throw deferredDeliveryError;
      await model.updateOne(
        { _id: data.notificationId },
        {
          $set: {
            status: "sent",
            sentAt: new Date(),
            providerMessageId,
            ...(whatsappProviderMessageId
              ? { "meta.whatsappProviderMessageId": whatsappProviderMessageId }
              : {}),
          },
        },
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
            ...(whatsappAttempted && !whatsappAccepted
              ? {
                  "meta.whatsappStatus": "failed",
                  "meta.whatsappFailedAt": new Date(),
                }
              : {}),
          },
        },
      );
      if (whatsappAttempted && !whatsappAccepted)
        this.logger.error(
          JSON.stringify({
            event: "notification.whatsapp_failed",
            eventType: data.event,
            notificationId: data.notificationId,
            bookingId: data.bookingId,
            correlationId,
            providerStatus: "error",
            bookingUnaffected: true,
          }),
        );
      throw error;
    }
  }


  /**
   * Loads the stay behind a booking notification so WhatsApp can show the
   * guest name, ashram, dates and check-in code instead of a bare sentence.
   */
  private async stayContext(bookingId: unknown): Promise<any | null> {
    if (!bookingId) return null;
    const booking: any = await this.bookings
      .findById(String(bookingId))
      .select(
        "+checkInCode bookingId checkInDate checkOutDate guestsCount roomsBookedCount pricing walkInGuest",
      )
      .populate("ashramId", "name address")
      .populate("roomId", "name type")
      .populate("customerId", "name")
      .lean();
    if (!booking) return null;
    return {
      guestName: booking.walkInGuest?.name || booking.customerId?.name,
      reference: booking.bookingId,
      ashramName: booking.ashramId?.name,
      ashramCity: booking.ashramId?.address?.city,
      ashramState: booking.ashramId?.address?.state,
      roomName: booking.roomId?.name,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      guestsCount: booking.guestsCount,
      roomsCount: booking.roomsBookedCount,
      checkInCode: booking.checkInCode,
      amountPaid: booking.pricing?.amountPaid,
      totalAmount: booking.pricing?.totalAmount,
      currency: booking.pricing?.currency,
    };
  }

  /**
   * Loads the parking pass so the message can carry the gate code and a link
   * to the QR. The provider sends text only, so the pass is linked, not
   * attached.
   */
  private async parkingContext(bookingId: unknown): Promise<any | null> {
    if (!bookingId) return null;
    const booking: any = await this.parkingBookings
      .findById(String(bookingId))
      .select(
        "bookingReference vehicleNumber vehicleType entryAt exitAt pricing amountPaid",
      )
      .populate("locationId", "name address")
      .lean();
    if (!booking) return null;
    const qr: any = await this.parkingQrCodes
      .findOne({ bookingId: booking._id })
      .sort({ version: -1 })
      .select("displayCode")
      .lean();
    const siteUrl =
      this.config.get<string>("frontendUrl") || "https://www.tirvona.com";
    return {
      reference: booking.bookingReference,
      locationName: booking.locationId?.name,
      locationCity: booking.locationId?.address?.city,
      vehicleNumber: booking.vehicleNumber,
      vehicleType: booking.vehicleType,
      entryAt: booking.entryAt,
      exitAt: booking.exitAt,
      displayCode: qr?.displayCode,
      passUrl: booking.bookingReference
        ? `${siteUrl}/parking/booking/${booking.bookingReference}`
        : undefined,
      amountPaid: booking.pricing?.amountPaid ?? booking.amountPaid,
      currency: booking.pricing?.currency,
    };
  }

  private logChannelFailure(
    data: NotificationJob,
    correlationId: string,
    channel: "socket" | "email",
  ): void {
    this.logger.error(
      JSON.stringify({
        event: "notification.channel_failed",
        channel,
        eventType: data.event,
        notificationId: data.notificationId,
        bookingId: data.bookingId,
        correlationId,
      }),
    );
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
