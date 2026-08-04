import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import type { ClientSession, Model } from "mongoose";
import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import Razorpay from "razorpay";
import { TransactionService } from "../../../common/database/transaction.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  PARKING_MODEL,
  PARKING_VEHICLE_META,
} from "../domain/parking.constants";
import {
  PARKING_REPOSITORY,
  ParkingRepository,
} from "../domain/parking.repository";
import { ParkingException } from "../domain/parking.errors";
import {
  billableHours,
  datesInSpan,
  hashParkingQr,
  normalizeVehicleNumber,
  parkingBookingReference,
  parkingDisplayCode,
  parkingTransactionReference,
  sealParkingQr,
} from "../domain/parking.utils";
import { Inject } from "@nestjs/common";
import type {
  CancelParkingDto,
  ConfirmParkingPaymentDto,
  CreateParkingBookingDto,
  ReviewParkingDto,
} from "../presentation/dtos/parking.dto";
import { ParkingPricingService } from "./parking-pricing.service";

@Injectable()
export class ParkingBookingService {
  constructor(
    @Inject(PARKING_REPOSITORY) private readonly repository: ParkingRepository,
    private readonly transactions: TransactionService,
    private readonly pricingService: ParkingPricingService,
    private readonly config: ConfigService,
    @InjectModel(PARKING_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(PARKING_MODEL.Payment) private readonly payments: Model<any>,
    @InjectModel(PARKING_MODEL.Transaction) private readonly ledger: Model<any>,
    @InjectModel(PARKING_MODEL.Commission)
    private readonly commissions: Model<any>,
    @InjectModel(PARKING_MODEL.QrCode) private readonly qrCodes: Model<any>,
    @InjectModel(PARKING_MODEL.Notification)
    private readonly notifications: Model<any>,
    @InjectModel(PARKING_MODEL.Review) private readonly reviews: Model<any>,
    @InjectModel(PARKING_MODEL.Location) private readonly locations: Model<any>,
  ) {}

  private validateWindow(entryAt: string, exitAt: string): void {
    const entry = new Date(entryAt);
    const exit = new Date(exitAt);
    if (exit <= entry)
      throw new ParkingException("Exit time must be after the entry time", 400);
    if (entry.getTime() < Date.now() - 600_000)
      throw new ParkingException("Entry time cannot be in the past", 400);
    if (entry.getTime() > Date.now() + 90 * 86_400_000)
      throw new ParkingException(
        "Parking can be booked up to 90 days in advance",
        400,
      );
    if (exit.getTime() - entry.getTime() > 30 * 86_400_000)
      throw new ParkingException(
        "A single parking booking cannot exceed 30 days",
        400,
      );
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateParkingBookingDto,
  ): Promise<any> {
    this.validateWindow(dto.entryAt, dto.exitAt);
    const location = await this.repository.findLocationById(dto.locationId);
    if (!location || location.status !== "active")
      throw new ParkingException(
        "This parking is not available.",
        404,
        "LOCATION_NOT_FOUND",
      );
    const slotType = await this.repository.findSlotType(
      dto.slotTypeId,
      dto.locationId,
    );
    if (!slotType)
      throw new ParkingException(
        "This parking area is not available.",
        404,
        "SLOT_TYPE_NOT_FOUND",
      );
    if (!slotType.vehicleTypes.includes(dto.vehicleType))
      throw new ParkingException(
        "This parking area does not accept the selected vehicle type.",
        400,
        "VEHICLE_NOT_SUPPORTED",
      );
    const priced = await this.pricingService.quote(location, slotType, dto);
    if (!priced.ok)
      throw new ParkingException(priced.message, 400, priced.code);
    if (!priced.settings.allowOnlineBooking)
      throw new ParkingException(
        "Online booking is currently disabled for this parking.",
        400,
        "BOOKING_DISABLED",
      );
    const dates = datesInSpan(dto.entryAt, dto.exitAt);
    const units = Math.max(
      1,
      Math.ceil(
        PARKING_VEHICLE_META[
          dto.vehicleType as keyof typeof PARKING_VEHICLE_META
        ]?.footprint ?? 1,
      ),
    );
    const booking = await this.transactions.run(async (session) => {
      const held = await this.repository.reserveInventory({
        locationId: dto.locationId,
        slotTypeId: dto.slotTypeId,
        dates,
        units,
        capacity: slotType.totalCapacity,
        session,
      });
      if (!held.ok)
        throw new ParkingException(
          `This parking is full on ${held.failedDate}. Try a different area or time.`,
          409,
          "NO_AVAILABILITY",
        );
      const [created] = await this.bookings.create(
        [
          {
            bookingReference: parkingBookingReference(),
            customerId: user.id,
            locationId: location._id,
            partnerId: location.partnerId,
            slotTypeId: slotType._id,
            vehicleType: dto.vehicleType,
            vehicleNumber: normalizeVehicleNumber(dto.vehicleNumber),
            vehicleModel: dto.vehicleModel ?? "",
            driverName: dto.driverName || user.name,
            driverPhone: dto.driverPhone || user.phone || "",
            entryAt: new Date(dto.entryAt),
            exitAt: new Date(dto.exitAt),
            durationHours: billableHours(dto.entryAt, dto.exitAt),
            occupiedDates: dates,
            pricing: {
              ...priced.quote,
              slotTypeId: undefined,
              slotTypeName: undefined,
              durationHours: undefined,
              durationMinutes: undefined,
              vehicleType: undefined,
              pricingMode: undefined,
              peakReasons: undefined,
              isPeak: undefined,
              amountPaid: 0,
              refundAmount: 0,
              overstayAmount: 0,
            },
            status: "pending",
            paymentStatus: "pending",
            reservationExpiresAt: new Date(
              Date.now() +
                Number(priced.settings.reservationHoldMinutes) * 60_000,
            ),
            history: [
              {
                status: "pending",
                note: "Booking created",
                updatedBy: user.id,
              },
            ],
            source: "web",
          },
        ],
        { session },
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
    if (!booking) throw new ParkingException("Booking not found.", 404);
    return booking;
  }

  async listMine(
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
      throw new ParkingException("This booking is already paid.", 400);
    if (booking.status !== "pending")
      throw new ParkingException(
        "This booking can no longer be paid for.",
        400,
      );
    if (
      booking.reservationExpiresAt &&
      booking.reservationExpiresAt < new Date()
    )
      throw new ParkingException(
        "Your reservation hold expired. Please book again.",
        410,
      );
    const keyId = this.config.get<string>("razorpayKeyId");
    const keySecret = this.config.get<string>("razorpayKeySecret");
    const configured = Boolean(keyId && keySecret);
    if (!configured) {
      await this.payments.create({
        bookingId: booking._id,
        userId: user.id,
        partnerId: booking.partnerId,
        amount: booking.pricing.totalAmount,
        purpose: "booking",
        method: "demo",
        status: "pending",
      });
      return { demo: true, data: { amount: booking.pricing.totalAmount } };
    }
    const razorpay = new Razorpay({
      key_id: keyId!,
      key_secret: keySecret!,
    });
    const order = await razorpay.orders.create({
      amount: Math.round(booking.pricing.totalAmount * 100),
      currency: "INR",
      receipt: booking.bookingReference,
    });
    await this.payments.create({
      bookingId: booking._id,
      userId: user.id,
      partnerId: booking.partnerId,
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

  private verifyRazorpay(dto: ConfirmParkingPaymentDto): boolean {
    const keySecret = this.config.get<string>("razorpayKeySecret");
    // Mirrors BookingsService.signatureValid: the unverified demo path is for
    // local development only and must never confirm a paid parking booking in
    // production.
    if (!keySecret)
      return this.config.get<string>("nodeEnv") !== "production";
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

  private async issueQr(booking: any, session: ClientSession): Promise<any> {
    const settings = await this.pricingService.resolveSettings(
      String(booking.locationId),
      String(booking.partnerId),
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
    const displayCode = parkingDisplayCode();
    const version = Number(previous?.version ?? 0) + 1;
    const validFrom = new Date(new Date(booking.entryAt).getTime() - 3_600_000);
    const validUntil = new Date(
      new Date(booking.exitAt).getTime() +
        Number(settings.qrValidityBufferMinutes) * 60_000,
    );
    const token = sealParkingQr({
      v: 1,
      b: String(booking._id),
      r: booking.bookingReference,
      l: String(booking.locationId),
      u: String(booking.customerId),
      n: booking.vehicleNumber,
      e: booking.entryAt,
      x: booking.exitAt,
      vf: validFrom,
      vu: validUntil,
      d: displayCode,
      ver: version,
    });
    await this.qrCodes.create(
      [
        {
          bookingId: booking._id,
          locationId: booking.locationId,
          customerId: booking.customerId,
          tokenHash: hashParkingQr(token),
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
    dto: ConfirmParkingPaymentDto,
  ): Promise<any> {
    if (!this.verifyRazorpay(dto))
      throw new ParkingException("Payment signature verification failed.", 400);
    const result = await this.transactions.run(async (session) => {
      const booking = await this.bookings
        .findOne({ _id: id, customerId: user.id })
        .session(session);
      if (!booking) throw new ParkingException("Booking not found.", 404);
      if (booking.paymentStatus === "paid")
        throw new ConflictException("This booking is already paid.");
      if (
        booking.status !== "pending" ||
        (booking.reservationExpiresAt &&
          booking.reservationExpiresAt < new Date())
      )
        throw new ParkingException(
          "Your reservation hold expired. Please book again.",
          410,
        );
      let payment = await this.payments
        .findOne({
          bookingId: booking._id,
          purpose: "booking",
          status: "pending",
        })
        .sort({ createdAt: -1 })
        .session(session);
      if (!payment)
        [payment] = await this.payments.create(
          [
            {
              bookingId: booking._id,
              userId: user.id,
              partnerId: booking.partnerId,
              amount: booking.pricing.totalAmount,
              purpose: "booking",
              method: dto.method || "demo",
            },
          ],
          { session },
        );
      payment.status = "paid";
      payment.method = this.config.get<string>("razorpayKeySecret")
        ? "razorpay"
        : dto.method || "demo";
      payment.paidAt = new Date();
      payment.transactionId = dto.razorpay_payment_id || `PKTXN-${Date.now()}`;
      payment.gateway = {
        orderId: dto.razorpay_order_id || "",
        paymentId: dto.razorpay_payment_id || "",
        signature: dto.razorpay_signature || "",
        provider: "razorpay",
      };
      await payment.save({ session });
      const location = await this.locations
        .findById(booking.locationId)
        .session(session);
      const commission = await this.pricingService.commission(
        location,
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
      await booking.save({ session });
      await this.commissions.updateOne(
        { bookingId: booking._id },
        {
          $set: {
            partnerId: booking.partnerId,
            locationId: booking.locationId,
            grossAmount: booking.pricing.totalAmount,
            commissionPercent: commission.percent,
            commissionAmount: commission.amount,
            partnerEarning: commission.partnerEarning,
            settlementStatus: "pending",
          },
          $setOnInsert: { bookingId: booking._id },
        },
        { upsert: true, session },
      );
      await this.ledger.create(
        [
          {
            bookingId: booking._id,
            paymentId: payment._id,
            partnerId: booking.partnerId,
            locationId: booking.locationId,
            type: "booking",
            direction: "credit",
            amount: booking.pricing.totalAmount,
            description: `Parking booking ${booking.bookingReference}`,
            reference: parkingTransactionReference(),
            meta: {
              commissionPercent: commission.percent,
              commissionAmount: commission.amount,
            },
            recordedBy: user.id,
          },
        ],
        { session },
      );
      const pass = await this.issueQr(booking, session);
      await this.notifications.create(
        [
          {
            userId: booking.customerId,
            bookingId: booking._id,
            event: "booking_confirmed",
            title: "Parking Confirmed",
            message: `Your parking booking ${booking.bookingReference} is confirmed.`,
            channel: "in_app",
            status: "queued",
            meta: {
              bookingReference: booking.bookingReference,
              displayCode: pass.displayCode,
            },
          },
        ],
        { session },
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
      vehicleNumber: booking.vehicleNumber,
    };
  }

  /**
   * The booking's current pass — the same one every time it is asked for.
   *
   * Viewing a pass must never change it. This endpoint used to call
   * `reissueQr`, which revokes the outstanding pass and mints a replacement, so
   * the QR changed on every page refresh and the code a visitor was holding at
   * the gate had already been revoked — the guard's scan failed with "this pass
   * has been revoked". Reissuing is now an explicit action of its own.
   *
   * A pass is minted here only when there is genuinely none to show: a booking
   * that predates the stored-token column has a hash but no token, and cannot
   * be re-rendered. That mints once and is then stable.
   */
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
      this.issueQr(booking, session),
    );
    return this.renderPass(pass, booking, format);
  }

  private async assertPassable(id: string, userId: string): Promise<any> {
    const booking = await this.ownBooking(id, userId);
    if (
      booking.paymentStatus !== "paid" ||
      ["cancelled", "expired", "no_show"].includes(booking.status)
    )
      throw new ParkingException(
        "This booking no longer has a valid pass.",
        400,
      );
    return booking;
  }

  /**
   * Deliberately invalidates the outstanding pass and issues a replacement —
   * for a pass that was lost or shared. Never call this to display one.
   */
  async reissueQr(id: string, userId: string, format: string): Promise<any> {
    const booking = await this.assertPassable(id, userId);
    const pass = await this.transactions.run((session) =>
      this.issueQr(booking, session),
    );
    return this.renderPass(pass, booking, format);
  }

  async cancel(
    id: string,
    user: AuthenticatedUser,
    dto: CancelParkingDto,
    bypassOwnership = false,
  ): Promise<any> {
    const existing = bypassOwnership
      ? await this.repository.findBooking(id)
      : await this.ownBooking(id, user.id);
    if (!existing) throw new ParkingException("Booking not found.", 404);
    const location = await this.locations.findById(existing.locationId);
    const refund = await this.pricingService.refundQuote(existing, location);
    if (!refund.allowed) throw new ParkingException(refund.message, 400);
    const booking = await this.transactions.run(async (session) => {
      const row = await this.bookings
        .findOne({
          _id: id,
          ...(bypassOwnership ? {} : { customerId: user.id }),
        })
        .session(session);
      if (!row || ["cancelled", "checked_out"].includes(row.status))
        throw new ParkingException("This booking is already closed.", 400);
      if (row.status === "checked_in")
        throw new ParkingException(
          "A vehicle already inside cannot be cancelled. Please check out instead.",
          400,
        );
      row.status = "cancelled";
      row.cancellation = {
        reason: dto.reason || "Cancelled by user",
        cancelledAt: new Date(),
        cancelledBy: user.id,
        refundAmount: refund.refundAmount,
        refundReference: refund.refundAmount
          ? `PKREF-${Date.now().toString().slice(-8)}`
          : "",
      };
      row.pricing.refundAmount = refund.refundAmount;
      if (refund.refundAmount) row.paymentStatus = "refunded";
      row.reservationExpiresAt = null;
      row.history.push({
        status: "cancelled",
        note: dto.reason,
        updatedBy: user.id,
      });
      await row.save({ session });
      await this.repository.releaseInventory({
        slotTypeId: String(row.slotTypeId),
        dates: row.occupiedDates,
        units: Math.max(
          1,
          Math.ceil(
            PARKING_VEHICLE_META[
              row.vehicleType as keyof typeof PARKING_VEHICLE_META
            ]?.footprint ?? 1,
          ),
        ),
        session,
      });
      await this.qrCodes.updateMany(
        { bookingId: row._id, status: "active" },
        { $set: { status: "revoked", revokedReason: "Booking cancelled" } },
        { session },
      );
      if (refund.refundAmount) {
        await this.ledger.create(
          [
            {
              bookingId: row._id,
              partnerId: row.partnerId,
              locationId: row.locationId,
              type: "refund",
              direction: "debit",
              amount: -Math.abs(refund.refundAmount),
              description: `Refund for ${row.bookingReference}`,
              reference: parkingTransactionReference(),
              recordedBy: user.id,
            },
          ],
          { session },
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
          { session },
        );
      }
      return row;
    });
    return { booking, refund };
  }

  async review(
    id: string,
    user: AuthenticatedUser,
    dto: ReviewParkingDto,
  ): Promise<any> {
    const booking = await this.ownBooking(id, user.id);
    if (booking.status !== "checked_out")
      throw new ParkingException(
        "You can review a parking after your stay is complete.",
        400,
      );
    if (await this.reviews.exists({ bookingId: booking._id }))
      throw new ParkingException(
        "You have already reviewed this booking.",
        409,
      );
    const review = await this.reviews.create({
      locationId: booking.locationId,
      customerId: user.id,
      bookingId: booking._id,
      rating: {
        overall: dto.rating,
        safety: dto.safety,
        cleanliness: dto.cleanliness,
        staff: dto.staff,
        valueForMoney: dto.valueForMoney,
      },
      comment: dto.comment?.slice(0, 2000) ?? "",
      status: "approved",
    });
    const [aggregate] = await this.reviews.aggregate([
      { $match: { locationId: booking.locationId, status: "approved" } },
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
    await this.locations.updateOne(
      { _id: booking.locationId },
      { $set: { rating } },
    );
    return { review, rating };
  }
}
