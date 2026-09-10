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
import QRCode from "qrcode";
import { ConfigService } from "@nestjs/config";
import { NotificationsGateway } from "./notifications.gateway";
import {
  renderEmail,
  renderEmailText,
  type EmailDetailRow,
  type EmailTemplateInput,
} from "./email-template";
import { checkInQrPayload } from "../bookings/domain/booking.utils";
import { PARKING_MODEL } from "../parking/domain/parking.constants";
import { AARTI_MODEL } from "../aarti/domain/aarti.constants";
import { EVENT_MODEL } from "../events/domain/event.constants";
import { WhatsAppTransactionalNotificationService } from "../../integrations/whatsapp/services/whatsapp-transactional-notification.service";
export interface NotificationJob {
  domain: "booking" | "parking" | "community" | "aarti" | "event";
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
    @InjectModel(AARTI_MODEL.Notification)
    private readonly aartiNotifications: Model<any>,
    @InjectModel(AARTI_MODEL.Booking)
    private readonly aartiBookings: Model<any>,
    @InjectModel(AARTI_MODEL.QrCode)
    private readonly aartiQrCodes: Model<any>,
    @InjectModel(EVENT_MODEL.Notification)
    private readonly eventNotifications: Model<any>,
    @InjectModel(EVENT_MODEL.Registration)
    private readonly eventRegistrations: Model<any>,
    @InjectModel(EVENT_MODEL.QrCode)
    private readonly eventQrCodes: Model<any>,
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
  private modelFor(domain: NotificationJob["domain"]): Model<any> {
    switch (domain) {
      case "booking":
        return this.booking;
      case "parking":
        return this.parking;
      case "aarti":
        return this.aartiNotifications;
      case "event":
        return this.eventNotifications;
      default:
        return this.community;
    }
  }

