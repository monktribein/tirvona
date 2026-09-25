import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import type { Model } from "mongoose";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { TransactionService } from "../../../common/database/transaction.service";
import {
  bookingReference,
  checkinCode,
  reservationReference,
  roundMoney,
} from "../../bookings/domain/booking.utils";
import type { DayStayHoldDto, DayStayConfirmPaymentDto } from "../presentation/dtos/day-stay.dto";
import { DayStayInventoryService } from "./day-stay-inventory.service";
import { hhmmToMinutes, istDateString, istInstant, istTimeString } from "../domain/day-stay-time";

@Injectable()
export class DayStayBookingService {
  private readonly logger = new Logger(DayStayBookingService.name);
  private readonly razorpay: Razorpay | null;

  constructor(
    @InjectModel("Booking") private readonly bookingModel: Model<any>,
    @InjectModel("Ashram") private readonly ashramModel: Model<any>,
    @InjectModel("Room") private readonly roomModel: Model<any>,
    @InjectModel("BookingStatusHistory") private readonly historyModel: Model<any>,
    @InjectModel("BookingNotification") private readonly notificationModel: Model<any>,
    private readonly inventoryService: DayStayInventoryService,
    private readonly transactions: TransactionService,
    private readonly config: ConfigService,
  ) {
    const keyId = this.config.get<string>("razorpayKeyId");
    const keySecret = this.config.get<string>("razorpayKeySecret");
    this.razorpay = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;
  }

  /**
   * Demo (mock) payments are only allowed when no Razorpay secret is
   * configured and we are not running in production. With live keys, a
   * client can never opt into the mock path.
   */
  private demoPaymentsAllowed(): boolean {
    const keySecret = this.config.get<string>("razorpayKeySecret");
    const nodeEnv = this.config.get<string>("nodeEnv") ?? process.env.NODE_ENV;
    return !keySecret && nodeEnv !== "production";
  }

  /**
   * Holds a Day Stay slot atomically and initiates a payment order.
   *
   * Atomicity is provided by a short-lived mutex on the Room document
   * (`dayStayLockToken`/`dayStayLockExpiresAt`), claimed with a single
   * atomic `findOneAndUpdate`. This serializes the "check availability,
   * then create a pending booking" critical section per room, which a
   * plain read-then-write (or even a bare Mongo transaction, since two
   * concurrent transactions can both read 0 competing bookings before
   * either inserts) does not prevent.
   */
  async holdSlot(dto: DayStayHoldDto, customerId: string): Promise<any> {
    const ashram = await this.ashramModel.findById(dto.ashramId).lean();
    if (!ashram) throw new NotFoundException("Property not found");
    if (!ashram.dayStayConfig?.enabled) {
      throw new BadRequestException("Day Stay is currently disabled for this property");
    }

    const room = await this.roomModel.findOne({ _id: dto.roomId, ashramId: dto.ashramId }).lean();
    if (!room || !room.dayStayConfig?.enabled) {
      throw new BadRequestException("Room is not available for Day Stay");
    }

    const lockToken = randomBytes(12).toString("hex");
    const lockNow = new Date();
    const lockExpiresAt = new Date(lockNow.getTime() + 8000);
    const lockedRoom = await this.roomModel.findOneAndUpdate(
      {
        _id: dto.roomId,
        $or: [
          { dayStayLockExpiresAt: { $exists: false } },
          { dayStayLockExpiresAt: null },
          { dayStayLockExpiresAt: { $lt: lockNow } },
        ],
      },
      { $set: { dayStayLockToken: lockToken, dayStayLockExpiresAt: lockExpiresAt } },
      { new: true },
    );
    if (!lockedRoom) {
      throw new ConflictException(
        "This room is busy processing another booking request. Please try again in a moment.",
      );
    }
    try {
      return await this.holdSlotLocked(dto, customerId, room, ashram);
    } finally {
      await this.roomModel.updateOne(
        { _id: dto.roomId, dayStayLockToken: lockToken },
        { $unset: { dayStayLockToken: "", dayStayLockExpiresAt: "" } },
      );
    }
  }

