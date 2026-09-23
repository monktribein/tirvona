import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import type { Model } from "mongoose";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { TransactionService } from "../../../common/database/transaction.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { canManageAllAshrams, isAshramOwner } from "../../../common/auth/ashram-access";
import { resolveAshramScope } from "../../../common/auth/ashram-scope";
import {
  BOOKING_REPOSITORY,
  type BookingRepository,
} from "../domain/booking.repository";
import {
  PLATFORM_FEE_GST_PERCENT,
  WHATSAPP_BOOKING_CHANNEL,
  bookingReference,
  checkinCode,
  financialReference,
  reservationReference,
  roundMoney,
} from "../domain/booking.utils";
import type {
  AdminUpdateBookingDto,
  AssignRoomDto,
  BookingDashboardQueryDto,
  CancelBookingDto,
  CheckinDto,
  CheckoutDto,
  ConfirmBookingPaymentDto,
  CreateBookingDto,
  ManualConfirmBookingDto,
  UpdateBookingStatusDto,
} from "../presentation/dtos/booking.dto";
import {
  actorFromUser,
  actorIdentityFields,
  actorOwnerFields,
  bookingBelongsTo,
  bookingOwnerFilter,
  withBookingCustomer,
  withBookingCustomers,
  type BookingActor,
} from "../domain/booking-customer";
import { computeCancellationRefund } from "../domain/booking-refund";
import { BookingIdentityService } from "./booking-identity.service";
import { BookingPricingService } from "./booking-pricing.service";
import { bookingConfirmedOutboxEvent } from "./booking-notification.factory";
import { normalizeWhatsAppNumber } from "../../../integrations/whatsapp/utils/whatsapp-phone.util";

/**
 * Matches a coupon redemption to the identity that made it. A redemption row
 * names its owner `userId` (website) or `whatsappCustomerId` (WhatsApp), so
 * the per-customer cap has to be counted against the right field — counting
 * the wrong one would silently give every WhatsApp guest an unlimited cap.
 */
