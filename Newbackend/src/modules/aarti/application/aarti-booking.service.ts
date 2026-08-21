import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import type { ClientSession, Model } from "mongoose";
import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import Razorpay from "razorpay";
import { TransactionService } from "../../../common/database/transaction.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { AARTI_MODEL } from "../domain/aarti.constants";
import {
  AARTI_REPOSITORY,
  AartiRepository,
} from "../domain/aarti.repository";
import { AartiException } from "../domain/aarti.errors";
import {
  aartiBookingReference,
  aartiDisplayCode,
  aartiRefundReference,
  aartiTransactionReference,
  hashAartiQr,
  sealAartiQr,
  toDateKey,
} from "../domain/aarti.utils";
import type {
  CancelAartiDto,
  ConfirmAartiPaymentDto,
  CreateAartiBookingDto,
  ReviewAartiDto,
} from "../presentation/dtos/aarti.dto";
import { AartiPricingService } from "./aarti-pricing.service";

@Injectable()
export class AartiBookingService {
  constructor(
    @Inject(AARTI_REPOSITORY) private readonly repository: AartiRepository,
    private readonly transactions: TransactionService,
    private readonly pricingService: AartiPricingService,
    private readonly config: ConfigService,
    @InjectModel(AARTI_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(AARTI_MODEL.Payment) private readonly payments: Model<any>,
    @InjectModel(AARTI_MODEL.Transaction) private readonly ledger: Model<any>,
    @InjectModel(AARTI_MODEL.Commission)
    private readonly commissions: Model<any>,
    @InjectModel(AARTI_MODEL.QrCode) private readonly qrCodes: Model<any>,
    @InjectModel(AARTI_MODEL.Notification)
    private readonly notifications: Model<any>,
    @InjectModel(AARTI_MODEL.Review) private readonly reviews: Model<any>,
    @InjectModel(AARTI_MODEL.Session) private readonly sessions: Model<any>,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateAartiBookingDto,
  ): Promise<any> {
    const session = await this.repository.findSessionById(dto.sessionId);
    if (!session || session.status !== "approved")
      throw new AartiException(
        "This aarti is not open for booking.",
        404,
        "SESSION_NOT_FOUND",
      );
    const passType = await this.repository.findPassType(
      dto.passTypeId,
      dto.sessionId,
    );
    if (!passType)
      throw new AartiException(
        "This pass is not available.",
        404,
        "PASS_TYPE_NOT_FOUND",
      );

    const priced = await this.pricingService.quote(session, passType, {
      sessionDate: dto.sessionDate,
      passCount: dto.passCount,
      donationAmount: dto.donationAmount,
    });
    if (!priced.ok) throw new AartiException(priced.message, 400, priced.code);
    if (!priced.settings.allowOnlineBooking)
      throw new AartiException(
        "Online booking is currently disabled for this aarti.",
        400,
        "BOOKING_DISABLED",
      );
    if (
      priced.settings.requireDevoteeNames &&
      (dto.devotees?.length ?? 0) < dto.passCount
    )
      throw new AartiException(
        "This aarti requires the name of every devotee attending.",
        400,
        "DEVOTEE_NAMES_REQUIRED",
      );

    const date = toDateKey(dto.sessionDate);
    const booking = await this.transactions.run(async (txSession) => {
      const held = await this.repository.reserveSeats({
        sessionId: dto.sessionId,
        passTypeId: dto.passTypeId,
        date,
        seats: dto.passCount,
        capacity: Number(passType.totalCapacity),
        session: txSession,
      });
      if (!held.ok)
        throw new AartiException(
          held.remaining
            ? `Only ${held.remaining} pass(es) are left for this aarti.`
            : "This aarti is fully booked on the date you selected.",
          409,
          "NO_AVAILABILITY",
        );
      const [created] = await this.bookings.create(
        [
          {
            bookingReference: aartiBookingReference(),
            customerId: user.id,
            sessionId: session._id,
            ashramId: session.ashramId,
            passTypeId: passType._id,
            sessionDate: date,
            startsAt: priced.startsAt,
            endsAt: priced.endsAt,
            passCount: dto.passCount,
            devotees: dto.devotees ?? [],
            sankalpName: dto.sankalpName ?? "",
            sankalpGotra: dto.sankalpGotra ?? "",
            contactName: dto.contactName || user.name,
            contactPhone: dto.contactPhone || user.phone || "",
            contactEmail: dto.contactEmail || user.email || "",
            pricing: {
              unitPrice: priced.quote.unitPrice,
              passCount: priced.quote.passCount,
              peakMultiplier: priced.quote.peakMultiplier,
              subtotal: priced.quote.subtotal,
              donationAmount: priced.quote.donationAmount,
              taxPercent: priced.quote.taxPercent,
              taxAmount: priced.quote.taxAmount,
              totalAmount: priced.quote.totalAmount,
              amountPaid: 0,
              refundAmount: 0,
              currency: priced.quote.currency,
            },
            status: "pending",
            paymentStatus: "pending",
            reservationExpiresAt: new Date(
              Date.now() +
                Number(priced.settings.reservationHoldMinutes) * 60_000,
            ),
            history: [
              { status: "pending", note: "Booking created", updatedBy: user.id },
            ],
            source: "web",
          },
        ],
        { session: txSession },
      );
      return created;
    });

    return {
      booking,
      quote: priced.quote,
      holdExpiresAt: booking.reservationExpiresAt,
    };
  }

  async ownBooking(id: string, userId: string): Promise<any> {
    const booking = await this.repository.findBookingForCustomer(id, userId);
    if (!booking) throw new AartiException("Booking not found.", 404);
    return booking;
  }

  listMine(
    userId: string,
    status: string | undefined,
    page: number,
    limit: number,
  ): Promise<any> {
    return this.repository.listBookings(
      { customerId: userId, ...(status ? { status } : {}) },
      page,
      Math.min(limit, 50),
    );
  }

  async createPaymentOrder(id: string, user: AuthenticatedUser): Promise<any> {
    const booking = await this.ownBooking(id, user.id);
    if (booking.paymentStatus === "paid")
      throw new AartiException("This booking is already paid.", 400);
    if (booking.status !== "pending")
      throw new AartiException("This booking can no longer be paid for.", 400);
    if (
      booking.reservationExpiresAt &&
      booking.reservationExpiresAt < new Date()
    )
      throw new AartiException(
        "Your pass hold expired. Please book again.",
        410,
      );

    const keyId = this.config.get<string>("razorpayKeyId");
    const keySecret = this.config.get<string>("razorpayKeySecret");
    if (!keyId || !keySecret) {
      await this.payments.create({
        bookingId: booking._id,
        userId: user.id,
        ashramId: booking.ashramId,
        amount: booking.pricing.totalAmount,
        purpose: "booking",
        method: "demo",
        status: "pending",
      });
      return { demo: true, data: { amount: booking.pricing.totalAmount } };
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: Math.round(booking.pricing.totalAmount * 100),
      currency: "INR",
      receipt: booking.bookingReference,
    });
    await this.payments.create({
      bookingId: booking._id,
      userId: user.id,
      ashramId: booking.ashramId,
      amount: booking.pricing.totalAmount,
      purpose: "booking",
      method: "razorpay",
      status: "pending",
      gateway: { orderId: order.id, provider: "razorpay" },
    });
    return {
      demo: false,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId,
      },
    };
  }

  private verifyRazorpay(dto: ConfirmAartiPaymentDto): boolean {
    const keySecret = this.config.get<string>("razorpayKeySecret");
    if (!keySecret) return this.config.get<string>("nodeEnv") !== "production";
    if (
      !dto.razorpay_order_id ||
      !dto.razorpay_payment_id ||
      !dto.razorpay_signature
    )
      return false;
    const expected = createHmac("sha256", keySecret)
      .update(`${dto.razorpay_order_id}|${dto.razorpay_payment_id}`)
      .digest("hex");
    const actual = Buffer.from(dto.razorpay_signature);
    const candidate = Buffer.from(expected);
    return (
      actual.length === candidate.length && timingSafeEqual(actual, candidate)
    );
  }

  private async issuePass(
    booking: any,
    session: ClientSession,
  ): Promise<any> {
    const settings = await this.pricingService.resolveSettings(
      String(booking.sessionId),
      String(booking.ashramId),
    );
    const previous = await this.qrCodes
      .findOne({ bookingId: booking._id })
      .sort({ version: -1 })
      .session(session);
    if (previous?.status === "active") {
      previous.status = "revoked";
      previous.revokedReason = "Superseded by a reissued pass";
      await previous.save({ session });
    }
    const displayCode = aartiDisplayCode();
    const version = Number(previous?.version ?? 0) + 1;
    const validFrom = new Date(
      new Date(booking.startsAt).getTime() -
        Number(settings.gateOpensBeforeMinutes) * 60_000,
    );
    const validUntil = new Date(
      new Date(booking.endsAt).getTime() +
        Number(settings.qrValidityBufferMinutes) * 60_000,
    );
    const token = sealAartiQr({
      v: 1,
      b: String(booking._id),
      r: booking.bookingReference,
      s: String(booking.sessionId),
      u: String(booking.customerId),
      p: booking.passCount,
      st: booking.startsAt,
      en: booking.endsAt,
      vf: validFrom,
      vu: validUntil,
      d: displayCode,
      ver: version,
    });
    await this.qrCodes.create(
      [
        {
          bookingId: booking._id,
          sessionId: booking.sessionId,
          customerId: booking.customerId,
          tokenHash: hashAartiQr(token),
          token,
          displayCode,
          version,
          validFrom,
          validUntil,
          status: "active",
        },
      ],
      { session },
    );
    return { token, displayCode, validFrom, validUntil };
  }

  async confirmPayment(
    id: string,
    user: AuthenticatedUser,
    dto: ConfirmAartiPaymentDto,
  ): Promise<any> {
    if (!this.verifyRazorpay(dto))
      throw new AartiException("Payment signature verification failed.", 400);

    const result = await this.transactions.run(async (txSession) => {
      const booking = await this.bookings
        .findOne({ _id: id, customerId: user.id })
        .session(txSession);
      if (!booking) throw new AartiException("Booking not found.", 404);
      if (booking.paymentStatus === "paid")
        throw new ConflictException("This booking is already paid.");
      if (
        booking.status !== "pending" ||
        (booking.reservationExpiresAt &&
          booking.reservationExpiresAt < new Date())
      )
        throw new AartiException(
          "Your pass hold expired. Please book again.",
          410,
        );

      let payment = await this.payments
        .findOne({
          bookingId: booking._id,
          purpose: "booking",
          status: "pending",
        })
        .sort({ createdAt: -1 })
        .session(txSession);
      if (!payment)
        [payment] = await this.payments.create(
          [
            {
              bookingId: booking._id,
              userId: user.id,
              ashramId: booking.ashramId,
              amount: booking.pricing.totalAmount,
              purpose: "booking",
              method: dto.method || "demo",
            },
          ],
          { session: txSession },
        );
      payment.status = "paid";
      payment.method = this.config.get<string>("razorpayKeySecret")
        ? "razorpay"
        : dto.method || "demo";
      payment.paidAt = new Date();
      payment.transactionId = dto.razorpay_payment_id || `ARTXN-${Date.now()}`;
      payment.gateway = {
        orderId: dto.razorpay_order_id || "",
        paymentId: dto.razorpay_payment_id || "",
        signature: dto.razorpay_signature || "",
        provider: "razorpay",
      };
      await payment.save({ session: txSession });

      const session = await this.sessions
        .findById(booking.sessionId)
        .session(txSession);
      const commission = await this.pricingService.commission(
        session,
        booking.pricing.totalAmount,
      );

      booking.status = "upcoming";
      booking.paymentStatus = "paid";
      booking.pricing.amountPaid = booking.pricing.totalAmount;
      booking.commission = commission;
      booking.reservationExpiresAt = null;
      booking.history.push({
        status: "upcoming",
        note: "Payment confirmed",
        updatedBy: user.id,
      });
      await booking.save({ session: txSession });

      await this.commissions.updateOne(
        { bookingId: booking._id },
        {
          $set: {
            ashramId: booking.ashramId,
            sessionId: booking.sessionId,
            grossAmount: booking.pricing.totalAmount,
            commissionPercent: commission.percent,
            commissionAmount: commission.amount,
            ashramEarning: commission.ashramEarning,
            settlementStatus: "pending",
          },
          $setOnInsert: { bookingId: booking._id },
        },
        { upsert: true, session: txSession },
      );

      await this.ledger.create(
        [
          {
            bookingId: booking._id,
            paymentId: payment._id,
            ashramId: booking.ashramId,
            sessionId: booking.sessionId,
            type: "booking",
            direction: "credit",
            amount: booking.pricing.totalAmount,
            description: `Aarti booking ${booking.bookingReference}`,
            reference: aartiTransactionReference(),
            meta: {
              commissionPercent: commission.percent,
              commissionAmount: commission.amount,
              donationAmount: booking.pricing.donationAmount,
            },
            recordedBy: user.id,
          },
        ],
        { session: txSession },
      );

      const pass = await this.issuePass(booking, txSession);
      await this.notifications.create(
        [
          {
            userId: booking.customerId,
            bookingId: booking._id,
            event: "booking_confirmed",
            title: "Aarti Pass Confirmed",
            message: `Your aarti booking ${booking.bookingReference} is confirmed.`,
            channel: "in_app",
            status: "queued",
            recipientPhone: booking.contactPhone || "",
            meta: {
              bookingReference: booking.bookingReference,
              displayCode: pass.displayCode,
              sessionName: session?.name ?? "",
            },
          },
        ],
        { session: txSession },
      );
      return { booking, payment, pass };
    });

    return {
      ...result,
      qr: {
        ...result.pass,
        image: await QRCode.toDataURL(result.pass.token, {
          width: 512,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      },
    };
  }

  private async renderPass(
    pass: { token: string; [key: string]: unknown },
    booking: any,
    format: string,
  ): Promise<any> {
    const image =
      format === "svg"
        ? await QRCode.toString(pass.token, {
            type: "svg",
            margin: 2,
            errorCorrectionLevel: "M",
          })
        : await QRCode.toDataURL(pass.token, {
            width: 512,
            margin: 2,
            errorCorrectionLevel: "M",
          });
    return {
      format,
      image,
      ...pass,
      bookingReference: booking.bookingReference,
      passCount: booking.passCount,
      startsAt: booking.startsAt,
    };
  }

  private async assertPassable(id: string, userId: string): Promise<any> {
    const booking = await this.ownBooking(id, userId);
    if (
      booking.paymentStatus !== "paid" ||
      ["cancelled", "expired", "no_show"].includes(booking.status)
    )
      throw new AartiException("This booking no longer has a valid pass.", 400);
    return booking;
  }

  async currentPass(id: string, userId: string, format: string): Promise<any> {
    const booking = await this.assertPassable(id, userId);
    const existing = await this.qrCodes
      .findOne({ bookingId: booking._id, status: { $in: ["active", "used"] } })
      .sort({ version: -1 })
      .select("+token");
    if (existing?.token)
      return this.renderPass(
        {
          token: existing.token,
          displayCode: existing.displayCode,
          validFrom: existing.validFrom,
          validUntil: existing.validUntil,
        },
        booking,
        format,
      );
    const pass = await this.transactions.run((session) =>
      this.issuePass(booking, session),
    );
    return this.renderPass(pass, booking, format);
  }

  async reissuePass(id: string, userId: string, format: string): Promise<any> {
    const booking = await this.assertPassable(id, userId);
    const pass = await this.transactions.run((session) =>
      this.issuePass(booking, session),
    );
    return this.renderPass(pass, booking, format);
  }

  async refundPreview(id: string, userId: string): Promise<any> {
    const booking = await this.ownBooking(id, userId);
    const session = await this.sessions.findById(booking.sessionId);
    return this.pricingService.refundQuote(booking, session);
  }

  async cancel(
    id: string,
    user: AuthenticatedUser,
    dto: CancelAartiDto,
    bypassOwnership = false,
  ): Promise<any> {
    const existing = bypassOwnership
      ? await this.repository.findBooking(id)
      : await this.ownBooking(id, user.id);
    if (!existing) throw new AartiException("Booking not found.", 404);
    const session = await this.sessions.findById(existing.sessionId);
    const refund = await this.pricingService.refundQuote(existing, session);
    if (!refund.allowed) throw new AartiException(refund.message, 400);

    const booking = await this.transactions.run(async (txSession) => {
      const row = await this.bookings
        .findOne({
          _id: id,
          ...(bypassOwnership ? {} : { customerId: user.id }),
        })
        .session(txSession);
      if (!row || ["cancelled", "attended"].includes(row.status))
        throw new AartiException("This booking is already closed.", 400);
      if (row.status === "checked_in")
        throw new AartiException(
          "Devotees already admitted cannot be cancelled.",
          400,
        );

      row.status = "cancelled";
      row.cancellation = {
        reason: dto.reason || "Cancelled by user",
        cancelledAt: new Date(),
        cancelledBy: user.id,
        refundAmount: refund.refundAmount,
        refundReference: refund.refundAmount ? aartiRefundReference() : "",
      };
      row.pricing.refundAmount = refund.refundAmount;
      if (refund.refundAmount) row.paymentStatus = "refunded";
      row.reservationExpiresAt = null;
      row.history.push({
        status: "cancelled",
        note: dto.reason,
        updatedBy: user.id,
      });
      await row.save({ session: txSession });

      await this.repository.releaseSeats({
        passTypeId: String(row.passTypeId),
        date: row.sessionDate,
        seats: Number(row.passCount),
        session: txSession,
      });
      await this.qrCodes.updateMany(
        { bookingId: row._id, status: "active" },
        { $set: { status: "revoked", revokedReason: "Booking cancelled" } },
        { session: txSession },
      );

      if (refund.refundAmount) {
        await this.ledger.create(
          [
            {
              bookingId: row._id,
              ashramId: row.ashramId,
              sessionId: row.sessionId,
              type: "refund",
              direction: "debit",
              amount: -Math.abs(refund.refundAmount),
              description: `Refund for ${row.bookingReference}`,
              reference: aartiTransactionReference(),
              recordedBy: user.id,
            },
          ],
          { session: txSession },
        );
        await this.commissions.updateOne(
          { bookingId: row._id },
          {
            $set: {
              settlementStatus: "reversed",
              reversedAt: new Date(),
              reversalReason: "Booking cancelled",
            },
          },
          { session: txSession },
        );
      }
      await this.notifications.create(
        [
          {
            userId: row.customerId,
            bookingId: row._id,
            event: refund.refundAmount ? "refund" : "cancellation",
            title: "Aarti Booking Cancelled",
            message: refund.refundAmount
              ? `Booking ${row.bookingReference} was cancelled. ₹${refund.refundAmount} will be refunded.`
              : `Booking ${row.bookingReference} was cancelled.`,
            channel: "in_app",
            status: "queued",
            recipientPhone: row.contactPhone || "",
            meta: { bookingReference: row.bookingReference },
          },
        ],
        { session: txSession },
      );
      return row;
    });
    return { booking, refund };
  }

  async review(
    id: string,
    user: AuthenticatedUser,
    dto: ReviewAartiDto,
  ): Promise<any> {
    const booking = await this.ownBooking(id, user.id);
    if (!["attended", "checked_in"].includes(booking.status))
      throw new AartiException(
        "You can review an aarti after you have attended it.",
        400,
      );
    if (await this.reviews.exists({ bookingId: booking._id }))
      throw new AartiException("You have already reviewed this booking.", 409);

    const review = await this.reviews.create({
      sessionId: booking.sessionId,
      customerId: user.id,
      bookingId: booking._id,
      rating: {
        overall: dto.rating,
        arrangement: dto.arrangement,
        cleanliness: dto.cleanliness,
        staff: dto.staff,
        valueForMoney: dto.valueForMoney,
      },
      comment: dto.comment?.slice(0, 2000) ?? "",
      status: "approved",
    });

    const [aggregate] = await this.reviews.aggregate([
      { $match: { sessionId: booking.sessionId, status: "approved" } },
      {
        $group: {
          _id: null,
          average: { $avg: "$rating.overall" },
          count: { $sum: 1 },
        },
      },
    ]);
    const rating = {
      average: Number((aggregate?.average ?? 0).toFixed(2)),
      count: aggregate?.count ?? 0,
    };
    await this.sessions.updateOne(
      { _id: booking.sessionId },
      { $set: { rating } },
    );
    return { review, rating };
  }
}
