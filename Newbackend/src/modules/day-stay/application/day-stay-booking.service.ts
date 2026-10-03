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
import { Types, type Model } from "mongoose";
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
import { WalletService } from "../../wallet/application/wallet.service";

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
    private readonly wallet: WalletService,
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

    // Wallet first, Razorpay for whatever is left.
    const bookingObjectId = new Types.ObjectId();
    const { walletAmount, gatewayAmount } = await this.wallet.planSplit(
      customerId,
      totalAmount,
      dto.useWallet,
    );
    const bookingType = product.productType || "day_rest";
    const bookingFields = {
      _id: bookingObjectId,
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
      paymentMode: "online",
      specialRequests: dto.specialRequests,
      checkInCode: cCode,
    };
    const holdSummary = {
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
      wallet: { applied: walletAmount, gatewayAmount, total: totalAmount },
    };

    // The wallet covers it all: confirm straight away, no gateway order.
    if (walletAmount > 0 && gatewayAmount <= 0) {
      const confirmed = await this.transactions.run(async (session) => {
        const [doc] = await this.bookingModel.create(
          [
            {
              ...bookingFields,
              status: "confirmed",
              paymentStatus: "fully_paid",
              gatewayStatus: "success",
              reservationExpiresAt: null,
              pricing: {
                basePrice: price,
                roomMrp: product.price,
                effectiveRoomPrice: price,
                gstAmount,
                gstPercent: 18,
                totalAmount,
                amountPaid: totalAmount,
              },
              paymentSummary: {
                method: "wallet",
                walletAmount: totalAmount,
                paidAt: new Date(),
              },
            },
          ],
          { session },
        );
        await this.wallet.spend(
          {
            userId: customerId,
            module: "day_stay",
            sourceId: doc._id,
            amount: totalAmount,
            reference: bId,
            description: `Paid for day stay ${bId}`,
            actorId: customerId,
          },
          session,
        );
        await this.historyModel.create(
          [
            {
              bookingId: doc._id,
              fromStatus: "none",
              toStatus: "confirmed",
              note: "Day Stay paid in full from the Tirvona wallet",
              actorId: customerId,
              actorRole: "customer",
            },
          ],
          { session },
        );
        await this.notificationModel.create(
          [
            {
              userId: customerId,
              bookingId: doc._id,
              ashramId: dto.ashramId,
              event: "day_stay_confirmed",
              title: "Day Stay Confirmed",
              message: `Your Day Rest / Freshen-Up reservation #${resNo} is confirmed. Check-in code: ${cCode}`,
              status: "queued",
            },
          ],
          { session },
        );
        return doc;
      });
      return {
        ...holdSummary,
        walletPaid: true,
        status: "confirmed",
        confirmation: this.confirmedResponse(confirmed),
        reservationExpiresAt: null,
      };
    }

    if (walletAmount > 0)
      await this.wallet.placeHold({
        userId: customerId,
        module: "day_stay",
        sourceId: bookingObjectId,
        amount: walletAmount,
        reference: bId,
      });

    let isDemo = false;
    let rzpOrderId = `mock_order_${Date.now()}`;
    const keyId = this.config.get<string>("razorpayKeyId") || process.env.RAZORPAY_KEY_ID || "";
    try {
      if (this.razorpay) {
        try {
          const order = await this.razorpay.orders.create({
            amount: Math.round(gatewayAmount * 100),
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
      // A simulated order can never be paid for real, so in production it would
      // only lock a slot for nothing. Refuse before anything is written.
      if (isDemo && this.isProduction())
        throw new ServiceUnavailableException(
          "Online payment is temporarily unavailable. Please try again shortly.",
        );
    } catch (error) {
      // Nothing was booked, so give back any wallet share parked above.
      await this.wallet.releaseHold("day_stay", bookingObjectId);
      throw error;
    }

    let bookingDoc: any;
    try {
      bookingDoc = await this.bookingModel.create({
        ...bookingFields,
        status: "pending",
        paymentStatus: "pending",
        gatewayStatus: "pending",
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
          walletAmount,
          gatewayAmount,
        },
      });
    } catch (error) {
      await this.wallet.releaseHold("day_stay", bookingObjectId);
      throw error;
    }

    await this.historyModel.create({
      bookingId: bookingDoc._id,
      fromStatus: "none",
      toStatus: "pending",
      note: `Day Stay slot held for ${duration} mins until ${holdExpiresAt.toISOString()}`,
      actorId: customerId,
      actorRole: "customer",
    });

    return {
      ...holdSummary,
      demo: isDemo,
      keyId,
      razorpayKeyId: keyId,
      razorpayOrderId: rzpOrderId,
      reservationExpiresAt: holdExpiresAt,
    };
  }

  private isProduction(): boolean {
    return this.config.get<string>("nodeEnv") === "production";
  }

  /**
   * The browser's proof that Razorpay took the money: the checkout signature
   * over `order_id|payment_id`, keyed by the API secret.
   *
   * There is no way around it. The only unsigned case is local development
   * with no Razorpay secret configured at all — the same rule parking, aarti
   * and the marketplace apply — and production with a missing secret refuses
   * outright rather than trusting the client.
   */
  private assertClientSignature(dto: DayStayConfirmPaymentDto): void {
    const keySecret = this.config.get<string>("razorpayKeySecret");
    if (!keySecret) {
      if (this.isProduction())
        throw new ServiceUnavailableException("Payments are not configured.");
      return;
    }
    if (!dto.razorpaySignature)
      throw new BadRequestException("Payment signature is required");
    const expected = Buffer.from(
      createHmac("sha256", keySecret)
        .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
        .digest("hex"),
    );
    const actual = Buffer.from(dto.razorpaySignature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      throw new BadRequestException("Invalid payment signature");
  }

  private confirmedResponse(booking: any): any {
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

  /**
   * Confirms a Day Stay booking from the browser checkout callback.
   *
   * Only the caller's own booking is found, the Razorpay order must be the
   * one this booking opened, and the checkout signature must verify. A client
   * can no longer settle a booking by naming it — previously an omitted
   * signature, or ids shaped like `mock_…`/`pay_sim_…`, skipped verification
   * entirely and marked any booking paid.
   */
  async confirmPayment(dto: DayStayConfirmPaymentDto, customerId: string): Promise<any> {
    if (!customerId) throw new NotFoundException("Booking not found");
    const isHexId = typeof dto.bookingId === "string" && /^[0-9a-fA-F]{24}$/.test(dto.bookingId);
    const booking = await this.bookingModel.findOne({
      $or: [{ bookingId: dto.bookingId }, ...(isHexId ? [{ _id: dto.bookingId }] : [])],
      customerId,
      bookingType: { $in: ["day_rest", "freshen_up"] },
    });
    if (!booking) throw new NotFoundException("Booking not found");

    if (booking.status === "confirmed" || booking.paymentStatus === "fully_paid")
      return this.confirmedResponse(booking);

    const openedOrder = booking.paymentSummary?.razorpayOrderId;
    if (!openedOrder || dto.razorpayOrderId !== openedOrder)
      throw new BadRequestException("This payment does not belong to this booking");
    this.assertClientSignature(dto);
    return this.settle(booking, dto, customerId);
  }

  /**
   * Marks a verified payment against the booking. Reached only after the
   * client signature (`confirmPayment`) or the Razorpay webhook signature
   * (`PaymentsWebhookService.verifySignature`) has been checked.
   */
  private async settle(
    booking: any,
    dto: DayStayConfirmPaymentDto,
    customerId?: string,
    capturedAmountPaise?: number,
  ): Promise<any> {
    if (booking.status === "confirmed" || booking.paymentStatus === "fully_paid")
      return this.confirmedResponse(booking);

    // Razorpay collects only the gateway share; the rest comes from the wallet.
    const walletAmount = Number(booking.paymentSummary?.walletAmount ?? 0);
    const expectedPaise =
      Math.round(Number(booking.pricing?.totalAmount ?? 0) * 100) -
      Math.round(walletAmount * 100);
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
          "Your hold expired before payment was completed and the slot is no longer available. The full amount has been added to your Tirvona wallet.",
        );
      }
    }

    const fromStatus = booking.status;

    if (walletAmount > 0) {
      try {
        await this.wallet.spend({
          userId: String(booking.customerId),
          module: "day_stay",
          sourceId: booking._id,
          amount: walletAmount,
          reference: booking.bookingId,
          description: `Paid for day stay ${booking.bookingId}`,
          actorId: customerId ?? null,
        });
      } catch (error) {
        booking.paymentSummary = {
          ...(booking.paymentSummary || {}),
          razorpayPaymentId: dto.razorpayPaymentId,
          reconciliationNote: "WALLET_SHARE_UNAVAILABLE_MANUAL_REVIEW",
        };
        booking.markModified("paymentSummary");
        await booking.save();
        this.logger.error(
          `Day Stay ${booking.bookingId}: wallet share of ${walletAmount} could not be taken after payment`,
        );
        throw error;
      }
    }

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
   * Cancels a paid booking whose slot was lost. The wallet share parked for
   * it goes back to the wallet, and what was paid on Razorpay is credited to
   * the pilgrim's Tirvona wallet — like every other refund — so it is never
   * stuck waiting on a gateway refund.
   */
  private async cancelAndRefund(booking: any, dto: DayStayConfirmPaymentDto, customerId?: string) {
    const fromStatus = booking.status;
    const total = Number(booking.pricing?.totalAmount ?? 0);
    const walletAmount = Number(booking.paymentSummary?.walletAmount ?? 0);
    const gatewayAmount = Math.max(0, Math.round((total - walletAmount) * 100) / 100);

    await this.wallet.releaseHold("day_stay", booking._id);
    const refund = await this.wallet.credit({
      userId: String(booking.customerId),
      amount: gatewayAmount,
      module: "day_stay",
      category: "refund",
      sourceId: booking._id,
      reference: booking.bookingId,
      description: `Refund for day stay ${booking.bookingId}: slot no longer available`,
      idempotencyKey: `refund:day_stay:${String(booking._id)}`,
    });

    booking.status = "cancelled";
    booking.paymentStatus = "refunded";
    booking.gatewayStatus = "success";
    booking.cancellation = {
      reason: "Payment succeeded after hold expired and slot was acquired by another booking.",
      date: new Date(),
      refundAmount: total,
      refundTransactionId: refund ? String(refund._id) : undefined,
      refundMethod: "wallet",
    };
    booking.paymentSummary = {
      ...(booking.paymentSummary || {}),
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
      reconciliationNote: "OVERBOOK_PREVENTED_WALLET_REFUND",
    };
    await booking.save();

    await this.historyModel.create({
      bookingId: booking._id,
      fromStatus,
      toStatus: "cancelled",
      note: `Hold expired before payment capture. Slot occupied; ${total} returned to the Tirvona wallet.`,
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
      // The webhook body was HMAC-verified before dispatch, and the booking
      // was found by the order id Razorpay itself reported.
      await this.settle(
        booking,
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