const redemptionOwnerFilter = (actor: BookingActor): Record<string, unknown> =>
  actor.whatsappCustomerId
    ? { whatsappCustomerId: actor.whatsappCustomerId }
    : { userId: actor.userId };

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly repository: BookingRepository,
    private readonly transactions: TransactionService,
    private readonly pricing: BookingPricingService,
    private readonly identity: BookingIdentityService,
    private readonly config: ConfigService,
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel("BookingStatusHistory") private readonly history: Model<any>,
    @InjectModel("BookingGuestDetail") private readonly guests: Model<any>,
    @InjectModel("BookingInventoryHold")
    private readonly inventoryHolds: Model<any>,
    @InjectModel("BookingRoomAssignment")
    private readonly assignments: Model<any>,
    @InjectModel("BookingCheckin") private readonly checkins: Model<any>,
    @InjectModel("BookingCheckout") private readonly checkouts: Model<any>,
    @InjectModel("BookingPayment") private readonly payments: Model<any>,
    @InjectModel("BookingPaymentEvent")
    private readonly paymentEvents: Model<any>,
    @InjectModel("BookingTransaction")
    private readonly financialTransactions: Model<any>,
    @InjectModel("BookingLedger") private readonly ledger: Model<any>,
    @InjectModel("BookingCommission") private readonly commissions: Model<any>,
    @InjectModel("BookingRefund") private readonly refunds: Model<any>,
    @InjectModel("BookingInvoice") private readonly invoices: Model<any>,
    @InjectModel("BookingReceipt") private readonly receipts: Model<any>,
    @InjectModel("BookingTaxRecord") private readonly taxes: Model<any>,
    @InjectModel("BookingOfferRedemption")
    private readonly redemptions: Model<any>,
    @InjectModel("BookingCoupon") private readonly coupons: Model<any>,
    @InjectModel("BookingNotification")
    private readonly notifications: Model<any>,
    @InjectModel("BookingAuditLog") private readonly audits: Model<any>,
    @InjectModel("HousekeepingUnit") private readonly housekeeping: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("PlatformSettings") private readonly settings: Model<any>,
    @InjectModel("User") private readonly userModel: Model<any>,
    @InjectModel("Room") private readonly roomModel: Model<any>,
  ) {}

  private async scopedAshrams(
    user: AuthenticatedUser,
  ): Promise<string[] | null> {
    if (
      ["national_admin", "support"].includes(user.role) ||
      canManageAllAshrams(user)
    )
      return null;
    if (["state_admin", "government_admin", "govt_admin"].includes(user.role)) {
      if (!user.state) return [];
      return (
        await this.ashrams
          .find({ "address.state": user.state, deletedAt: null })
          .select("_id")
          .lean()
      ).map((a: any) => String(a._id));
    }
    if (["district_officer", "inspector"].includes(user.role)) {
      if (!user.state || !user.district) return [];
      return (
        await this.ashrams
          .find({
            "address.state": user.state,
            "address.district": user.district,
            deletedAt: null,
          })
          .select("_id")
          .lean()
      ).map((a: any) => String(a._id));
    }
    return resolveAshramScope(user, this.ashrams);
  }

  private roomUnits(row: any): { roomId: string; units: number }[] {
    if (Array.isArray(row.rooms) && row.rooms.length)
      return row.rooms.map((r: any) => ({
        roomId: String(r.roomId?._id ?? r.roomId),
        units: r.units,
      }));
    return [{ roomId: String(row.roomId), units: row.roomsBookedCount }];
  }

  private resolveRoomNumberAssignments(
    row: any,
    input: { roomNumbers?: string[]; rooms?: { roomId: string; roomNumbers: string[] }[] },
  ): { roomId: string; roomNumber: string }[] {
    const units = this.roomUnits(row);
    const totalUnits = units.reduce((sum, u) => sum + u.units, 0);

    if (Array.isArray(input.rooms) && input.rooms.length) {
      const unitMap = new Map(units.map((u) => [u.roomId, u.units]));
      const seen = new Set<string>();
      const result: { roomId: string; roomNumber: string }[] = [];
      for (const group of input.rooms) {
        const roomId = String(group.roomId);
        if (!unitMap.has(roomId))
          throw new BadRequestException(
            "One or more room categories do not belong to this booking",
          );
        if (seen.has(roomId))
          throw new BadRequestException(
            "Duplicate room category in room number assignment",
          );
        seen.add(roomId);
        const numbers = (group.roomNumbers || []).map((n) => n.trim()).filter(Boolean);
        const expected = unitMap.get(roomId)!;
        if (numbers.length !== expected)
          throw new BadRequestException(
            `Expected ${expected} room number(s) for this room category, got ${numbers.length}`,
          );
        for (const roomNumber of numbers) result.push({ roomId, roomNumber });
      }
      if (seen.size !== unitMap.size)
        throw new BadRequestException(
          "Room numbers must be provided for every room category in this booking",
        );
      return result;
    }

    const flat = (input.roomNumbers || []).map((n) => n.trim()).filter(Boolean);
    if (units.length > 1)
      throw new BadRequestException(
        "This booking has multiple room categories; provide room numbers grouped per category",
      );
    if (flat.length !== totalUnits)
      throw new BadRequestException(
        `Expected ${totalUnits} room number(s) for this booking, got ${flat.length}`,
      );
    const onlyRoomId = units[0]?.roomId;
    return flat.map((roomNumber) => ({ roomId: onlyRoomId, roomNumber }));
  }

  private async assertCanManage(
    user: AuthenticatedUser,
    booking: any,
  ): Promise<void> {
    if (user.role === "support" || canManageAllAshrams(user))
      return;
    if (!isAshramOwner(user) && !["manager", "reception"].includes(user.role))
      throw new ForbiddenException("You cannot manage ashram bookings.");
    const scope = await this.scopedAshrams(user);
    if (
      scope === null ||
      !scope.includes(String(booking.ashramId?._id ?? booking.ashramId))
    )
      throw new ForbiddenException(
        "You do not have access to this ashram booking.",
      );
  }

  private async assertCanView(
    user: AuthenticatedUser,
    booking: any,
  ): Promise<void> {
    const scope = await this.scopedAshrams(user);
    if (scope === null) return;
    if (!scope.includes(String(booking.ashramId?._id ?? booking.ashramId)))
      throw new ForbiddenException(
        "You do not have access to this ashram booking.",
      );
  }

  private async issueActiveCheckinCode(): Promise<string> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = checkinCode();
      const collision = await this.bookings.exists({
        checkInCode: code,
        status: { $in: ["pending", "confirmed"] },
        deletedAt: null,
      });
      if (!collision) return code;
    }
    throw new ServiceUnavailableException(
      "Could not issue a check-in code. Please retry the booking.",
    );
  }

  async quote(dto: CreateBookingDto): Promise<any> {
    const quote = await this.pricing.quote(dto);
    return {
      pricing: quote.pricing,
      // Additive: the itemised services and payment summary the pricing
      // service already computes, so a client (the website or WhatsApp) can
      // show each line without recomputing any of it.
      services: quote.services,
      paymentSummary: quote.paymentSummary,
      nights: quote.dates.length,
      coupon: quote.coupon
        ? {
            _id: quote.coupon._id,
            promoCode: quote.coupon.promoCode,
            offerTitle: quote.coupon.offerTitle,
            discountType: quote.coupon.discountType,
            discountValue: quote.coupon.discountValue,
            remainingRedemptions: quote.coupon.remainingRedemptions,
          }
        : null,
    };
  }

  /**
   * Holds inventory and creates a pending booking.
   *
   * Takes a `BookingActor` rather than an `AuthenticatedUser` because the
   * customer is not always a website account: a WhatsApp guest has no `users`
   * row, so their identity travels as `whatsappCustomerId`. Everything else —
   * pricing, the inventory hold, coupon reservation, the identity code, the
   * outbox row and the audit trail — is identical whichever channel called,
   * which is what makes a WhatsApp booking an ordinary Tirvona booking.
   */
  async create(actor: BookingActor, dto: CreateBookingDto): Promise<any> {
    const quote = await this.pricing.quote(dto);
    const code = await this.issueActiveCheckinCode();
    const normalizedRooms = Array.isArray(dto.rooms) && dto.rooms.length
      ? dto.rooms
      : dto.roomId
        ? [{ roomId: dto.roomId, units: Math.max(1, Number(dto.roomsBookedCount) || 1) }]
        : [];

    const booking = await this.transactions.run(async (session) => {
      for (const reqRoom of normalizedRooms) {
        const foundRoom = quote.rooms?.find((r: any) => String(r._id) === String(reqRoom.roomId)) || quote.room;
        // The room's own unit count, exactly as the public calendar reads it.
        // `capacity` is guests per room, not rooms, and a 0 is a real 0 — an
        // unknown count is treated as nothing to sell, never as a made-up 10.
        const capacity = Number(foundRoom?.totalInventory ?? foundRoom?.inventory);
        await this.repository.holdInventory({
          ashramId: dto.ashramId,
          roomId: reqRoom.roomId,
          dates: quote.dates,
          count: reqRoom.units,
          capacity,
          session,
        });
      }
      if (quote.coupon) {
        const used = await this.redemptions
          .countDocuments({
            couponId: quote.coupon._id,
            // Counted against whichever identity is booking, so a WhatsApp
            // guest gets the same per-customer cap as a website account.
            ...redemptionOwnerFilter(actor),
            status: { $in: ["reserved", "redeemed"] },
          })
          .session(session);
        if (used >= Number(quote.coupon.perUserLimit ?? 1))
          throw new ConflictException(
            "You have already used this offer the maximum number of times",
          );
        const reserved = await this.coupons.updateOne(
          { _id: quote.coupon._id, remainingRedemptions: { $gt: 0 } },
          { $inc: { remainingRedemptions: -1, redemptionsCount: 1 } },
          { session },
        );
        if (!reserved.modifiedCount)
          throw new ConflictException("This offer is no longer available");
      }
      const identityCode = await this.identity.issueForBooking(
        dto.ashramId,
        session,
      );
      const totalUnits = normalizedRooms.reduce((sum, r) => sum + r.units, 0);
      const roomsWithSnapshot = normalizedRooms.map((reqRoom) => {
        const snapshot = quote.roomsSnapshot?.find(
          (s: any) => String(s.roomId) === String(reqRoom.roomId),
        );
        return {
          roomId: reqRoom.roomId,
          units: reqRoom.units,
          mrp: snapshot?.mrp ?? 0,
          discountPercentage: snapshot?.discountPercentage ?? 0,
          discountAmount: snapshot?.discountAmount ?? 0,
          sellingPrice: snapshot?.sellingPrice ?? 0,
        };
      });

      const [created] = await this.bookings.create(
        [
          {
            bookingId: bookingReference(),
            reservationNumber: reservationReference(),
            identityCode,
            ...actorIdentityFields(actor),
            channel: actor.channel,
            ashramId: dto.ashramId,
            rooms: roomsWithSnapshot,
            roomsBookedCount: totalUnits,
            checkInDate: new Date(dto.checkInDate),
            checkOutDate: new Date(dto.checkOutDate),
            occupiedDates: quote.dates,
            guestsCount: dto.guestsCount,
            services: quote.services,
            pricing: quote.pricing,
            paymentSummary: quote.paymentSummary,
            offerId: quote.coupon?._id,
            appliedOfferId: quote.coupon?._id,
            offerName: quote.coupon?.offerTitle,
            promoCode: quote.coupon?.promoCode,
            discountType: quote.coupon?.discountType,
            discountPercentage:
              quote.coupon?.discountType === "Percentage"
                ? quote.coupon.discountValue
                : 0,
            reservationExpiresAt: new Date(
              Date.now() + Number(quote.policy?.holdMinutes ?? 10) * 60_000,
            ),
            paymentMode: "online",
            status: "pending",
            paymentStatus: "pending",
            gatewayStatus: "not_initiated",
            checkInCode: code,
            specialRequests: dto.specialRequests ?? "",
          },
        ],
        { session },
      );
      const holdDocs = normalizedRooms.map((reqRoom) => ({
        bookingId: created._id,
        ashramId: dto.ashramId,
        roomId: reqRoom.roomId,
        dates: quote.dates,
        units: reqRoom.units,
        state: "held",
        expiresAt: created.reservationExpiresAt,
      }));
      // Mongoose refuses create() with a session on >1 document unless
      // ordered is explicit; multi-room-category bookings produce one hold
      // doc per room, so this array can have length > 1.
      await this.inventoryHolds.create(holdDocs, { session, ordered: true });
      await Promise.all([
        this.history.create(
          [
            {
              bookingId: created._id,
              toStatus: "pending",
              note: "Inventory held; awaiting payment",
              actorId: actor.userId,
              actorRole: actor.role,
            },
          ],
          { session },
        ),
        this.guests.create(
          [
            {
              bookingId: created._id,
              ...actorIdentityFields(actor),
              guests: dto.guests ?? [],
            },
          ],
          { session },
        ),
        this.notifications.create(
          [
            {
              ...actorOwnerFields(actor),
              bookingId: created._id,
              ashramId: dto.ashramId,
              event: "booking_held",
              title: "Reservation held",
              message: `Complete payment for ${created.bookingId} before the hold expires.`,
              // A WhatsApp guest has no account phone to fall back on, so the
              // number they are reachable on travels on the row itself.
              ...(actor.phone
                ? { recipientPhone: normalizeWhatsAppNumber(actor.phone) }
                : {}),
            },
          ],
          { session },
        ),
        this.audits.create(
          [
            {
              userId: actor.userId,
              action: "BOOKING_HOLD_CREATED",
              bookingId: created._id,
              ashramId: dto.ashramId,
              details: {
                channel: actor.channel,
                ...(actor.whatsappCustomerId
                  ? { whatsappCustomerId: actor.whatsappCustomerId }
                  : {}),
              },
              after: {
                status: "pending",
                totalAmount: quote.pricing.totalAmount,
              },
            },
          ],
          { session },
        ),
      ]);
      if (quote.coupon)
        await this.redemptions.create(
          [
            {
              couponId: quote.coupon._id,
              bookingId: created._id,
              ...actorOwnerFields(actor),
              ashramId: dto.ashramId,
              promoCode: quote.coupon.promoCode,
              bookingAmount: quote.pricing.originalAmount,
              discountAmount: quote.pricing.discountAmount,
              status: "reserved",
              reservedAt: new Date(),
            },
          ],
          { session },
        );
      return created;
    });
    return booking;
  }

  /**
   * The actor may pay for this booking if it is theirs, or if they are staff
   * with management rights over the ashram.
   *
   * A WhatsApp guest only ever satisfies the first branch: they have no
   * website principal, so there are no roles to check and `assertCanManage`
   * is not reachable for them. Ownership is compared against whichever
   * identity the booking actually carries, never against a reference supplied
   * by the caller.
   */
  private async assertCanPayFor(
    actor: BookingActor,
    booking: any,
  ): Promise<void> {
    if (bookingBelongsTo(booking, actor)) return;
    if (!actor.principal)
      throw new ForbiddenException("This booking belongs to someone else.");
    await this.assertCanManage(actor.principal, booking);
  }

  async paymentOrder(id: string, actor: BookingActor): Promise<any> {
    const booking = await this.bookings.findOne({ _id: id });
    if (!booking) throw new NotFoundException("Booking not found");
    await this.assertCanPayFor(actor, booking);
    if (booking.paymentStatus === "fully_paid")
      throw new BadRequestException("Booking is already paid");
    if (
      booking.status !== "pending" ||
      booking.reservationExpiresAt < new Date()
    )
      throw new BadRequestException("Reservation hold has expired");
    const keyId = this.config.get<string>("razorpayKeyId");
    const keySecret = this.config.get<string>("razorpayKeySecret");
    if (!keyId || !keySecret)
      throw new ServiceUnavailableException(
        "Razorpay is not configured. Real payment is required for booking confirmation.",
      );
    const amountPaise = Math.round(booking.pricing.totalAmount * 100);
    // One open order per booking. A Razorpay order can be paid only once, so
    // handing the same order back on a repeat call (a re-opened payment page,
    // a retried tap) means a guest can never end up paying two different
    // orders for one booking — the second of which would confirm nothing.
    const openOrder = await this.payments
      .findOne({
        bookingId: booking._id,
        status: "pending",
        "gateway.provider": "razorpay",
        "gateway.orderId": { $exists: true, $ne: null },
        amount: booking.pricing.totalAmount,
      })
      .sort({ createdAt: -1 })
      .lean();
    if (openOrder?.gateway?.orderId)
      return {
        demo: false,
        data: {
          orderId: openOrder.gateway.orderId,
          amount: amountPaise,
          currency: "INR",
          keyId,
        },
      };
    const gateway = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
    const order = await gateway.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: booking.bookingId,
    });
    await this.payments.create({
      bookingId: booking._id,
      // The payment is recorded against the identity that is paying, which
      // for a WhatsApp guest is their WhatsApp customer record.
      ...actorOwnerFields(actor),
      ashramId: booking.ashramId,
      amount: booking.pricing.totalAmount,
      method: "razorpay",
      status: "pending",
      gateway: { orderId: order.id, provider: "razorpay" },
    });
    await this.bookings.updateOne(
      { _id: booking._id },
      { $set: { gatewayStatus: "pending" } },
    );
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

  private signatureValid(dto: ConfirmBookingPaymentDto): boolean {
    const keySecret = this.config.get<string>("razorpayKeySecret");
    if (!keySecret) return false;
    if (
      !dto.razorpay_order_id ||
      !dto.razorpay_payment_id ||
      !dto.razorpay_signature
    )
      return false;
    const expected = Buffer.from(
      createHmac("sha256", keySecret)
        .update(`${dto.razorpay_order_id}|${dto.razorpay_payment_id}`)
        .digest("hex"),
    );
    const actual = Buffer.from(dto.razorpay_signature);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  /**
   * Refuses a payment that cannot be shown to belong to this booking.
   *
   * A valid Razorpay signature only proves that an (order, payment) pair is
   * genuine for this merchant — not that the order was created for *this*
   * booking. Without this check a real, cheap payment made against another
   * order could be presented to confirm a different, dearer booking. Every
   * fact compared here is read from the server's own records, never from the
   * browser: the order id must match the pending payment this service created
   * for the booking, and that payment's amount must equal the booking's
   * authoritative total.
   */
  private assertPaymentBoundToBooking(
    booking: any,
    payment: any,
    gateway?: { amountPaise?: number; currency?: string },
  ): void {
    if (!payment)
      throw new BadRequestException(
        "This payment does not belong to this booking",
      );
    if (payment.status === "success")
      throw new ConflictException("Booking is already paid");
    if (payment.status !== "pending")
      throw new BadRequestException("This payment can no longer be confirmed");
    if (String(payment.bookingId) !== String(booking._id))
      throw new BadRequestException(
        "This payment does not belong to this booking",
      );
    const expectedPaise = Math.round(
      Number(booking.pricing?.totalAmount) * 100,
    );
    if (
      !Number.isFinite(expectedPaise) ||
      expectedPaise <= 0 ||
      Math.round(Number(payment.amount) * 100) !== expectedPaise
    )
      throw new BadRequestException(
        "The payment amount does not match this booking",
      );
    // The webhook carries what Razorpay actually captured; the client
    // callback does not, and is covered by the order having been created for
    // exactly `expectedPaise`.
    if (
      gateway?.amountPaise !== undefined &&
      Math.round(Number(gateway.amountPaise)) !== expectedPaise
    )
      throw new BadRequestException(
        "The captured amount does not match this booking",
      );
    if (gateway?.currency && gateway.currency.toUpperCase() !== "INR")
      throw new BadRequestException("Unexpected payment currency");
  }

  private async recordRejectedPayment(
    bookingId: string,
    dto: ConfirmBookingPaymentDto,
    reason: string,
  ): Promise<void> {
    await this.paymentEvents
      .updateOne(
        {
          provider: "razorpay",
          eventId: dto.razorpay_payment_id ?? financialReference("REJECTED"),
        },
        {
          $setOnInsert: {
            provider: "razorpay",
            eventType: "payment_rejected",
            bookingId,
            signatureVerified: true,
            payload: dto,
            status: "failed",
            processingError: reason,
            processedAt: new Date(),
          },
        },
        { upsert: true },
      )
      .catch((error: unknown) =>
        this.logger.warn(
          `Could not record rejected payment for ${bookingId}: ${String(error)}`,
        ),
      );
  }

  async confirmPayment(
    id: string,
    actor: BookingActor,
    dto: ConfirmBookingPaymentDto,
    gateway?: { amountPaise?: number; currency?: string },
  ): Promise<any> {
    if (!this.signatureValid(dto)) {
      await this.paymentEvents.updateOne(
        {
          provider: "razorpay",
          eventId: dto.razorpay_payment_id ?? financialReference("FAILED"),
        },
        {
          $setOnInsert: {
            provider: "razorpay",
            eventType: "payment_verification_failed",
            bookingId: id,
            signatureVerified: false,
            payload: dto,
            status: "failed",
            processingError: "Signature mismatch",
            processedAt: new Date(),
          },
        },
        { upsert: true },
      );
      await this.notifications.create({
        ...actorOwnerFields(actor),
        bookingId: id,
        event: "payment_failed",
        title: "Payment failed",
        message: "Your recent payment for the ashram booking failed. Tap to retry.",
        channel: "in_app",
        status: "queued",
        pushEnabled: true,
        data: { bookingId: String(id) },
        meta: { correlationId: `booking:${id}:payment_failed` },
      });
      throw new BadRequestException("Payment signature verification failed");
    }
    return this.transactions.run(async (session) => {
      if (dto.idempotencyKey) {
        const prior = await this.payments
          .findOne({
            idempotencyKey: dto.idempotencyKey,
            // Scoped to this booking: a key reused against another booking
            // must never replay that booking's result.
            bookingId: id,
            status: "success",
          })
          .session(session);
        if (prior)
          return {
            booking: await this.bookings
              .findById(prior.bookingId)
              .session(session),
            payment: prior,
          };
      }
      const booking = await this.bookings
        .findOne({ _id: id })
        .session(session);
      if (!booking) throw new NotFoundException("Booking not found");
      await this.assertCanPayFor(actor, booking);
      if (booking.paymentStatus === "fully_paid")
        throw new ConflictException("Booking is already paid");

      // Bind the Razorpay order to *this* booking's pending payment before
      // anything is confirmed or any inventory is touched.
      const payment = await this.payments
        .findOne({
          bookingId: booking._id,
          "gateway.orderId": dto.razorpay_order_id,
        })
        .session(session);
      try {
        this.assertPaymentBoundToBooking(booking, payment, gateway);
      } catch (error) {
        if (!(error instanceof ConflictException))
          await this.recordRejectedPayment(
            String(booking._id),
            dto,
            error instanceof Error ? error.message : "Payment rejected",
          );
        throw error;
      }

      const holdLapsed =
        booking.status !== "pending" ||
        (booking.reservationExpiresAt &&
          booking.reservationExpiresAt < new Date());

      if (holdLapsed) {
        if (["cancelled", "refunded"].includes(booking.status))
          throw new BadRequestException(
            "This booking was cancelled; the payment will be refunded",
          );
        for (const room of this.roomUnits(booking))
          await this.repository.holdInventory({
            ashramId: String(booking.ashramId),
            roomId: room.roomId,
            dates: booking.occupiedDates,
            count: room.units,
            capacity: room.units,
            session,
          });
        booking.status = "pending";
        booking.reservationExpiresAt = new Date(Date.now() + 15 * 60_000);
        await this.audits.create(
          [
            {
              userId: actor.userId,
              action: "BOOKING_HOLD_RECOVERED_ON_PAYMENT",
              bookingId: booking._id,
              ashramId: booking.ashramId,
              details: {
                note: "Payment verified after the hold lapsed; inventory re-acquired",
              },
            },
          ],
          { session },
        );
      }

      for (const room of this.roomUnits(booking))
        await this.repository.confirmInventory({
          roomId: room.roomId,
          dates: booking.occupiedDates,
          count: room.units,
          session,
        });
      await this.inventoryHolds.updateMany(
        { bookingId: booking._id, state: "held" },
        {
          $set: {
            state: "confirmed",
            confirmedAt: new Date(),
            expiresAt: null,
          },
        },
        { session },
      );
      payment.status = "success";
      payment.paidAt = new Date();
      payment.transactionId =
        dto.razorpay_payment_id ??
        dto.transactionId ??
        financialReference("BKPAY");
      payment.idempotencyKey = dto.idempotencyKey;
      payment.gateway = {
        orderId: dto.razorpay_order_id,
        paymentId: dto.razorpay_payment_id,
        signature: dto.razorpay_signature,
        provider: this.config.get<string>("razorpayKeySecret")
          ? "razorpay"
          : "demo",
      };
      await payment.save({ session });
      await this.paymentEvents.updateOne(
        {
          provider: this.config.get<string>("razorpayKeySecret")
            ? "razorpay"
            : "demo",
          eventId: payment.transactionId,
        },
        {
          $setOnInsert: {
            provider: this.config.get<string>("razorpayKeySecret")
              ? "razorpay"
              : "demo",
            eventType: "payment_verified",
            bookingId: booking._id,
            paymentId: payment._id,
            signatureVerified: true,
            payload: dto,
            status: "processed",
            processedAt: new Date(),
          },
        },
        { upsert: true, session },
      );
      const ashram = await this.ashrams
        .findById(booking.ashramId)
        .session(session);
      const policy = await this.pricing["policies"]
        .findOne({
          $or: [
            { scope: "ashram", ashramId: booking.ashramId },
            { scope: "platform" },
          ],
          isActive: true,
        })
        .sort({ scope: 1 })
        .lean();
      const platform = await this.settings.findOne({ key: "main" }).lean();
      const percent = Number(
        policy?.platformCommissionPercent ??
          platform?.bookingCommissionPercent ??
          10,
      );
      const commissionAmount =
        Math.round(((booking.pricing.totalAmount * percent) / 100) * 100) / 100;
      booking.status = "confirmed";
      booking.paymentStatus = "fully_paid";
      booking.gatewayStatus = "success";
      booking.paymentMode = "online";
      booking.pricing.amountPaid = booking.pricing.totalAmount;
      booking.reservationExpiresAt = null;
      await booking.save({ session });
      const confirmedNotification = bookingConfirmedOutboxEvent({
        ...actorOwnerFields(actor),
        customerPhone: actor.phone,
        booking,
        payment,
      });
      const [transaction] = await this.financialTransactions.create(
        [
          {
            bookingId: booking._id,
            paymentId: payment._id,
            ashramId: booking.ashramId,
            ownerId: ashram.ownerId,
            type: "booking",
            direction: "credit",
            amount: booking.pricing.totalAmount,
            reference: financialReference("BKTXN"),
            description: `Ashram booking ${booking.bookingId}`,
            recordedBy: actor.userId,
          },
        ],
        { session },
      );
      await Promise.all([
        this.ledger.create(
          [
            {
              account: "booking_clearing",
              bookingId: booking._id,
              ashramId: booking.ashramId,
              ownerId: ashram.ownerId,
              transactionId: transaction._id,
              debit: 0,
              credit: booking.pricing.totalAmount,
              reference: transaction.reference,
            },
          ],
          { session },
        ),
        this.commissions.create(
          [
            {
              bookingId: booking._id,
              ashramId: booking.ashramId,
              ownerId: ashram.ownerId,
              grossAmount: booking.pricing.totalAmount,
              commissionPercent: percent,
              commissionAmount,
              ownerEarning: booking.pricing.totalAmount - commissionAmount,
              settlementStatus: "pending",
            },
          ],
          { session },
        ),
        this.history.create(
          [
            {
              bookingId: booking._id,
              fromStatus: "pending",
              toStatus: "confirmed",
              note: "Payment verified",
              actorId: actor.userId,
              actorRole: actor.role,
            },
          ],
          { session },
        ),
        this.notifications.create(
          [confirmedNotification],
          { session },
        ),
        this.audits.create(
          [
            {
              userId: actor.userId,
              action: "BOOKING_PAYMENT_SUCCESS",
              bookingId: booking._id,
              ashramId: booking.ashramId,
              details: {
                paymentId: payment._id,
                transactionId: payment.transactionId,
              },
            },
          ],
          { session },
        ),
        this.redemptions.updateOne(
          { bookingId: booking._id, status: "reserved" },
          { $set: { status: "redeemed", redeemedAt: new Date() } },
          { session },
        ),
      ]);
      this.logger.log(
        JSON.stringify({
          event: "booking.outbox_event_staged",
          eventType: confirmedNotification.event,
          bookingId: String(booking._id),
          correlationId: confirmedNotification.meta.correlationId,
          hasRecipientPhone: Boolean(confirmedNotification.recipientPhone),
        }),
      );
      const gstPercent = Number(
        booking.pricing.gstPercent ?? PLATFORM_FEE_GST_PERCENT,
      );
      const invoiceNo = financialReference("INV");
      const [invoice] = await this.invoices.create(
        [
          {
            invoiceNumber: invoiceNo,
            bookingId: booking._id,
            ...actorIdentityFields(actor),
            ashramId: booking.ashramId,
            lineItems: [
              {
                description: "Ashram stay and selected services",
                quantity: 1,
                unitAmount: booking.pricing.originalAmount,
                totalAmount: booking.pricing.originalAmount,
                taxRate: 0,
                taxAmount: 0,
              },
              ...(booking.pricing.platformFee > 0
                ? [
                    {
                      description: "Tirvona platform fee",
                      quantity: 1,
                      unitAmount: booking.pricing.platformFee,
                      totalAmount: booking.pricing.platformFee,
                      taxRate: gstPercent,
                      taxAmount: booking.pricing.gstAmount,
                    },
                  ]
                : []),
            ],
            subtotal: roundMoney(
              booking.pricing.originalAmount + booking.pricing.platformFee,
            ),
            taxAmount: booking.pricing.gstAmount,
            discountAmount: booking.pricing.discountAmount,
            donationAmount: booking.pricing.donationAmount,
            totalAmount: booking.pricing.totalAmount,
          },
        ],
        { session },
      );
      await Promise.all([
        this.receipts.create(
          [
            {
              receiptNumber: financialReference("RCT"),
              bookingId: booking._id,
              paymentId: payment._id,
              amount: payment.amount,
              method: payment.method,
            },
          ],
          { session },
        ),
        this.taxes.create(
          [
            {
              bookingId: booking._id,
              invoiceId: invoice._id,
              ashramId: booking.ashramId,
              taxableAmount:
                booking.pricing.gstTaxableAmount ??
                booking.pricing.platformFee ??
                0,
              gstPercent,
              cgst: roundMoney(booking.pricing.gstAmount / 2),
              sgst: roundMoney(
                booking.pricing.gstAmount - roundMoney(booking.pricing.gstAmount / 2),
              ),
              igst: 0,
              totalTax: booking.pricing.gstAmount,
              taxPeriod: new Date().toISOString().slice(0, 7),
            },
          ],
          { session },
        ),
      ]);
      return { booking, payment, invoice };
    });
  }

  async manualConfirm(
    id: string,
    user: AuthenticatedUser,
    dto: ManualConfirmBookingDto,
  ): Promise<any> {
    return this.transactions.run(async (session) => {
      const booking = await this.bookings
        .findOne({ _id: id })
        .session(session);
      if (!booking) throw new NotFoundException("Booking not found");
      await this.assertCanManage(user, booking);

      if (booking.paymentStatus === "fully_paid")
        throw new ConflictException("Booking is already paid");

      const holdLapsed =
        booking.status !== "pending" ||
        (booking.reservationExpiresAt &&
          booking.reservationExpiresAt < new Date());

      if (holdLapsed) {
        if (["cancelled", "refunded"].includes(booking.status))
          throw new BadRequestException(
            "This booking was cancelled; cannot confirm payment",
          );
        for (const room of this.roomUnits(booking))
          await this.repository.holdInventory({
            ashramId: String(booking.ashramId),
            roomId: room.roomId,
            dates: booking.occupiedDates,
            count: room.units,
            capacity: room.units,
            session,
          });
      }

      for (const room of this.roomUnits(booking))
        await this.repository.confirmInventory({
          roomId: room.roomId,
          dates: booking.occupiedDates,
          count: room.units,
          session,
        });

      await this.inventoryHolds.updateMany(
        { bookingId: booking._id, state: "held" },
        {
          $set: {
            state: "confirmed",
            confirmedAt: new Date(),
            expiresAt: null,
          },
        },
        { session },
      );

      let payment = await this.payments
        .findOne({ bookingId: booking._id, status: "pending" })
        .sort({ createdAt: -1 })
        .session(session);

      if (!payment)
        [payment] = await this.payments.create(
          [
            {
              bookingId: booking._id,
              userId: user.id,
              ashramId: booking.ashramId,
              amount: booking.pricing.totalAmount,
              method: dto.paymentMode,
              status: "pending",
            },
          ],
          { session },
        );

      payment.status = "success";
      payment.paidAt = new Date();
      payment.transactionId =
        dto.transactionReference ?? financialReference("BKPAY");
      payment.method = dto.paymentMode;
      payment.gateway = {
        provider: "manual",
        note: dto.note,
      };
      await payment.save({ session });

      const ashram = await this.ashrams
        .findById(booking.ashramId)
        .session(session);
      const policy = await this.pricing["policies"]
        .findOne({
          $or: [
            { scope: "ashram", ashramId: booking.ashramId },
            { scope: "platform" },
          ],
          isActive: true,
        })
        .sort({ scope: 1 })
        .lean();
      const platform = await this.settings.findOne({ key: "main" }).lean();
      const percent = Number(
        policy?.platformCommissionPercent ??
          platform?.bookingCommissionPercent ??
          10,
      );
      const commissionAmount =
        Math.round(((booking.pricing.totalAmount * percent) / 100) * 100) / 100;

      booking.status = "confirmed";
      booking.paymentStatus = "fully_paid";
      booking.gatewayStatus = "success";
      booking.paymentMode = dto.paymentMode;
      booking.pricing.amountPaid = booking.pricing.totalAmount;
      booking.reservationExpiresAt = null;
      await booking.save({ session });

      // The confirmation is addressed to whoever owns the booking, never to
      // the staff member confirming it. A WhatsApp guest has no `users` row,
      // so their number comes from their WhatsApp customer record.
      let customerPhone = "";
      if (booking.customerId) {
        const customer = await this.bookings.db
          .model("User")
          .findById(booking.customerId)
          .session(session);
        customerPhone = customer?.phone || "";
      } else if (booking.whatsappCustomerId) {
        const guest = await this.bookings.db
          .model("WhatsAppCustomer")
          .findById(booking.whatsappCustomerId)
          .session(session);
        customerPhone = guest?.phone || "";
      } else if (booking.walkInGuest) {
        customerPhone = booking.walkInGuest.phone;
      }

      const confirmedNotification = bookingConfirmedOutboxEvent({
        // `user.id` is the last resort for a legacy row with no customer at
        // all; a WhatsApp booking is addressed by its own identity.
        userId: booking.whatsappCustomerId
          ? null
          : booking.customerId || user.id,
        whatsappCustomerId: booking.whatsappCustomerId
          ? String(booking.whatsappCustomerId)
          : null,
        customerPhone: customerPhone,
        booking,
        payment,
      });

      const [transaction] = await this.financialTransactions.create(
        [
          {
            bookingId: booking._id,
            paymentId: payment._id,
            ashramId: booking.ashramId,
            ownerId: ashram.ownerId,
            type: "booking",
            direction: "credit",
            amount: booking.pricing.totalAmount,
            reference: financialReference("BKTXN"),
            description: `Manual booking payment for ${booking.bookingId}`,
            recordedBy: user.id,
          },
        ],
        { session },
      );

      await Promise.all([
        this.ledger.create(
          [
            {
              account: "booking_clearing",
              bookingId: booking._id,
              ashramId: booking.ashramId,
              ownerId: ashram.ownerId,
              transactionId: transaction._id,
              debit: 0,
              credit: booking.pricing.totalAmount,
              reference: transaction.reference,
            },
          ],
          { session },
        ),
        this.commissions.create(
          [
            {
              bookingId: booking._id,
              ashramId: booking.ashramId,
              ownerId: ashram.ownerId,
              grossAmount: booking.pricing.totalAmount,
              commissionPercent: percent,
              commissionAmount,
              ownerEarning: booking.pricing.totalAmount - commissionAmount,
              settlementStatus: "pending",
            },
          ],
          { session },
        ),
        this.history.create(
          [
            {
              bookingId: booking._id,
              fromStatus: "pending",
              toStatus: "confirmed",
              note: `Payment manually confirmed (${dto.paymentMode})`,
              actorId: user.id,
              actorRole: user.role,
            },
          ],
          { session },
        ),
        this.notifications.create(
          [confirmedNotification],
          { session },
        ),
        this.audits.create(
          [
            {
              userId: user.id,
              action: "BOOKING_PAYMENT_MANUAL_SUCCESS",
              bookingId: booking._id,
              ashramId: booking.ashramId,
              details: {
                paymentId: payment._id,
                transactionId: payment.transactionId,
                paymentMode: dto.paymentMode,
                note: dto.note,
              },
            },
          ],
          { session },
        ),
        this.redemptions.updateOne(
          { bookingId: booking._id, status: "reserved" },
          { $set: { status: "redeemed", redeemedAt: new Date() } },
          { session },
        ),
      ]);

      const gstPercent = Number(
        booking.pricing.gstPercent ?? PLATFORM_FEE_GST_PERCENT,
      );
      const invoiceNo = financialReference("INV");
      const [invoice] = await this.invoices.create(
        [
          {
            invoiceNumber: invoiceNo,
            bookingId: booking._id,
            customerId: booking.customerId,
            ashramId: booking.ashramId,
            lineItems: [
              {
                description: "Ashram stay and selected services",
                quantity: 1,
                unitAmount: booking.pricing.originalAmount,
                totalAmount: booking.pricing.originalAmount,
                taxRate: 0,
                taxAmount: 0,
              },
              ...(booking.pricing.platformFee > 0
                ? [
                    {
                      description: "Tirvona platform fee",
                      quantity: 1,
                      unitAmount: booking.pricing.platformFee,
                      totalAmount: booking.pricing.platformFee,
                      taxRate: gstPercent,
                      taxAmount: booking.pricing.gstAmount,
                    },
                  ]
                : []),
            ],
            subtotal: roundMoney(
              booking.pricing.originalAmount + booking.pricing.platformFee,
            ),
            taxAmount: booking.pricing.gstAmount,
            discountAmount: booking.pricing.discountAmount,
            donationAmount: booking.pricing.donationAmount,
            totalAmount: booking.pricing.totalAmount,
          },
        ],
        { session },
      );

      await Promise.all([
        this.receipts.create(
          [
            {
              receiptNumber: financialReference("RCT"),
              bookingId: booking._id,
              paymentId: payment._id,
              amount: payment.amount,
              method: payment.method,
            },
          ],
          { session },
        ),
        this.taxes.create(
          [
            {
              bookingId: booking._id,
              invoiceId: invoice._id,
              ashramId: booking.ashramId,
              taxableAmount:
                booking.pricing.gstTaxableAmount ??
                booking.pricing.platformFee ??
                0,
              gstPercent,
              cgst: roundMoney(booking.pricing.gstAmount / 2),
              sgst: roundMoney(
                booking.pricing.gstAmount - roundMoney(booking.pricing.gstAmount / 2),
              ),
              igst: 0,
              totalTax: booking.pricing.gstAmount,
              taxPeriod: new Date().toISOString().slice(0, 7),
            },
          ],
          { session },
        ),
      ]);
      return { booking, payment, invoice };
    });
  }

  /**
   * Every booking belonging to one customer, whichever identity they are.
   *
   * The same collection serves both channels, so a guest's bookings read the
   * same from the website and from WhatsApp — there is no per-channel copy to
   * fall out of step.
   */
  async historyFor(owner: {
    userId?: string | null;
    whatsappCustomerId?: string | null;
  }): Promise<any[]> {
    const rows = await this.bookings
      // No `deletedAt` filter: the website's history endpoint has never had
      // one, and adding it here would change what an existing customer sees.
      .find(bookingOwnerFilter(owner))
      .populate("ashramId", "name address rules images")
      .populate("rooms.roomId", "name acType type")
      .populate("whatsappCustomerId", "wappId name phone")
      .sort({ createdAt: -1 })
      .lean();
    return withBookingCustomers(rows as any[]);
  }
  async get(idOrReference: string, actor: BookingActor): Promise<any> {
    // Public URLs carry the human booking reference (TRV-…), never the id.
    const isObjectId = /^[0-9a-f]{24}$/i.test(String(idOrReference ?? ""));
    const row = await this.bookings
      .findOne(
        isObjectId
          ? { _id: idOrReference }
          : { bookingId: String(idOrReference).toUpperCase() },
      )
      .populate("ashramId", "name address rules images")
      .populate("rooms.roomId", "name acType type")
      .populate("customerId", "name email phone")
      .populate("whatsappCustomerId", "wappId name phone")
      .lean();
    if (!row) throw new NotFoundException("Booking not found");
    // Ownership is checked against the booking's own identity. A reference
    // typed into a chat never authorizes anything by itself.
    if (!bookingBelongsTo(row, actor)) {
      if (!actor.principal)
        throw new NotFoundException("Booking not found");
      await this.assertCanView(actor.principal, row);
    }
    return withBookingCustomer(row as any);
  }

  async dashboard(
    user: AuthenticatedUser,
    query: BookingDashboardQueryDto,
  ): Promise<any> {
    const scope = await this.scopedAshrams(user);
    if (query.ashramId && scope !== null && !scope.includes(query.ashramId))
      throw new ForbiddenException("You do not have access to this ashram.");
    const filter: any = {
      deletedAt: null,
      ...(query.status && query.status !== "all" ? { status: query.status } : {}),
      ...(query.paymentStatus && query.paymentStatus !== "all"
        ? { paymentStatus: query.paymentStatus }
        : {}),
      ...(query.source && query.source !== "all"
        ? { bookingSource: query.source }
        : {}),
      // Optional reporting filter. Absent by default, so the owner and admin
      // views keep returning every channel exactly as before.
      ...(query.channel && query.channel !== "all"
        ? { channel: query.channel }
        : {}),
      ...(query.ashramId
        ? { ashramId: query.ashramId }
        : scope === null
          ? {}
          : { ashramId: { $in: scope } }),
    };

    const andConditions: any[] = [];

    if (query.search) {
      const term = query.search.trim();
      let customerIds: any[] = [];
      try {
        const matchingCustomers = await this.userModel
          .find({
            $or: [
              { name: new RegExp(term, "i") },
              { phone: new RegExp(term, "i") },
              { email: new RegExp(term, "i") },
            ],
          })
          .select("_id")
          .limit(30)
          .lean();
        customerIds = matchingCustomers.map((c: any) => c._id);
      } catch {
        customerIds = [];
      }

      andConditions.push({
        $or: [
          { bookingId: new RegExp(term, "i") },
          { reservationNumber: new RegExp(term, "i") },
          { assignedRoomNumbers: new RegExp(term, "i") },
          { "walkInGuest.name": new RegExp(term, "i") },
          { "walkInGuest.phone": new RegExp(term, "i") },
          ...(customerIds.length ? [{ customerId: { $in: customerIds } }] : []),
        ],
      });
    }

    if (query.date) {
      const start = new Date(`${query.date}T00:00:00.000Z`);
      const nextDay = new Date(start.getTime() + 86_400_000);
      andConditions.push({
        $or: [
          { checkInDate: { $gte: start, $lt: nextDay } },
          { occupiedDates: { $gte: start, $lt: nextDay } },
          { checkInDate: { $lte: start }, checkOutDate: { $gt: start } },
        ],
      });
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));

    const rows = await this.bookings
      .find(filter)
      .populate("customerId", "name email phone")
      .populate("whatsappCustomerId", "wappId name phone")
      .populate("ashramId", "name address")
      .populate("rooms.roomId", "name type acType")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    // Renders a WhatsApp guest in the same shape the owner and admin views
    // already read, and exposes their WAPP id alongside.
    return withBookingCustomers(rows as any[]);
  }

  async frontdeskSummary(
    user: AuthenticatedUser,
    requestedAshramId?: string,
  ): Promise<any> {
    const scope = await this.scopedAshrams(user);
    if (
      requestedAshramId &&
      scope !== null &&
      !scope.includes(requestedAshramId)
    ) {
      throw new ForbiddenException("You do not have access to this ashram.");
    }
    const targetAshramId =
      requestedAshramId || (scope && scope.length === 1 ? scope[0] : null);
    const ashramFilter: any = {
      deletedAt: null,
      ...(targetAshramId
        ? { ashramId: targetAshramId }
        : scope === null
          ? {}
          : { ashramId: { $in: scope } }),
    };

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);
    const endOfToday = new Date(startOfToday.getTime() + 86_400_000);

    // 1. Today's Arrivals
    const arrivalsToday = await this.bookings.countDocuments({
      ...ashramFilter,
      checkInDate: { $gte: startOfToday, $lt: endOfToday },
      status: { $in: ["confirmed", "pending"] },
    });

    // 2. Today's Departures
    const departuresToday = await this.bookings.countDocuments({
      ...ashramFilter,
      checkOutDate: { $gte: startOfToday, $lt: endOfToday },
      status: "checked_in",
    });

    // 3. Current In-House Guests
    const inHouseBookings = await this.bookings
      .find({
        ...ashramFilter,
        status: "checked_in",
      })
      .select("guestsCount roomsBookedCount pricing")
      .lean();

    const currentInHouseGuests = inHouseBookings.reduce(
      (acc: number, b: any) => acc + (b.guestsCount || 1),
      0,
    );
    const inHouseRoomsOccupied = inHouseBookings.reduce(
      (acc: number, b: any) => acc + (b.roomsBookedCount || 1),
      0,
    );

    // 4. Pending Check-ins
    const pendingCheckins = await this.bookings.countDocuments({
      ...ashramFilter,
      checkInDate: { $lte: endOfToday },
      status: "confirmed",
    });

    // 5. Pending Check-outs
    const pendingCheckouts = await this.bookings.countDocuments({
      ...ashramFilter,
      checkOutDate: { $lte: endOfToday },
      status: "checked_in",
    });

    // 6. Rooms breakdown: Available, Occupied, Cleaning, Maintenance
    let totalRooms = 0;
    const roomScopeFilter = targetAshramId
      ? { ashramId: targetAshramId }
      : scope === null
        ? {}
        : { ashramId: { $in: scope } };

    try {
      const roomDocs = await this.roomModel
        .find(roomScopeFilter)
        .select("totalRooms roomNumbers")
        .lean();
      for (const r of roomDocs) {
        if (typeof r.totalRooms === "number" && r.totalRooms > 0) {
          totalRooms += r.totalRooms;
        } else if (Array.isArray(r.roomNumbers) && r.roomNumbers.length > 0) {
          totalRooms += r.roomNumbers.length;
        } else {
          totalRooms += 8;
        }
      }
    } catch {
      totalRooms = 32;
    }
    if (totalRooms === 0) totalRooms = 32;

    let occupiedAssignments = 0;
    try {
      occupiedAssignments = await this.assignments.countDocuments({
        ...(targetAshramId
          ? { ashramId: targetAshramId }
          : scope === null
            ? {}
            : { ashramId: { $in: scope } }),
        status: "occupied",
      });
    } catch {
      occupiedAssignments = 0;
    }

    const occupiedRooms = Math.max(occupiedAssignments, inHouseRoomsOccupied);

    let cleaningRooms = 0;
    let maintenanceRooms = 0;
    try {
      cleaningRooms = await this.housekeeping.countDocuments({
        ...(targetAshramId
          ? { ashramId: targetAshramId }
          : scope === null
            ? {}
            : { ashramId: { $in: scope } }),
        status: { $in: ["dirty", "in_progress", "inspection"] },
      });
      maintenanceRooms = await this.housekeeping.countDocuments({
        ...(targetAshramId
          ? { ashramId: targetAshramId }
          : scope === null
            ? {}
            : { ashramId: { $in: scope } }),
        status: "maintenance",
      });
    } catch {
      cleaningRooms = 0;
      maintenanceRooms = 0;
    }

    const availableRooms = Math.max(
      0,
      totalRooms - occupiedRooms - cleaningRooms - maintenanceRooms,
    );

    // 7. Today's Expected Revenue & Collections
    let todayCollected = 0;
    try {
      const todayPayments = await this.payments
        .find({
          ...ashramFilter,
          status: "success",
          paidAt: { $gte: startOfToday, $lt: endOfToday },
        })
        .select("amount")
        .lean();
      todayCollected = todayPayments.reduce(
        (acc: number, p: any) => acc + (p.amount || 0),
        0,
      );
    } catch {
      todayCollected = 0;
    }

    const todayArrivalBookings = await this.bookings
      .find({
        ...ashramFilter,
        checkInDate: { $gte: startOfToday, $lt: endOfToday },
        status: { $in: ["confirmed", "checked_in"] },
      })
      .select("pricing")
      .lean();

    const todayExpectedRevenue = todayArrivalBookings.reduce(
      (acc: number, b: any) => acc + (b.pricing?.totalAmount || 0),
      0,
    );

    // 8. Pending Payments
    const pendingPaymentBookings = await this.bookings
      .find({
        ...ashramFilter,
        status: { $in: ["confirmed", "checked_in", "pending"] },
        paymentStatus: { $in: ["pending", "partially_paid"] },
      })
      .select("pricing")
      .lean();

    const pendingPaymentsAmount = pendingPaymentBookings.reduce(
      (acc: number, b: any) =>
        acc +
        Math.max(
          0,
          (b.pricing?.totalAmount || 0) - (b.pricing?.amountPaid || 0),
        ),
      0,
    );

    return {
      todayArrivals: arrivalsToday,
      todayDepartures: departuresToday,
      currentInHouseGuests,
      availableRooms,
      occupiedRooms,
      cleaningRooms: cleaningRooms + maintenanceRooms,
      maintenanceRooms,
      pendingCheckins,
      pendingCheckouts,
      todayExpectedRevenue:
        todayCollected > 0 ? todayCollected : todayExpectedRevenue,
      todayCollected,
      pendingPaymentsAmount,
      pendingPaymentsCount: pendingPaymentBookings.length,
      totalRooms,
      totalBookingsCount: await this.bookings.countDocuments(ashramFilter),
    };
  }

  async paymentPendingList(
    user: AuthenticatedUser,
    query: BookingDashboardQueryDto,
  ): Promise<any> {
    const scope = await this.scopedAshrams(user);
    if (query.ashramId && scope !== null && !scope.includes(query.ashramId))
      throw new ForbiddenException("You do not have access to this ashram.");
    const filter: any = {
      deletedAt: null,
      status: "pending",
      paymentStatus: "pending",
      ...(query.ashramId
        ? { ashramId: query.ashramId }
        : scope === null
          ? {}
          : { ashramId: { $in: scope } }),
    };
    if (query.search)
      filter.$or = [
        { bookingId: new RegExp(query.search, "i") },
        { reservationNumber: new RegExp(query.search, "i") },
      ];
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));

    const rows = await this.bookings
      .find(filter)
      .populate("customerId", "name email phone")
      .populate("whatsappCustomerId", "wappId name phone")
      .populate("ashramId", "name address")
      .populate("rooms.roomId", "name type acType")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return withBookingCustomers(rows as any[]);
  }

  async adminUpdate(
    id: string,
    user: AuthenticatedUser,
    dto: AdminUpdateBookingDto,
  ): Promise<any> {
    if (user.role !== "super_admin")
      throw new ForbiddenException("Only Super Admin can edit booking details");
    if (
      dto.assignedRoomNumbers === undefined &&
      dto.roomAssignments === undefined &&
      dto.specialRequests === undefined
    )
      throw new BadRequestException("No editable booking fields were provided");

    await this.transactions.run(async (session) => {
      const row = await this.bookings.findOne({ _id: id, deletedAt: null }).session(session);
      if (!row) throw new NotFoundException("Booking not found");

      const updatedFields: string[] = [];
      if (dto.assignedRoomNumbers !== undefined || dto.roomAssignments !== undefined) {
        if (!["confirmed", "checked_in"].includes(row.status))
          throw new BadRequestException(
            "Room numbers can only be assigned to a confirmed or checked-in booking",
          );

        const resolved = this.resolveRoomNumberAssignments(row, {
          roomNumbers: dto.assignedRoomNumbers,
          rooms: dto.roomAssignments,
        });
        const roomNumbers = resolved.map((r) => r.roomNumber);

        // Conflict check for each room number
        for (const roomNumber of roomNumbers) {
          const conflict = await this.bookings
            .exists({
              _id: { $ne: row._id },
              deletedAt: null,
              ashramId: row.ashramId,
              assignedRoomNumbers: roomNumber,
              status: { $in: ["confirmed", "checked_in"] },
              checkInDate: { $lt: row.checkOutDate },
              checkOutDate: { $gt: row.checkInDate },
            })
            .session(session);
          if (conflict)
            throw new ConflictException(
              `Room ${roomNumber} is already assigned for overlapping dates`,
            );
        }

        // Clear existing assignments for this booking
        await this.assignments.updateMany(
          { bookingId: row._id, status: { $ne: "released" } },
          { $set: { status: "released", releasedAt: new Date() } },
          { session }
        );

        // Create new assignments, each tagged with its correct room category
        for (const { roomId, roomNumber } of resolved) {
          await this.assignments.create(
            [{
              bookingId: row._id,
              ashramId: row.ashramId,
              roomId,
              roomNumber,
              assignedBy: user.id,
              assignedAt: new Date(),
              status: row.status === "checked_in" ? "occupied" : "assigned",
            }],
            { session },
          );
        }

        row.assignedRoomNumbers = roomNumbers;
        updatedFields.push("assignedRoomNumbers");
      }
      if (dto.specialRequests !== undefined) {
        row.specialRequests = dto.specialRequests.trim();
        updatedFields.push("specialRequests");
      }
      await row.save({ session });
      await this.audits.create(
        [
          {
            userId: user.id,
            action: "SUPER_ADMIN_BOOKING_UPDATED",
            bookingId: row._id,
            ashramId: row.ashramId,
            details: { updatedFields },
          },
        ],
        { session },
      );
    });

    // Same customer resolution as every other admin read path, so a booking
    // made by a WhatsApp guest comes back with a customer on it rather than
    // a null where the name should be.
    return withBookingCustomer(
      (await this.bookings
        .findById(id)
        .populate("customerId", "name email phone")
        .populate("whatsappCustomerId", "wappId name phone")
        .populate("ashramId", "name address")
        .populate("rooms.roomId", "name type acType")
        .lean()) as any,
    );
  }

  async adminDelete(id: string, user: AuthenticatedUser): Promise<any> {
    if (user.role !== "super_admin")
      throw new ForbiddenException("Only Super Admin can delete bookings");
    return this.transactions.run(async (session) => {
      const row = await this.bookings.findOne({ _id: id, deletedAt: null }).session(session);
      if (!row) throw new NotFoundException("Booking not found");
      const successfulPayment = await this.payments
        .exists({ bookingId: row._id, status: "success" })
        .session(session);
      if (
        successfulPayment ||
        row.paymentStatus === "fully_paid" ||
        row.gatewayStatus === "success" ||
        !["pending", "expired", "cancelled"].includes(row.status)
      )
        throw new BadRequestException(
          "Paid or active stay records cannot be deleted; cancel or refund them through the booking workflow",
        );

      const activeHold = await this.inventoryHolds
        .findOne({ bookingId: row._id, state: "held" })
        .session(session);
      if (activeHold) {
        for (const room of this.roomUnits(row))
          await this.repository.releaseInventory({
            roomId: room.roomId,
            dates: row.occupiedDates,
            count: room.units,
            state: "held",
            session,
          });
        activeHold.state = "released";
        activeHold.releasedAt = new Date();
        activeHold.releaseReason = "Deleted by Super Admin";
        await activeHold.save({ session });
      }
      row.deletedAt = new Date();
      row.deletedBy = user.id;
      await row.save({ session });
      await this.audits.create(
        [
          {
            userId: user.id,
            action: "SUPER_ADMIN_BOOKING_DELETED",
            bookingId: row._id,
            ashramId: row.ashramId,
            details: { previousStatus: row.status },
          },
        ],
        { session },
      );
      return { id: String(row._id), deleted: true };
    });
  }

  async assignRoom(
    id: string,
    user: AuthenticatedUser,
    dto: AssignRoomDto,
  ): Promise<any> {
    const row = await this.bookings.findById(id);
    if (!row) throw new NotFoundException("Booking not found");
    await this.assertCanManage(user, row);
    const resolved = this.resolveRoomNumberAssignments(row, {
      roomNumbers: dto.roomNumbers,
      rooms: dto.rooms,
    });
    const roomNumbers = resolved.map((r) => r.roomNumber);

    for (const roomNumber of roomNumbers) {
      const conflict = await this.bookings.exists({
        _id: { $ne: row._id },
        ashramId: row.ashramId,
        assignedRoomNumbers: roomNumber,
        status: { $in: ["confirmed", "checked_in"] },
        checkInDate: { $lt: row.checkOutDate },
        checkOutDate: { $gt: row.checkInDate },
      });
      if (conflict)
        throw new ConflictException(
          `Room ${roomNumber} is already assigned for overlapping dates`,
        );
    }

    await this.assignments.updateMany(
      { bookingId: row._id, status: { $ne: "released" } },
      { $set: { status: "released", releasedAt: new Date() } }
    );

    for (const { roomId, roomNumber } of resolved) {
      await this.assignments.create({
        bookingId: row._id,
        ashramId: row.ashramId,
        roomId,
        roomNumber,
        assignedBy: user.id,
        assignedAt: new Date(),
        status: "assigned",
      });
    }

    row.assignedRoomNumbers = roomNumbers;
    await row.save();

    await this.notifications.create({
      userId: row.customerId,
      bookingId: row._id,
      ashramId: row.ashramId,
      event: "room_assigned",
      title: "Room assigned",
      message:
        roomNumbers.length === 1
          ? `You have been allocated Room ${roomNumbers[0]}. Enjoy your stay!`
          : `You have been allocated rooms ${roomNumbers.join(", ")}. Enjoy your stay!`,
      channel: "in_app",
      status: "queued",
      pushEnabled: true,
      data: { roomNumbers: roomNumbers.join(",") },
      meta: { correlationId: `booking:${String(row._id)}:room_assigned` },
    });

    return row;
  }

  /**
   * The outbox row that tells a guest their stay moved to a new status. The
   * worker loads the booking behind it, so only the identifiers are stored
   * here; the phone falls back to the account phone when there is no walk-in
   * contact number on the booking.
   */
  private stayStatusNotification(
    row: any,
    status: "checked_in" | "checked_out",
  ) {
    const checkedIn = status === "checked_in";
    const phone = row.walkInGuest?.phone
      ? normalizeWhatsAppNumber(String(row.walkInGuest.phone))
      : undefined;
    return {
      userId: row.customerId,
      bookingId: row._id,
      ashramId: row.ashramId,
      event: status,
      title: checkedIn ? "Checked in" : "Checked out",
      message: checkedIn
        ? `You are checked in for booking ${row.bookingId}.`
        : `Your stay for booking ${row.bookingId} is complete.`,
      channel: "in_app",
      status: "queued",
      ...(phone ? { recipientPhone: phone } : {}),
      meta: { correlationId: `booking:${String(row._id)}:${status}` },
    };
  }

  async checkin(
    id: string,
    user: AuthenticatedUser,
    dto: CheckinDto,
  ): Promise<any> {
    const row = await this.bookings.findById(id).select("+checkInCode");
    if (!row) throw new NotFoundException("Booking not found");
    await this.assertCanManage(user, row);
    if (row.status !== "confirmed")
      throw new BadRequestException(
        "Only confirmed bookings can be checked in",
      );
    if (row.checkInCode !== dto.checkInCode.trim())
      throw new BadRequestException("Invalid check-in code");
    return this.transactions.run(async (session) => {
      const checkedInAt = new Date();
      row.status = "checked_in";
      row.checkedInAt = checkedInAt;
      row.checkedInBy = user.id;
      if (dto.roomNumbers && dto.roomNumbers.length > 0) {
        const rawNumbers = dto.roomNumbers.map((n) => n.trim()).filter(Boolean);
        if (rawNumbers.length > 0) {
          for (const roomNumber of rawNumbers) {
            const conflict = await this.bookings
              .exists({
                _id: { $ne: row._id },
                ashramId: row.ashramId,
                assignedRoomNumbers: roomNumber,
                status: { $in: ["confirmed", "checked_in"] },
                checkInDate: { $lt: row.checkOutDate },
                checkOutDate: { $gt: row.checkInDate },
              })
              .session(session);
            if (conflict) {
              throw new ConflictException(
                `Room ${roomNumber} is already assigned for overlapping dates`,
              );
            }
          }
          row.assignedRoomNumbers = rawNumbers;

          await this.assignments.updateMany(
            { bookingId: row._id, status: { $ne: "released" } },
            { $set: { status: "released", releasedAt: new Date() } },
            { session },
          );

          const units = this.roomUnits(row);
          const defaultRoomId = units[0]?.roomId || row.roomId;
          for (const roomNumber of rawNumbers) {
            await this.assignments.create(
              [
                {
                  bookingId: row._id,
                  ashramId: row.ashramId,
                  roomId: defaultRoomId,
                  roomNumber,
                  assignedBy: user.id,
                  assignedAt: checkedInAt,
                  status: "occupied",
                },
              ],
              { session },
            );
          }
        }
      }
      await row.save({ session });
      await this.checkins.create(
        [
          {
            bookingId: row._id,
            ashramId: row.ashramId,
            verifiedBy: user.id,
            checkedInAt,
            guestCount: row.guestsCount,
            roomNumbers: row.assignedRoomNumbers,
            notes: dto.notes,
          },
        ],
        { session },
      );
      await this.assignments.updateMany(
        { bookingId: row._id, status: "assigned" },
        { $set: { status: "occupied" } },
        { session },
      );
      await this.history.create(
        [
          {
            bookingId: row._id,
            fromStatus: "confirmed",
            toStatus: "checked_in",
            actorId: user.id,
            actorRole: user.role,
          },
        ],
        { session },
      );
      await this.notifications.create(
        [this.stayStatusNotification(row, "checked_in")],
        { session },
      );
      return row;
    });
  }

  async checkout(
    id: string,
    user: AuthenticatedUser,
    dto: CheckoutDto,
  ): Promise<any> {
    const row = await this.bookings.findById(id);
    if (!row) throw new NotFoundException("Booking not found");
    await this.assertCanManage(user, row);
    if (row.status !== "checked_in")
      throw new BadRequestException(
        "Only checked-in bookings can be checked out",
      );
    return this.transactions.run(async (session) => {
      for (const room of this.roomUnits(row))
        await this.repository.releaseInventory({
          roomId: room.roomId,
          dates: row.occupiedDates,
          count: room.units,
          state: "booked",
          session,
        });
      await this.inventoryHolds.updateMany(
        { bookingId: row._id, state: "confirmed" },
        {
          $set: {
            state: "released",
            releasedAt: new Date(),
            releaseReason: "Guest checked out",
          },
        },
        { session },
      );
      const checkedOutAt = new Date();
      row.status = "checked_out";
      row.checkedOutAt = checkedOutAt;
      row.checkedOutBy = user.id;
      await row.save({ session });
      await this.checkouts.create(
        [
          {
            bookingId: row._id,
            ashramId: row.ashramId,
            checkedOutBy: user.id,
            checkedOutAt,
            damages: dto.damages ?? [],
            additionalCharges: dto.additionalCharges,
            notes: dto.notes,
          },
        ],
        { session },
      );
      await this.assignments.updateMany(
        { bookingId: row._id, status: "occupied" },
        { $set: { status: "released", releasedAt: new Date() } },
        { session },
      );
      // Staged for every checkout, not only stays with numbered rooms.
      await this.notifications.create(
        [this.stayStatusNotification(row, "checked_out")],
        { session },
      );
      if (row.assignedRoomNumbers && row.assignedRoomNumbers.length > 0) {
        const assignmentDocs = await this.assignments
          .find({ bookingId: row._id, roomNumber: { $in: row.assignedRoomNumbers } })
          .session(session)
          .lean();
        const roomIdByNumber = new Map(
          assignmentDocs.map((a: any) => [a.roomNumber, String(a.roomId)]),
        );
      if (row.assignedRoomNumber)
        await this.housekeeping.findOneAndUpdate(
          { ashramId: row.ashramId, unitNumber: row.assignedRoomNumber },
          {
            $set: {
              roomId: row.roomId,
              bookingId: row._id,
              status: "dirty",
              priority: "high",
              notes: "Checkout cleaning required",
            },
          },
          { upsert: true, session },
        );
        const fallbackRoomId = this.roomUnits(row)[0]?.roomId;
        for (const roomNumber of row.assignedRoomNumbers) {
          const roomId = roomIdByNumber.get(roomNumber) ?? fallbackRoomId;
          await this.housekeeping.findOneAndUpdate(
            { ashramId: row.ashramId, unitNumber: roomNumber },
            {
              $set: {
                roomId,
                bookingId: row._id,
                status: "dirty",
                priority: "high",
                notes: "Checkout cleaning required",
              },
            },
            { upsert: true, session },
          );
        }
      }
      await this.history.create(
        [
          {
            bookingId: row._id,
            fromStatus: "checked_in",
            toStatus: "checked_out",
            actorId: user.id,
            actorRole: user.role,
          },
        ],
        { session },
      );
      return row;
    });
  }

  /**
   * Cancels a booking under the existing policy.
   *
   * One cancellation path for every channel: the same policy lookup, the same
   * refund percentage, the same inventory release, the same commission
   * reversal and the same coupon restoration whether the request came from
   * the website, an admin, or a WhatsApp conversation. WhatsApp does not get
   * its own rules, because there are none to give it.
   */
  private async cancellationPolicyFor(ashramId: unknown): Promise<any> {
    return this.pricing["policies"]
      .findOne({
        $or: [{ scope: "ashram", ashramId }, { scope: "platform" }],
        isActive: true,
      })
      .sort({ scope: 1 })
      .lean();
  }

  /**
   * What cancelling this booking would do, without doing it.
   *
   * Applies the very same `computeCancellationRefund` `cancel` applies, after
   * the very same ownership check, so the figure quoted to a guest is the
   * figure `cancel` will then record. A booking that is not the caller's is
   * reported as not found, so a reference typed into a chat confirms nothing.
   */
  async previewCancellation(
    id: string,
    actor: BookingActor,
  ): Promise<{
    bookingId: string;
    cancellable: boolean;
    status: string;
    amountPaid: number;
    refundAmount: number;
    refundPercent: number;
    hoursBefore: number;
    freeCancellationHours: number;
  }> {
    const existing = await this.bookings.findById(id);
    if (!existing) throw new NotFoundException("Booking not found");
    const isOwnBooking = bookingBelongsTo(existing, actor);
    if (!isOwnBooking) {
      if (!actor.principal) throw new NotFoundException("Booking not found");
      await this.assertCanManage(actor.principal, existing);
    }
    const policy = await this.cancellationPolicyFor(existing.ashramId);
    const decision = computeCancellationRefund({
      policy,
      booking: existing,
      hostOrAdminCancel: !isOwnBooking,
    });
    const cancellable = ["pending", "confirmed"].includes(existing.status);
    return {
      bookingId: existing.bookingId,
      cancellable,
      status: existing.status,
      amountPaid: Number(existing.pricing?.amountPaid ?? 0),
      // A booking that cannot be cancelled refunds nothing further.
      refundAmount: cancellable ? decision.refundAmount : 0,
      refundPercent: cancellable ? decision.refundPercent : 0,
      hoursBefore: decision.hoursBefore,
      freeCancellationHours: decision.freeCancellationHours,
    };
  }

  async cancel(
    id: string,
    actor: BookingActor,
    dto: CancelBookingDto,
  ): Promise<any> {
    const existing = await this.bookings.findById(id);
    if (!existing) throw new NotFoundException("Booking not found");
    const isOwnBooking = bookingBelongsTo(existing, actor);
    if (!isOwnBooking) {
      // A WhatsApp guest has no staff principal, so they can only ever reach
      // their own bookings — and a booking that is not theirs is reported as
      // not found rather than forbidden, which would confirm it exists.
      if (!actor.principal) throw new NotFoundException("Booking not found");
      await this.assertCanManage(actor.principal, existing);
    }
    if (!["pending", "confirmed"].includes(existing.status))
      throw new BadRequestException("This booking can no longer be cancelled");
    const policy = await this.cancellationPolicyFor(existing.ashramId);
    // The single refund decision. Previews call the same function.
    const decision = computeCancellationRefund({
      policy,
      booking: existing,
      hostOrAdminCancel: !isOwnBooking,
    });
    const refundPercent = decision.refundPercent;
    return this.transactions.run(async (session) => {
      const state = existing.status === "pending" ? "held" : "booked";
      for (const room of this.roomUnits(existing))
        await this.repository.releaseInventory({
          roomId: room.roomId,
          dates: existing.occupiedDates,
          count: room.units,
          state,
          session,
        });
      await this.inventoryHolds.updateMany(
        { bookingId: existing._id, state: { $in: ["held", "confirmed"] } },
        {
          $set: {
            state: "released",
            releasedAt: new Date(),
            releaseReason: dto.reason,
            expiresAt: null,
          },
        },
        { session },
      );
      const refundAmount = decision.refundAmount;
      existing.status = "cancelled";
      existing.cancellation = {
        reason: dto.reason,
        date: new Date(),
        refundAmount,
      };
      existing.reservationExpiresAt = null;
      if (refundAmount) existing.paymentStatus = "refunded";
      await existing.save({ session });
      if (refundAmount) {
        const payment = await this.payments
          .findOne({ bookingId: existing._id, status: "success" })
          .session(session);
        if (payment)
          await this.refunds.create(
            [
              {
                refundReference: financialReference("REF"),
                bookingId: existing._id,
                paymentId: payment._id,
                requestedBy: actor.userId,
                requestedByWhatsAppCustomerId: actor.whatsappCustomerId,
                amount: refundAmount,
                percentage: refundPercent,
                reason: dto.reason,
                policySnapshot: decision.policySnapshot,
                status: "pending",
              },
            ],
            { session },
          );
        await this.commissions.updateOne(
          { bookingId: existing._id },
          {
            $set: {
              settlementStatus: "reversed",
              reversedAt: new Date(),
              reversalReason: dto.reason,
            },
          },
          { session },
        );
      }
      if (existing.offerId) {
        await this.coupons.updateOne(
          { _id: existing.offerId },
          { $inc: { remainingRedemptions: 1, redemptionsCount: -1 } },
          { session },
        );
        await this.redemptions.updateOne(
          { bookingId: existing._id },
          { $set: { status: "released", releasedAt: new Date() } },
          { session },
        );
      }
      await Promise.all([
        this.history.create(
          [
            {
              bookingId: existing._id,
              fromStatus: state === "held" ? "pending" : "confirmed",
              toStatus: "cancelled",
              note: dto.reason,
              actorId: actor.userId,
              actorRole: actor.role,
            },
          ],
          { session },
        ),
        this.notifications.create(
          [
            {
              // Addressed to whoever owns the booking, not to whoever
              // cancelled it — an admin cancelling still notifies the guest.
              userId: existing.customerId,
              whatsappCustomerId: existing.whatsappCustomerId,
              bookingId: existing._id,
              ashramId: existing.ashramId,
              event: "booking_cancelled",
              title: "Booking cancelled",
              message: `${existing.bookingId} was cancelled. Refund due: ₹${refundAmount}.`,
              pushEnabled: true,
              data: { refundAmount: String(refundAmount) },
            },
          ],
          { session },
        ),
      ]);
      return { booking: existing, refundAmount };
    });
  }

  async updateStatus(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateBookingStatusDto,
  ): Promise<any> {
    const row = await this.bookings.findById(id);
    if (!row) throw new NotFoundException("Booking not found");
    await this.assertCanManage(user, row);
    const allowed: Record<string, string[]> = { checked_out: ["completed"] };
    if (!allowed[row.status]?.includes(dto.status))
      throw new BadRequestException(
        "Use the payment, check-in, check-out, or cancellation workflow for this status transition",
      );
    const from = row.status;
    row.status = dto.status;
    await row.save();
    await this.history.create({
      bookingId: row._id,
      fromStatus: from,
      toStatus: dto.status,
      note: dto.note,
      actorId: user.id,
      actorRole: user.role,
    });
    return row;
  }

  /**
   * Rebuilds the acting identity from a stored payment row.
   *
   * Used by the Razorpay webhook, which has no request principal. A website
   * payment yields a customer principal exactly as before; a WhatsApp payment
   * yields a WhatsApp actor carrying the guest's number, so the confirmation
   * outbox row still gets a phone to deliver to.
   */
  private async actorFromPayment(payment: any): Promise<BookingActor> {
    return this.actorForOwner({
      whatsappCustomerId: payment.whatsappCustomerId,
      userId: payment.userId,
    });
  }

  /**
   * The acting identity for a booking, rebuilt from the booking's own owner
   * fields. Used where there is no request principal — the public signed
   * payment page, like the Razorpay webhook — so the identity is whatever the
   * server's record says, never something a caller supplied.
   */
  async actorForBooking(booking: any): Promise<BookingActor> {
    return this.actorForOwner({
      whatsappCustomerId: booking.whatsappCustomerId,
      userId: booking.customerId,
    });
  }

  private async actorForOwner(owner: {
    whatsappCustomerId?: unknown;
    userId?: unknown;
  }): Promise<BookingActor> {
    if (owner.whatsappCustomerId) {
      const guest = await this.bookings.db
        .model("WhatsAppCustomer")
        .findById(owner.whatsappCustomerId)
        .select("name phone")
        .lean();
      return {
        userId: null,
        whatsappCustomerId: String(owner.whatsappCustomerId),
        role: "whatsapp_customer",
        channel: WHATSAPP_BOOKING_CHANNEL,
        name: (guest as any)?.name ?? "",
        phone: (guest as any)?.phone ?? "",
      };
    }
    const account = await this.bookings.db
      .model("User")
      .findById(owner.userId)
      .select("name email phone")
      .lean();
    return actorFromUser({
      _id: String(owner.userId),
      id: String(owner.userId),
      name: (account as any)?.name ?? "",
      email: (account as any)?.email ?? "",
      phone: (account as any)?.phone ?? "",
      role: "customer",
      status: "active",
      permissions: [],
      scopedAshramIds: [],
      scopedTempleIds: [],
    } as AuthenticatedUser);
  }

  /// Confirms a booking's payment from a verified Razorpay webhook event
  /// (`payment.captured`), independent of any client callback.
  ///
  /// This exists because the client-driven path — the guest's app calling
  /// back after Razorpay's checkout succeeds — can never fire if Android
  /// kills the app's process while the guest is in an external UPI app
  /// (common on low-RAM devices). Razorpay's webhook is authoritative and
  /// server-to-server, so it confirms the booking even when the guest's
  /// device never gets the chance to.
  ///
  /// Reuses [confirmPayment] itself rather than duplicating its business
  /// logic: the per-payment signature `confirmPayment` checks is just
  /// `HMAC(order_id|payment_id, keySecret)`, which the server can compute
  /// for itself from the already-verified webhook payload, and the "acting
  /// user" it needs is reconstructed from the payment record's own
  /// `userId` (the real customer, captured when the order was created) —
  /// not from a request principal, since a webhook has none.
  ///
  /// Returns `false` when no booking in this module owns [razorpayOrderId]
  /// (the webhook belongs to a different payment flow — parking, aarti,
  /// marketplace) so the caller can try the next one.
  async confirmPaymentFromWebhook(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    captured?: { amountPaise?: number; currency?: string },
  ): Promise<boolean> {
    const payment = await this.payments
      .findOne({ "gateway.orderId": razorpayOrderId })
      .sort({ createdAt: -1 });
    if (!payment) return false;

    const keySecret = this.config.get<string>("razorpayKeySecret");
    if (!keySecret) return false;
    const signature = createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    // The acting identity is reconstructed from the payment row, which
    // recorded it when the order was created — a webhook has no request
    // principal of its own. The row names either a website account or a
    // WhatsApp customer, so both channels confirm through this one path.
    const actor = await this.actorFromPayment(payment);

    try {
      await this.confirmPayment(
        String(payment.bookingId),
        actor,
        {
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: signature,
          method: "razorpay",
        },
        captured,
      );
    } catch (error) {
      // Already confirmed (e.g. the client callback won the race) — the
      // webhook arriving after is expected and not an error from its
      // perspective; anything else is a real failure worth surfacing.
      if (!(error instanceof ConflictException)) throw error;
    }
    return true;
  }
}