  private async holdSlotLocked(
    dto: DayStayHoldDto,
    customerId: string,
    room: any,
    ashram: any,
  ): Promise<any> {
    // Same product resolution as availability, so every slot shown is bookable.
    const products = await this.inventoryService.resolveRoomProducts(room);
    const product = products.find((p: any) => p.productCode === dto.productCode.toUpperCase());
    if (!product) {
      throw new BadRequestException(`Product ${dto.productCode} is not offered for this room`);
    }

    const duration = product.durationMinutes;
    const startMins = hhmmToMinutes(dto.startTime);
    // Slot times are IST wall-clock at the property.
    const slotStartUtc = istInstant(dto.date, startMins);
    const slotEndUtc = istInstant(dto.date, startMins + duration);

    const graceMinutes = ashram.dayStayConfig.defaultGraceMinutes ?? 15;
    const bufferMinutes = ashram.dayStayConfig.defaultHousekeepingBufferMinutes ?? 45;
    const graceExpiresAt = new Date(slotEndUtc.getTime() + graceMinutes * 60000);
    const housekeepingEndsAt = new Date(graceExpiresAt.getTime() + bufferMinutes * 60000);

    const price = product.discountPrice || product.price;
    const gstAmount = roundMoney(price * 0.18);
    const totalAmount = roundMoney(price + gstAmount);

    const now = new Date();
    const holdExpiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 min hold TTL
    const bId = bookingReference();
    const resNo = reservationReference();
    const cCode = checkinCode();

    // Re-check availability now that the per-room lock is held, so this
    // read-then-write is no longer racing any other hold for this room.
    // This also rejects past slots, blackout dates and quick blocks.
    const slots = await this.inventoryService.getRoomSlots(dto.ashramId, dto.roomId, dto.date, dto.productCode);
    const selectedSlot = slots.find((s) => s.startTime === dto.startTime);
    if (!selectedSlot || selectedSlot.availableUnits <= 0) {
      throw new ConflictException("Sorry, this time slot is not available. Please choose another time.");
    }

    let isDemo = false;
    let rzpOrderId = `mock_order_${Date.now()}`;
    const keyId = this.config.get<string>("razorpayKeyId") || process.env.RAZORPAY_KEY_ID || "";
    if (this.razorpay) {
      try {
        const order = await this.razorpay.orders.create({
          amount: Math.round(totalAmount * 100),
          currency: "INR",
          receipt: bId,
          notes: {
            bookingType: product.productType,
            productCode: product.productCode,
            ashramId: dto.ashramId,
          },
        });
        rzpOrderId = order.id;
      } catch (err: any) {
        // Never fall back to a mock order when live keys exist: that
        // would let the booking be confirmed without a real payment.
        this.logger.error(`Razorpay order creation failed: ${err.message}`);
        throw new ServiceUnavailableException("Payment gateway is unavailable. Please try again shortly.");
      }
    } else if (this.demoPaymentsAllowed()) {
      isDemo = true;
    } else {
      throw new ServiceUnavailableException("Online payments are not configured");
    }

    const bookingType = product.productType || "day_rest";

    const bookingDoc = await this.bookingModel.create({
      bookingId: bId,
      reservationNumber: resNo,
      customerId,
      ashramId: dto.ashramId,
      bookingSource: "tirvona",
      bookingType,
      dayStayDetails: {
        productCode: product.productCode,
        productType: bookingType,
        slotStartTime: slotStartUtc,
        slotEndTime: slotEndUtc,
        durationMinutes: duration,
        graceMinutes,
        graceExpiresAt,
        housekeepingBufferMinutes: bufferMinutes,
        housekeepingEndsAt,
      },
      rooms: [
        {
          roomId: dto.roomId,
          units: 1,
          mrp: product.price,
          sellingPrice: price,
        },
      ],
      checkInDate: slotStartUtc,
      checkOutDate: slotEndUtc,
      guestsCount: dto.guestsCount,
      roomsBookedCount: 1,
      status: "pending",
      paymentStatus: "pending",
      gatewayStatus: "pending",
      paymentMode: "online",
      reservationExpiresAt: holdExpiresAt,
      pricing: {
        basePrice: price,
        roomMrp: product.price,
        effectiveRoomPrice: price,
        gstAmount,
        gstPercent: 18,
        totalAmount,
      },
      paymentSummary: {
        razorpayOrderId: rzpOrderId,
        demo: isDemo,
      },
      specialRequests: dto.specialRequests,
      checkInCode: cCode,
    });

    await this.historyModel.create({
      bookingId: bookingDoc._id,
      fromStatus: "none",
      toStatus: "pending",
      note: `Day Stay slot held for ${duration} mins until ${holdExpiresAt.toISOString()}`,
      actorId: customerId,
      actorRole: "customer",
    });

    return {
      bookingId: bId,
      reservationNumber: resNo,
      productName: product.displayName || product.productCode,
      slotStartTime: slotStartUtc,
      slotEndTime: slotEndUtc,
      durationMinutes: duration,
      pricing: {
        basePrice: price,
        gstAmount,
        totalAmount,
      },
      demo: isDemo,
      keyId,
      razorpayKeyId: keyId,
      razorpayOrderId: rzpOrderId,
      reservationExpiresAt: holdExpiresAt,
    };
  }

