import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { randomBytes } from "node:crypto";
import type { Model } from "mongoose";
import { bookingBelongsTo, type BookingActor } from "../domain/booking-customer";
import {
  PAYMENT_LINK_MAX_TTL_MS,
  PAYMENT_LINK_PURPOSE,
  PAYMENT_LINK_VERSION,
  paymentLinkKey,
  signPaymentLink,
  verifyPaymentLink,
} from "../domain/payment-link-token";
import { BookingsService } from "./bookings.service";

export type PaymentPageStatus = "payable" | "paid" | "expired" | "cancelled";

/** Only what the payment page shows. No contact details, no internal ids. */
export interface PaymentPageSummary {
  status: PaymentPageStatus;
  bookingReference: string;
  property: { name: string; city: string };
  rooms: { name: string; units: number }[];
  checkInDate: string | null;
  checkOutDate: string | null;
  nights: number;
  guests: number;
  addOns: { name: string; quantity: number; totalPrice: number }[];
  services: { key: string; price: number }[];
  offer: { code: string; name: string } | null;
  pricing: {
    basePrice: number;
    servicesPrice: number;
    extraGuestAmount: number;
    platformFee: number;
    gstAmount: number;
    gstPercent: number;
    discountAmount: number;
    totalAmount: number;
    currency: string;
  };
  /** What is still to pay: the booking's total while payable, otherwise zero. */
  amountDue: number;
  holdExpiresAt: string | null;
  linkExpiresAt: string;
}

/**
 * The signed public payment page's backend.
 *
 * WhatsApp guests have no website login, and every payment endpoint the
 * website uses needs one. This service is the *transport* that lets a guest
 * pay their own booking from a signed link — and nothing else: the order is
 * created by `BookingsService.paymentOrder`, the payment is confirmed by
 * `BookingsService.confirmPayment`, and the Razorpay webhook remains the
 * authoritative confirmation. No amount, order id or identity is ever taken
 * from the browser; all of it is read from the booking and its payment
 * records.
 */
@Injectable()
export class BookingPaymentLinkService {
  private readonly logger = new Logger(BookingPaymentLinkService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly bookings: BookingsService,
    @InjectModel("Booking") private readonly bookingModel: Model<any>,
  ) {}

  private key(): Buffer {
    const key = paymentLinkKey({
      explicit: this.config.get<string>("paymentLinkSecret"),
      jwtSecret: this.config.get<string>("jwtSecret"),
    });
    if (!key)
      throw new ServiceUnavailableException(
        "Payment links are not configured on this server.",
      );
    return key;
  }

  private baseUrl(): string {
    return (this.config.get<string>("frontendUrl") ?? "https://tirvona.com").replace(
      /\/+$/,
      "",
    );
  }

  /** What can still be paid: an unpaid booking whose hold is open. */
  private statusOf(booking: any, now = Date.now()): PaymentPageStatus {
    if (booking.paymentStatus === "fully_paid") return "paid";
    if (["cancelled", "refunded"].includes(booking.status)) return "cancelled";
    if (
      booking.status === "expired" ||
      booking.status !== "pending" ||
      (booking.reservationExpiresAt &&
        new Date(booking.reservationExpiresAt).getTime() <= now)
    )
      return "expired";
    return "payable";
  }

