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
import {
  bookingBelongsTo,
  type BookingActor,
} from "../../bookings/domain/booking-customer";
import { DEFAULT_BOOKING_CHANNEL, WHATSAPP_BOOKING_CHANNEL } from "../../bookings/domain/booking.utils";
import {
  PARKING_PAYMENT_LINK_PURPOSE,
  PAYMENT_LINK_MAX_TTL_MS,
  PAYMENT_LINK_VERSION,
  paymentLinkKey,
  signPaymentLink,
  verifyPaymentLink,
} from "../../bookings/domain/payment-link-token";
import { PARKING_MODEL } from "../domain/parking.constants";
import { ParkingBookingService } from "./parking-booking.service";

export type ParkingPayStatus = "payable" | "paid" | "expired" | "cancelled";

/** What the parking payment page shows — all of it read from the booking. */
export interface ParkingPaySummary {
  status: ParkingPayStatus;
  bookingReference: string;
  location: { name: string; city: string };
  bay: string;
  vehicleType: string;
  vehicleNumber: string;
  entryAt: string;
  exitAt: string;
  durationHours: number;
  pricing: {
    baseFee: number;
    durationAmount: number;
    subtotal: number;
    taxPercent: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
  };
  amountDue: number;
  holdExpiresAt: string | null;
  linkExpiresAt: string;
}

/** Keeps the state code and the last two digits; enough to recognise, not to copy. */
const maskVehicle = (value: string): string => {
  const plate = String(value ?? "");
  return plate.length > 6
    ? `${plate.slice(0, 4)}${"•".repeat(plate.length - 6)}${plate.slice(-2)}`
    : plate;
};

/**
 * The signed, login-free payment page for a parking booking.
 *
 * The same capability model as the stay link (`BookingPaymentLinkService`):
 * the token names one booking and nothing else, only the latest link for a
 * booking works, and every figure comes from the booking record. The order is
 * opened by `ParkingBookingService.createPaymentOrderFor` and confirmed by
 * `confirmPaymentFor` — the website's own parking payment path — and the
 * Razorpay webhook remains the authority. A parking token is refused by the
 * stay endpoints and a stay token here, because each checks its own purpose.
 */
@Injectable()
export class ParkingPaymentLinkService {
  private readonly logger = new Logger(ParkingPaymentLinkService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly parking: ParkingBookingService,
    @InjectModel(PARKING_MODEL.Booking) private readonly bookings: Model<any>,
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

  private statusOf(booking: any, now = Date.now()): ParkingPayStatus {
    if (booking.paymentStatus === "paid") return "paid";
    if (booking.status === "cancelled" || booking.paymentStatus === "refunded")
      return "cancelled";
    if (
      booking.status !== "pending" ||
      (booking.reservationExpiresAt &&
        new Date(booking.reservationExpiresAt).getTime() <= now)
    )
      return "expired";
    return "payable";
  }

  /** The owner of a booking, as the actor its payment methods expect. */
  private ownerOf(booking: any): BookingActor {
    return booking.whatsappCustomerId
      ? {
          userId: null,
          whatsappCustomerId: String(booking.whatsappCustomerId),
          role: "whatsapp_customer",
          channel: WHATSAPP_BOOKING_CHANNEL,
        }
      : {
          userId: String(booking.customerId),
          whatsappCustomerId: null,
          role: "customer",
          channel: DEFAULT_BOOKING_CHANNEL,
        };
  }

  /**
   * Issues a link for a parking booking the actor owns. It lives no longer
   * than the bay hold (and never beyond 30 minutes), and supersedes any
   * earlier link. No Razorpay order is created here.
   */
  async issue(
    actor: BookingActor,
    bookingId: string,
  ): Promise<{ url: string; expiresAt: Date; amount: number; reference: string }> {
    const booking: any = /^[0-9a-f]{24}$/i.test(String(bookingId))
      ? await this.bookings.findById(bookingId)
      : null;
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
        p: PARKING_PAYMENT_LINK_PURPOSE,
        b: String(booking._id),
        j: jti,
        iat: now,
        exp,
      },
      this.key(),
    );
    await this.bookings.updateOne(
      { _id: booking._id },
      { $set: { paymentLink: { jti, issuedAt: new Date(now) } } },
    );
    this.logger.log(
      JSON.stringify({
        event: "parking.payment_link_issued",
        bookingReference: booking.bookingReference,
        expiresAt: new Date(exp).toISOString(),
      }),
    );
    return {
      url: `${this.baseUrl()}/parking/pay/${token}`,
      expiresAt: new Date(exp),
      amount: Number(booking.pricing?.totalAmount ?? 0),
      reference: String(booking.bookingReference),
    };
  }

  private async resolve(token: string): Promise<{ booking: any; linkExpiresAt: Date }> {
    const verdict = verifyPaymentLink(
      token,
      this.key(),
      Date.now(),
      PARKING_PAYMENT_LINK_PURPOSE,
    );
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
    const booking: any = await this.bookings
      .findById(claims.b)
      .populate("locationId", "name address")
      .populate("slotTypeId", "name");
    if (!booking) throw new NotFoundException("This payment link is not valid.");
    if (!booking.paymentLink?.jti || booking.paymentLink.jti !== claims.j)
      throw new GoneException(
        "This payment link has been replaced. Ask for a new one on WhatsApp.",
      );
    return { booking, linkExpiresAt: new Date(claims.exp) };
  }

  async summary(token: string): Promise<ParkingPaySummary> {
    const { booking, linkExpiresAt } = await this.resolve(token);
    const status = this.statusOf(booking);
    const pricing = booking.pricing ?? {};
    return {
      status,
      bookingReference: String(booking.bookingReference),
      location: {
        name: String(booking.locationId?.name ?? ""),
        city: String(booking.locationId?.address?.city ?? ""),
      },
      bay: String(booking.slotTypeId?.name ?? ""),
      vehicleType: String(booking.vehicleType ?? ""),
      vehicleNumber: maskVehicle(booking.vehicleNumber),
      entryAt: new Date(booking.entryAt).toISOString(),
      exitAt: new Date(booking.exitAt).toISOString(),
      durationHours: Number(booking.durationHours ?? 0),
      pricing: {
        baseFee: Number(pricing.baseFee ?? 0),
        durationAmount: Number(pricing.durationAmount ?? 0),
        subtotal: Number(pricing.subtotal ?? 0),
        taxPercent: Number(pricing.taxPercent ?? 0),
        taxAmount: Number(pricing.taxAmount ?? 0),
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

  /** Opens (or re-opens) the booking's Razorpay order, amount from the booking. */
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
    const order = await this.parking.createPaymentOrderFor(
      this.ownerOf(booking),
      String(booking._id),
    );
    // The website refuses a simulated order; so does the public page.
    if (order.demo)
      throw new ServiceUnavailableException(
        "Online payment is not available right now.",
      );
    return {
      orderId: String(order.data.orderId),
      amount: Number(order.data.amount),
      currency: String(order.data.currency),
      keyId: String(order.data.keyId),
    };
  }

  /**
   * Confirms what the browser reports through `confirmPaymentFor`, which
   * verifies the signature and that the order is this booking's own. The
   * webhook confirms independently; this is a shortcut, not the authority.
   */
  async confirm(
    token: string,
    proof: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ): Promise<{ status: ParkingPayStatus }> {
    const { booking } = await this.resolve(token);
    try {
      await this.parking.confirmPaymentFor(
        this.ownerOf(booking),
        String(booking._id),
        { ...proof, method: "razorpay" },
      );
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
    }
    return { status: "paid" };
  }
}