  private verifySignature(keySecret: string, orderId: string, paymentId: string, signature: string): boolean {
    const expected = Buffer.from(
      createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex"),
    );
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  /**
   * Confirms a Day Stay booking after Razorpay signature verification.
   * Both browser checkout callback and server-to-server webhook converge here idempotently.
   *
   * `capturedAmountPaise` is supplied by the webhook path (from the verified
   * Razorpay event) and must match the booking total.
   */
  async confirmPayment(
    dto: DayStayConfirmPaymentDto,
    customerId?: string,
    capturedAmountPaise?: number,
  ): Promise<any> {
    const isHexId = typeof dto.bookingId === "string" && /^[0-9a-fA-F]{24}$/.test(dto.bookingId);
    const lookupConditions: any[] = [];
    if (dto.bookingId) {
      lookupConditions.push({ bookingId: dto.bookingId });
      if (isHexId) lookupConditions.push({ _id: dto.bookingId });
    }
    if (dto.razorpayOrderId) {
      lookupConditions.push({ "paymentSummary.razorpayOrderId": dto.razorpayOrderId });
    }

    const booking = await this.bookingModel.findOne({
      $or: lookupConditions.length > 0 ? lookupConditions : [{ bookingId: "non_existent" }],
    });

    if (!booking) {
      throw new NotFoundException("Active Day Stay booking not found for this payment order");
    }

    // Ownership check: only the customer who created this hold (browser
    // checkout callback path) may confirm it. `customerId` is undefined
    // for the server-to-server webhook path, which is trusted separately
    // via PaymentsWebhookService.verifySignature on the raw webhook body.
    if (customerId && String(booking.customerId) !== String(customerId)) {
      throw new NotFoundException("Active Day Stay booking not found for this payment order");
    }

    // 1. Idempotency Check: If already confirmed, return success immediately
    if (booking.status === "confirmed" || booking.paymentStatus === "fully_paid") {
      return this.confirmedResponse(booking);
    }

    // 2. The payment must be for THIS booking's own order. Otherwise a
    //    genuine payment on a cheaper order could confirm a different booking.
    const bookingOrderId = booking.paymentSummary?.razorpayOrderId;
    if (!bookingOrderId || dto.razorpayOrderId !== bookingOrderId) {
      throw new BadRequestException("Payment does not belong to this booking");
    }

    // 3. Cryptographic proof of payment.
    // - Demo mode (no Razorpay secret, non-production) accepts mock orders only.
    // - Client-invoked: a valid Razorpay signature is mandatory.
    // - Webhook-invoked: PaymentsWebhookService already verified the webhook
    //   body signature; we additionally require the captured amount to match.
    const keySecret = this.config.get<string>("razorpayKeySecret");
    const isDemoBooking = booking.paymentSummary?.demo === true || String(bookingOrderId).startsWith("mock_");
    if (isDemoBooking) {
      if (!this.demoPaymentsAllowed()) {
        throw new BadRequestException("Demo payments are not accepted");
      }
    } else {
      if (!keySecret) {
        throw new ServiceUnavailableException("Online payments are not configured");
      }
      if (customerId) {
        if (!dto.razorpaySignature) {
          throw new BadRequestException("Payment signature is required to confirm this booking");
        }
        if (!this.verifySignature(keySecret, dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature)) {
          throw new BadRequestException("Invalid payment signature");
        }
      } else if (
        dto.razorpaySignature &&
        !this.verifySignature(keySecret, dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature)
      ) {
        throw new BadRequestException("Invalid payment signature");
      }
    }

    const expectedPaise = Math.round(Number(booking.pricing?.totalAmount ?? 0) * 100);
    if (capturedAmountPaise !== undefined && Math.round(Number(capturedAmountPaise)) !== expectedPaise) {
      this.logger.error(
        `Day Stay ${booking.bookingId}: captured ${capturedAmountPaise} paise but expected ${expectedPaise}`,
      );
      booking.paymentSummary = {
        ...(booking.paymentSummary || {}),
        razorpayPaymentId: dto.razorpayPaymentId,
        reconciliationNote: "AMOUNT_MISMATCH_MANUAL_REVIEW",
        capturedAmountPaise,
      };
      booking.markModified("paymentSummary");
      await booking.save();
      throw new BadRequestException("Captured amount does not match booking total");
    }

    // 4. Hold Expiry Race Handling:
    // If hold expired but customer successfully paid on Razorpay:
    // Check if slot was taken by someone else during the window.
    const now = new Date();
    const isHoldExpired =
      booking.status === "expired" ||
      (booking.reservationExpiresAt && new Date(booking.reservationExpiresAt) < now);
    if (isHoldExpired) {
      // Exclude this booking itself from the availability recount —
      // otherwise its own row counts as a competing occupant.
      const slotStart = new Date(booking.dayStayDetails.slotStartTime);
      const occupied = await this.isSlotTakenByOthers(booking, slotStart);

      if (occupied) {
        await this.cancelAndRefund(booking, dto, customerId);
        throw new ConflictException(
          "Your hold expired before payment was completed and the slot is no longer available. A full refund has been initiated.",
        );
      }
    }

    const fromStatus = booking.status;

    // 5. Update booking state to CONFIRMED
    booking.status = "confirmed";
    booking.paymentStatus = "fully_paid";
    booking.gatewayStatus = "success";
    booking.pricing.amountPaid = booking.pricing.totalAmount;
    booking.paymentSummary = {
      ...(booking.paymentSummary || {}),
      razorpayOrderId: dto.razorpayOrderId,
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
      paidAt: new Date(),
    };

    await booking.save();

    // 6. Audit History Record
    await this.historyModel.create({
      bookingId: booking._id,
      fromStatus,
      toStatus: "confirmed",
      note: `Day Stay payment verified (${dto.razorpayPaymentId}) via ${customerId ? "client" : "webhook"}`,
      actorId: customerId || booking.customerId,
      actorRole: customerId ? "customer" : "system",
    });

    // 7. Notification Outbox Record (Idempotent per booking + event)
    const existingNotification = await this.notificationModel.findOne({
      bookingId: booking._id,
      event: "day_stay_confirmed",
    });

    if (!existingNotification) {
      await this.notificationModel.create({
        userId: booking.customerId,
        bookingId: booking._id,
        ashramId: booking.ashramId,
        event: "day_stay_confirmed",
        title: "Day Stay Confirmed",
        message: `Your Day Rest / Freshen-Up reservation #${booking.reservationNumber} is confirmed. Check-in code: ${booking.checkInCode}`,
        status: "queued",
      });
    }

    return this.confirmedResponse(booking);
  }

  private confirmedResponse(booking: any) {
    return {
      success: true,
      bookingId: booking.bookingId,
      reservationNumber: booking.reservationNumber,
      status: "confirmed",
      checkInCode: booking.checkInCode,
      pricing: booking.pricing,
      slotStartTime: booking.dayStayDetails?.slotStartTime,
      slotEndTime: booking.dayStayDetails?.slotEndTime,
      durationMinutes: booking.dayStayDetails?.durationMinutes,
      bookingType: booking.bookingType,
      dayStayDetails: booking.dayStayDetails,
      rooms: booking.rooms,
    };
  }

  private async isSlotTakenByOthers(booking: any, slotStart: Date): Promise<boolean> {
    const slots = await this.inventoryService.getRoomSlots(
      String(booking.ashramId),
      String(booking.rooms?.[0]?.roomId),
      istDateString(slotStart),
      booking.dayStayDetails.productCode,
      String(booking._id),
    );
    const matchedSlot = slots.find((s) => s.startTime === istTimeString(slotStart));
    // A slot that has since started reads 0 units; that is not "taken by
    // someone else" as long as there is still room for this guest.
    if (!matchedSlot) return true;
    if (matchedSlot.availableUnits > 0) return false;
    return slotStart > new Date();
  }

  /**
   * Cancels a paid booking whose slot was lost and issues a real Razorpay
   * refund. If the gateway refund fails the booking is flagged for manual
   * action instead of claiming the money was returned.
   */
  private async cancelAndRefund(booking: any, dto: DayStayConfirmPaymentDto, customerId?: string) {
    const fromStatus = booking.status;
    const amount = Number(booking.pricing?.totalAmount ?? 0);
    let refundId: string | undefined;
    let refundError: string | undefined;

    if (this.razorpay && dto.razorpayPaymentId && !String(dto.razorpayPaymentId).startsWith("mock_")) {
      try {
        const result: any = await this.razorpay.payments.refund(dto.razorpayPaymentId, {
          amount: Math.round(amount * 100),
          speed: "normal",
          notes: { bookingId: booking.bookingId, reason: "day_stay_slot_lost" },
        });
        refundId = result?.id;
      } catch (err: any) {
        refundError = String(err?.error?.description ?? err?.message ?? "Gateway rejected the refund");
        this.logger.error(`Day Stay refund failed for ${booking.bookingId}: ${refundError}`);
      }
    } else if (!this.demoPaymentsAllowed()) {
      refundError = "Payment gateway not configured";
    }

    booking.status = "cancelled";
    booking.paymentStatus = refundError ? "fully_paid" : "refunded";
    booking.gatewayStatus = "success";
    booking.cancellation = {
      reason: "Payment succeeded after hold expired and slot was acquired by another booking.",
      date: new Date(),
      refundAmount: amount,
      refundTransactionId: refundId,
    };
    booking.paymentSummary = {
      ...(booking.paymentSummary || {}),
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
      reconciliationNote: refundError ? "REFUND_FAILED_MANUAL_ACTION_REQUIRED" : "OVERBOOK_PREVENTED_AUTO_REFUND",
      refundError,
    };
    await booking.save();

    await this.historyModel.create({
      bookingId: booking._id,
      fromStatus,
      toStatus: "cancelled",
      note: refundError
        ? `Hold expired before payment capture. Slot occupied; REFUND FAILED (${refundError}) - manual refund required.`
        : `Hold expired before payment capture. Slot occupied; refund ${refundId ?? "(demo)"} issued.`,
      actorId: customerId || booking.customerId,
      actorRole: "system",
    });
  }

  /**
   * Server-to-server webhook reconciliation entry point.
   * Invoked by PaymentsWebhookService when Razorpay sends `payment.captured` or `order.paid`.
   */
  async confirmPaymentFromWebhook(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    captured?: { amountPaise?: number; currency?: string },
  ): Promise<boolean> {
    const booking = await this.bookingModel.findOne({
      "paymentSummary.razorpayOrderId": razorpayOrderId,
      bookingType: { $in: ["day_rest", "freshen_up"] },
    });

    if (!booking) {
      return false; // Not a Day Stay booking; let PaymentsWebhookService try next module
    }

    try {
      await this.confirmPayment(
        {
          bookingId: booking.bookingId,
          razorpayOrderId,
          razorpayPaymentId,
        },
        undefined,
        captured?.amountPaise,
      );
      return true;
    } catch (err: any) {
      this.logger.error(`Webhook reconciliation error for order ${razorpayOrderId}: ${err.message}`);
      // Handled terminal outcomes (refunded, flagged mismatch, already final): mark event processed.
      if (
        err instanceof ConflictException ||
        err instanceof BadRequestException ||
        booking.status === "confirmed" ||
        booking.status === "cancelled"
      ) {
        return true;
      }
      throw err;
    }
  }
}