  /**
   * Issues a payment link for a booking the actor owns.
   *
   * The link lives no longer than the booking hold (and never more than 30
   * minutes), and issuing a new one supersedes any earlier link for the same
   * booking. No Razorpay order is created here: that happens only when the
   * guest opens the page and asks to pay.
   */
  async issue(
    actor: BookingActor,
    bookingId: string,
  ): Promise<{
    url: string;
    expiresAt: Date;
    amount: number;
    reference: string;
  }> {
    const booking: any = await this.bookingModel.findOne({
      _id: bookingId,
      deletedAt: null,
    });
    // Not theirs is reported as not found, so a reference confirms nothing.
    if (!booking || !bookingBelongsTo(booking, actor))
      throw new NotFoundException("Booking not found");
    if (this.statusOf(booking) !== "payable")
      throw new BadRequestException("This booking can no longer be paid");

    const now = Date.now();
    const holdEnds = booking.reservationExpiresAt
      ? new Date(booking.reservationExpiresAt).getTime()
      : now + PAYMENT_LINK_MAX_TTL_MS;
    const exp = Math.min(holdEnds, now + PAYMENT_LINK_MAX_TTL_MS);
    const jti = randomBytes(16).toString("hex");
    const token = signPaymentLink(
      {
        v: PAYMENT_LINK_VERSION,
        p: PAYMENT_LINK_PURPOSE,
        b: String(booking._id),
        j: jti,
        iat: now,
        exp,
      },
      this.key(),
    );
    await this.bookingModel.updateOne(
      { _id: booking._id },
      { $set: { paymentLink: { jti, issuedAt: new Date(now) } } },
    );
    this.logger.log(
      JSON.stringify({
        event: "booking.payment_link_issued",
        bookingId: booking.bookingId,
        expiresAt: new Date(exp).toISOString(),
      }),
    );
    return {
      url: `${this.baseUrl()}/booking/pay/${token}`,
      expiresAt: new Date(exp),
      amount: Number(booking.pricing?.totalAmount ?? 0),
      reference: String(booking.bookingId),
    };
  }

  /**
   * Turns a link back into its booking — or refuses it.
   *
   * Tampered, foreign or wrong-purpose tokens are all "not valid", saying
   * nothing about why; an expired or superseded link says so, because that is
   * something the guest can fix by asking for a new one.
   */
  private async resolve(
    token: string,
  ): Promise<{ booking: any; linkExpiresAt: Date }> {
    const verdict = verifyPaymentLink(token, this.key());
    if (!verdict.ok) {
      if (verdict.reason === "expired")
        throw new GoneException(
          "This payment link has expired. Ask for a new one on WhatsApp.",
        );
      throw new NotFoundException("This payment link is not valid.");
    }
    const { claims } = verdict;
    if (!/^[0-9a-f]{24}$/i.test(claims.b))
      throw new NotFoundException("This payment link is not valid.");
    const booking: any = await this.bookingModel
      .findOne({ _id: claims.b, deletedAt: null })
      .populate("ashramId", "name address")
      .populate("rooms.roomId", "name");
    if (!booking) throw new NotFoundException("This payment link is not valid.");
    // Only the latest link for a booking works: an older one that was
    // forwarded or screenshotted stops working the moment a new one is issued.
    if (!booking.paymentLink?.jti || booking.paymentLink.jti !== claims.j)
      throw new GoneException(
        "This payment link has been replaced. Ask for a new one on WhatsApp.",
      );
    return { booking, linkExpiresAt: new Date(claims.exp) };
  }

  /** The booking as the payment page shows it, entirely from the server's records. */
  async summary(token: string): Promise<PaymentPageSummary> {
    const { booking, linkExpiresAt } = await this.resolve(token);
    return this.toSummary(booking, linkExpiresAt);
  }