  async process(job: Job<NotificationJob>): Promise<void> {
    const data = job.data;
    const model = this.modelFor(data.domain);
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
      const sendsEmail =
        !whatsappOnly &&
        (data.channel === "email" || data.channel === "in_app") &&
        Boolean(resendApiKey) &&
        Boolean(user?.email);
      const sendsWhatsApp = data.channel === "in_app" || whatsappOnly;

      // The booking behind the notification is loaded once and shared by both
      // the email and the WhatsApp message, so neither refetches it.
      const bookingRef =
        data.bookingId || outboxRow?.bookingId || outboxRow?.registrationId;
      const [stay, parkingPass, aartiPass, eventPass] =
        sendsEmail || sendsWhatsApp
          ? await Promise.all([
              data.domain === "booking"
                ? this.stayContext(bookingRef)
                : Promise.resolve(null),
              data.domain === "parking"
                ? this.parkingContext(bookingRef)
                : Promise.resolve(null),
              data.domain === "aarti"
                ? this.aartiContext(bookingRef)
                : Promise.resolve(null),
              data.domain === "event"
                ? this.eventContext(bookingRef)
                : Promise.resolve(null),
            ])
          : [null, null, null, null];

      if (sendsEmail) {
        try {
          const { input, qrToken } = this.buildEmailContent(data, user, {
            stay,
            parkingPass,
            aartiPass,
            eventPass,
          });
          const attachments = await this.buildQrAttachment(qrToken, input.qrCid);
          const result: any = await new Resend(resendApiKey!).emails.send({
            from: this.config.getOrThrow<string>("resendFromEmail"),
            replyTo: this.config.get<string>("resendReplyTo"),
            to: user.email,
            subject: data.title,
            html: renderEmail(input),
            text: renderEmailText(input),
            ...(attachments.length ? { attachments } : {}),
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
          const whatsapp = await this.whatsapp.sendOutboxEvent({
            domain: data.domain,
            notificationId: data.notificationId,
            event: data.event,
            phone,
            recipientName: user?.name,
            title: data.title,
            message: data.message,
            reference:
              stay?.reference ??
              parkingPass?.reference ??
              aartiPass?.reference ??
              eventPass?.reference,
            stay: stay ?? undefined,
            parking: parkingPass ?? undefined,
            aarti: aartiPass ?? undefined,
            eventPass: eventPass ?? undefined,
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


  private get siteUrl(): string {
    return (
      this.config.get<string>("frontendUrl") || "https://www.tirvona.com"
    ).replace(/\/+$/, "");
  }

  /** Dates are shown in IST, which is where every destination on the platform is. */
  private formatDateTime(value: unknown, withTime = true): string {
    if (!value) return "";
    const date = new Date(value as string);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}),
    });
  }

  private formatMoney(amount: unknown, currency?: string): string {
    if (amount === null || amount === undefined || amount === "") return "";
    const value = Number(amount);
    if (!Number.isFinite(value)) return "";
    return `${currency === "USD" ? "$" : "₹"}${value.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  private rows(entries: [string, string][]): EmailDetailRow[] {
    return entries
      .filter(([, value]) => Boolean(value))
      .map(([label, value]) => ({ label, value }));
  }

  /**
   * Turns a queued notification plus its booking context into the branded
   * email. Every domain falls back to the plain title/message, so a
   * notification with no booking behind it still renders correctly.
   */
  private buildEmailContent(
    data: NotificationJob,
    user: any,
    context: {
      stay: any;
      parkingPass: any;
      aartiPass: any;
      eventPass: any;
    },
  ): { input: EmailTemplateInput; qrToken?: string } {
    const site = this.siteUrl;
    const base: EmailTemplateInput = {
      title: data.title,
      message: data.message,
      siteUrl: site,
      recipientName: user?.name,
    };

    const { stay, parkingPass, aartiPass, eventPass } = context;

    if (data.domain === "booking" && stay) {
      // The same payload the counter's check-in QR endpoint renders, so a guest
      // can be checked in from the email or from the app interchangeably.
      const checkInToken =
        stay.reference && stay.checkInCode
          ? checkInQrPayload(String(stay.reference), String(stay.checkInCode))
          : undefined;
      return {
        qrToken: checkInToken,
        input: {
          ...base,
          recipientName: stay.guestName || user?.name,
          reference: stay.reference,
          highlight: stay.checkInCode
            ? { label: "Check-in code", code: String(stay.checkInCode) }
            : undefined,
          qrCid: checkInToken ? "tirvona-checkin-pass" : undefined,
          qrCaption:
            "Show this QR code at the ashram counter, or read out the check-in code.",
          details: this.rows([
            ["Ashram", stay.ashramName],
            [
              "Location",
              [stay.ashramCity, stay.ashramState].filter(Boolean).join(", "),
            ],
            ["Room", stay.roomName],
            ["Check-in", this.formatDateTime(stay.checkInDate, false)],
            ["Check-out", this.formatDateTime(stay.checkOutDate, false)],
            ["Guests", stay.guestsCount ? String(stay.guestsCount) : ""],
            ["Rooms", stay.roomsCount ? String(stay.roomsCount) : ""],
            [
              "Amount paid",
              this.formatMoney(stay.amountPaid, stay.currency),
            ],
            ["Total", this.formatMoney(stay.totalAmount, stay.currency)],
          ]),
          cta: { label: "View Booking", url: `${site}/profile/bookings` },
          note: stay.checkInCode
            ? "Show the check-in code above at the ashram counter on arrival."
            : undefined,
        },
      };
    }

    if (data.domain === "parking" && parkingPass) {
      return {
        qrToken: parkingPass.qrToken,
        input: {
          ...base,
          reference: parkingPass.reference,
          highlight: parkingPass.displayCode
            ? { label: "Gate code", code: String(parkingPass.displayCode) }
            : undefined,
          qrCid: parkingPass.qrToken ? "tirvona-parking-pass" : undefined,
          qrCaption: "Scan this at the parking gate, or read out the gate code.",
          details: this.rows([
            ["Parking", parkingPass.locationName],
            ["City", parkingPass.locationCity],
            ["Vehicle", parkingPass.vehicleNumber],
            ["Vehicle type", parkingPass.vehicleType],
            ["Entry", this.formatDateTime(parkingPass.entryAt)],
            ["Exit", this.formatDateTime(parkingPass.exitAt)],
            [
              "Amount paid",
              this.formatMoney(parkingPass.amountPaid, parkingPass.currency),
            ],
          ]),
          cta: parkingPass.passUrl
            ? { label: "View Parking Pass", url: parkingPass.passUrl }
            : { label: "My Bookings", url: `${site}/profile/bookings` },
        },
      };
    }

    if (data.domain === "aarti" && aartiPass) {
      return {
        qrToken: aartiPass.qrToken,
        input: {
          ...base,
          recipientName: aartiPass.guestName || user?.name,
          reference: aartiPass.reference,
          highlight: aartiPass.displayCode
            ? { label: "Entry code", code: String(aartiPass.displayCode) }
            : undefined,
          qrCid: aartiPass.qrToken ? "tirvona-aarti-pass" : undefined,
          qrCaption: "Show this QR code at the temple entry gate.",
          details: this.rows([
            ["Aarti", aartiPass.sessionName],
            ["Scheduled for", this.formatDateTime(aartiPass.scheduledAt)],
            [
              "Amount paid",
              this.formatMoney(aartiPass.amountPaid, aartiPass.currency),
            ],
            [
              "Refund",
              this.formatMoney(aartiPass.refundAmount, aartiPass.currency),
            ],
          ]),
          cta: { label: "View Booking", url: `${site}/profile/bookings` },
        },
      };
    }

    if (data.domain === "event" && eventPass) {
      return {
        qrToken: eventPass.qrToken,
        input: {
          ...base,
          recipientName: eventPass.guestName || user?.name,
          reference: eventPass.reference,
          highlight: eventPass.displayCode
            ? { label: "Entry code", code: String(eventPass.displayCode) }
            : undefined,
          qrCid: eventPass.qrToken ? "tirvona-event-pass" : undefined,
          qrCaption: "Show this QR code at the event entry gate.",
          details: this.rows([
            ["Event", eventPass.eventName],
            ["Venue", eventPass.venue],
            ["Starts", this.formatDateTime(eventPass.startsAt)],
          ]),
          cta: { label: "View Registration", url: `${site}/profile/bookings` },
        },
      };
    }

    return {
      input: {
        ...base,
        cta: { label: "Open Tirvona", url: site },
      },
    };
  }

  /**
   * Renders the pass token as a PNG and returns it as an inline attachment, so
   * the QR shows in the body rather than only as a downloadable file. A failure
   * here is swallowed: the email still carries the code and the pass link.
   */
  private async buildQrAttachment(
    token: string | undefined,
    contentId: string | undefined,
  ): Promise<{ filename: string; content: Buffer; contentId: string }[]> {
    if (!token || !contentId) return [];
    try {
      const content = await QRCode.toBuffer(token, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      return [{ filename: `${contentId}.png`, content, contentId }];
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "notification.email_qr_render_failed",
          errorType: (error as Error).name,
        }),
      );
      return [];
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
      .select("displayCode +token")
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
      qrToken: qr?.token,
      passUrl: booking.bookingReference
        ? `${siteUrl}/parking/booking/${booking.bookingReference}`
        : undefined,
      amountPaid: booking.pricing?.amountPaid ?? booking.amountPaid,
      currency: booking.pricing?.currency,
    };
  }

  /** Loads the aarti pass so the message can carry the session and gate code. */
  private async aartiContext(bookingId: unknown): Promise<any | null> {
    if (!bookingId) return null;
    const booking: any = await this.aartiBookings
      .findById(String(bookingId))
      .select("bookingReference contactName startsAt pricing")
      .populate("sessionId", "name")
      .populate("customerId", "name")
      .lean();
    if (!booking) return null;
    const qr: any = await this.aartiQrCodes
      .findOne({ bookingId: booking._id })
      .sort({ version: -1 })
      .select("displayCode +token")
      .lean();
    return {
      guestName: booking.contactName || booking.customerId?.name,
      reference: booking.bookingReference,
      sessionName: booking.sessionId?.name,
      displayCode: qr?.displayCode,
      qrToken: qr?.token,
      scheduledAt: booking.startsAt,
      amountPaid: booking.pricing?.amountPaid,
      refundAmount: booking.pricing?.refundAmount,
      currency: booking.pricing?.currency,
    };
  }

  /** Loads the event registration so the message can carry the entry code. */
  private async eventContext(registrationId: unknown): Promise<any | null> {
    if (!registrationId) return null;
    const registration: any = await this.eventRegistrations
      .findById(String(registrationId))
      .select("registrationReference contactName startsAt")
      .populate("eventId", "name venue")
      .populate("customerId", "name")
      .lean();
    if (!registration) return null;
    const qr: any = await this.eventQrCodes
      .findOne({ registrationId: registration._id })
      .sort({ version: -1 })
      .select("displayCode +token")
      .lean();
    return {
      guestName: registration.contactName || registration.customerId?.name,
      reference: registration.registrationReference,
      eventName: registration.eventId?.name,
      // The listing stores the venue as an object, so only its name is shown.
      venue: registration.eventId?.venue?.name,
      displayCode: qr?.displayCode,
      qrToken: qr?.token,
      // Registrations carry no pricing of their own, so no amount is shown.
      startsAt: registration.startsAt,
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
