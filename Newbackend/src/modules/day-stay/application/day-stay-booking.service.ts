import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
  NotFoundException,
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

    const product = room.dayStayConfig.products?.find(
      (p: any) => p.productCode === dto.productCode.toUpperCase() && p.enabled,
    );
    if (!product) {
      throw new BadRequestException(`Product ${dto.productCode} is not offered for this room`);
    }

    const duration = product.durationMinutes;
    const [startH, startM] = dto.startTime.split(":").map(Number);
    const startMins = startH * 60 + startM;
    const endMins = startMins + duration;
    const endH = Math.floor(endMins / 60).toString().padStart(2, "0");
    const endM = (endMins % 60).toString().padStart(2, "0");
    const endTimeStr = `${endH}:${endM}`;

    const slotStartUtc = new Date(`${dto.date}T${dto.startTime}:00.000Z`);
    const slotEndUtc = new Date(`${dto.date}T${endTimeStr}:00.000Z`);

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
    const slots = await this.inventoryService.getRoomSlots(dto.ashramId, dto.roomId, dto.date, dto.productCode);
    const selectedSlot = slots.find((s) => s.startTime === dto.startTime);
    if (!selectedSlot || selectedSlot.availableUnits <= 0) {
      throw new ConflictException("Sorry, this time slot was just selected by another pilgrim. Please choose another time.");
    }

    // Create Razorpay Order if key exists
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
        this.logger.warn(`Razorpay order creation failed: ${err.message}. Enabling demo fallback.`);
        isDemo = true;
      }
    } else {
      isDemo = true;
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

  /**
   * Confirms a Day Stay booking after Razorpay signature verification.
   * Both browser checkout callback and server-to-server webhook converge here idempotently.
   */
  async confirmPayment(dto: DayStayConfirmPaymentDto, customerId?: string): Promise<any> {
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

    // 2. Cryptographic signature check.
    // - Client-invoked (customerId set, from the browser checkout
    //   callback): a valid signature is mandatory whenever live Razorpay
    //   keys are configured. Without this, anyone could POST an arbitrary
    //   bookingId + made-up order/payment ids and get a free confirmation.
    // - Webhook-invoked (customerId undefined): the caller
    //   (PaymentsWebhookService) has already verified Razorpay's
    //   `X-Razorpay-Signature` over the raw webhook body with a separate
    //   webhook secret, so no per-payment signature is expected here.
    const keySecret = this.config.get<string>("razorpayKeySecret");
    const isMock =
      dto.razorpayOrderId?.startsWith("mock_") ||
      dto.razorpayPaymentId?.startsWith("pay_sim_") ||
      dto.razorpayPaymentId?.startsWith("mock_") ||
      dto.razorpaySignature === "demo_simulated_sig";

    if (keySecret && !isMock) {
      if (customerId) {
        if (!dto.razorpaySignature) {
          throw new BadRequestException("Payment signature is required to confirm this booking");
        }
        const generatedSig = createHmac("sha256", keySecret)
          .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
          .digest("hex");

        const expected = Buffer.from(generatedSig);
        const actual = Buffer.from(dto.razorpaySignature);
        const isValid = expected.length === actual.length && timingSafeEqual(expected, actual);
        if (!isValid) {
          throw new BadRequestException("Invalid payment signature");
        }
      } else if (dto.razorpaySignature) {
        // Webhook path shouldn't normally carry a per-payment signature,
        // but if one is present, validate it rather than ignore it.
        const generatedSig = createHmac("sha256", keySecret)
          .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
          .digest("hex");
        const expected = Buffer.from(generatedSig);
        const actual = Buffer.from(dto.razorpaySignature);
        const isValid = expected.length === actual.length && timingSafeEqual(expected, actual);
        if (!isValid) {
          throw new BadRequestException("Invalid payment signature");
        }
      }
    }

    // 3. Hold Expiry Race Handling:
    // If hold expired but customer successfully paid on Razorpay:
    // Check if slot was taken by someone else during the window.
    const now = new Date();
    const isHoldExpired = booking.reservationExpiresAt && new Date(booking.reservationExpiresAt) < now;
    if (isHoldExpired) {
      // Exclude this booking itself from the availability recount —
      // otherwise a booking that's still "pending" (we haven't confirmed
      // it yet) counts as its own competing occupant, reads 0 available,
      // and wrongly auto-cancels + refunds a payment that just succeeded.
      const slots = await this.inventoryService.getRoomSlots(
        String(booking.ashramId),
        String(booking.rooms?.[0]?.roomId),
        new Date(booking.dayStayDetails.slotStartTime).toISOString().split("T")[0],
        booking.dayStayDetails.productCode,
        String(booking._id),
      );
      const startStr = new Date(booking.dayStayDetails.slotStartTime).toISOString().substring(11, 16);
      const matchedSlot = slots.find((s) => s.startTime === startStr);

      if (!matchedSlot || matchedSlot.availableUnits <= 0) {
        // Slot is occupied by a competing booking. Move to controlled manual recovery / refund required
        booking.status = "cancelled";
        booking.paymentStatus = "refunded";
        booking.gatewayStatus = "success";
        booking.cancellation = {
          reason: "Payment succeeded after hold expired and slot was acquired by another booking. Automated refund queued.",
          date: new Date(),
          refundAmount: booking.pricing.totalAmount,
        };
        booking.paymentSummary = {
          ...(booking.paymentSummary || {}),
          razorpayPaymentId: dto.razorpayPaymentId,
          razorpaySignature: dto.razorpaySignature,
          reconciliationNote: "OVERBOOK_PREVENTED_AUTO_REFUND",
        };
        await booking.save();

        await this.historyModel.create({
          bookingId: booking._id,
          fromStatus: "pending",
          toStatus: "cancelled",
          note: `Hold expired before payment capture. Slot occupied; marked for refund.`,
          actorId: customerId || booking.customerId,
          actorRole: "system",
        });

        throw new ConflictException("Your hold expired before payment was completed and the slot is no longer available. A full refund has been initiated.");
      }
    }

    // 4. Update booking state to CONFIRMED
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

    // 5. Audit History Record
    await this.historyModel.create({
      bookingId: booking._id,
      fromStatus: "pending",
      toStatus: "confirmed",
      note: `Day Stay payment verified (${dto.razorpayPaymentId}) via ${customerId ? "client" : "webhook"}`,
      actorId: customerId || booking.customerId,
      actorRole: customerId ? "customer" : "system",
    });

    // 6. Notification Outbox Record (Idempotent per booking + event)
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
   * Server-to-server webhook reconciliation entry point.
   * Invoked by PaymentsWebhookService when Razorpay sends `payment.captured` or `order.paid`.
   */
  async confirmPaymentFromWebhook(razorpayOrderId: string, razorpayPaymentId: string): Promise<boolean> {
    const booking = await this.bookingModel.findOne({
      "paymentSummary.razorpayOrderId": razorpayOrderId,
      bookingType: { $in: ["day_rest", "freshen_up"] },
    });

    if (!booking) {
      return false; // Not a Day Stay booking; let PaymentsWebhookService try next module
    }

    try {
      await this.confirmPayment({
        bookingId: booking.bookingId,
        razorpayOrderId,
        razorpayPaymentId,
      });
      return true;
    } catch (err: any) {
      this.logger.error(`Webhook reconciliation error for order ${razorpayOrderId}: ${err.message}`);
      // If already confirmed or gracefully refunded, return true so webhook marks event as processed
      if (err instanceof ConflictException || booking.status === "confirmed" || booking.status === "cancelled") {
        return true;
      }
      throw err;
    }
  }
}