  private toSummary(booking: any, linkExpiresAt: Date): PaymentPageSummary {
    const status = this.statusOf(booking);
    const pricing = booking.pricing ?? {};
    const services = booking.services ?? {};
    const night = 86_400_000;
    const nights = booking.occupiedDates?.length
      ? booking.occupiedDates.length
      : booking.checkInDate && booking.checkOutDate
        ? Math.max(
            1,
            Math.round(
              (new Date(booking.checkOutDate).getTime() -
                new Date(booking.checkInDate).getTime()) /
                night,
            ),
          )
        : 0;
    return {
      status,
      bookingReference: String(booking.bookingId),
      property: {
        name: String(booking.ashramId?.name ?? ""),
        city: String(booking.ashramId?.address?.city ?? ""),
      },
      rooms: (booking.rooms ?? []).map((room: any) => ({
        name: String(room.roomId?.name ?? "Room"),
        units: Number(room.units ?? 1),
      })),
      checkInDate: booking.checkInDate
        ? new Date(booking.checkInDate).toISOString()
        : null,
      checkOutDate: booking.checkOutDate
        ? new Date(booking.checkOutDate).toISOString()
        : null,
      nights,
      guests: Number(booking.guestsCount ?? 0),
      addOns: (services.selectedAddOns ?? []).map((a: any) => ({
        name: String(a.name ?? ""),
        quantity: Number(a.quantity ?? 1),
        totalPrice: Number(a.totalPrice ?? 0),
      })),
      services: (["prasad", "meals", "parking", "locker"] as const)
        .filter((key) => services[key]?.ordered)
        .map((key) => ({ key, price: Number(services[key]?.price ?? 0) })),
      offer: booking.promoCode
        ? {
            code: String(booking.promoCode),
            name: String(booking.offerName ?? booking.promoCode),
          }
        : null,
      pricing: {
        basePrice: Number(pricing.basePrice ?? 0),
        servicesPrice: Number(pricing.servicesPrice ?? 0),
        extraGuestAmount: Number(pricing.extraGuestAmount ?? 0),
        platformFee: Number(pricing.platformFee ?? 0),
        gstAmount: Number(pricing.gstAmount ?? 0),
        gstPercent: Number(pricing.gstPercent ?? 0),
        discountAmount: Number(pricing.discountAmount ?? 0),
        totalAmount: Number(pricing.totalAmount ?? 0),
        currency: String(pricing.currency ?? "INR"),
      },
      amountDue: status === "payable" ? Number(pricing.totalAmount ?? 0) : 0,
      holdExpiresAt: booking.reservationExpiresAt
        ? new Date(booking.reservationExpiresAt).toISOString()
        : null,
      linkExpiresAt: linkExpiresAt.toISOString(),
    };
  }

  /**
   * Opens (or re-opens) the Razorpay order for the booking behind this link.
   * `BookingsService.paymentOrder` does everything: it checks the booking is
   * still payable, takes the amount from the booking, and hands back the
   * existing open order rather than creating a second one.
   */
  async createOrder(
    token: string,
  ): Promise<{ orderId: string; amount: number; currency: string; keyId: string }> {
    const { booking } = await this.resolve(token);
    const status = this.statusOf(booking);
    if (status === "paid") throw new ConflictException("This booking is already paid.");
    if (status === "cancelled")
      throw new BadRequestException("This booking was cancelled.");
    if (status === "expired")
      throw new GoneException("The hold on this booking has expired.");
    const actor = await this.bookings.actorForBooking(booking);
    const order = await this.bookings.paymentOrder(String(booking._id), actor);
    return {
      orderId: String(order.data.orderId),
      amount: Number(order.data.amount),
      currency: String(order.data.currency),
      keyId: String(order.data.keyId),
    };
  }

  /**
   * Confirms a payment the browser reports, through the same
   * `confirmPayment` the website uses — including its check that the Razorpay
   * order belongs to this booking and matches its amount. The webhook
   * confirms independently, so this is a shortcut for speed, not the
   * authority: a failure here changes nothing the webhook can still do.
   */
  async confirm(
    token: string,
    proof: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ): Promise<{ status: PaymentPageStatus }> {
    const { booking } = await this.resolve(token);
    const actor = await this.bookings.actorForBooking(booking);
    try {
      await this.bookings.confirmPayment(String(booking._id), actor, {
        razorpay_order_id: proof.razorpay_order_id,
        razorpay_payment_id: proof.razorpay_payment_id,
        razorpay_signature: proof.razorpay_signature,
        method: "razorpay",
      });
    } catch (error) {
      // Already paid — the webhook (or an earlier tap) got there first.
      if (!(error instanceof ConflictException)) throw error;
    }
    return { status: "paid" };
  }
}
