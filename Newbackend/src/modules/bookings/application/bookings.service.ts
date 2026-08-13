import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
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
import {
  BOOKING_REPOSITORY,
  type BookingRepository,
} from "../domain/booking.repository";
import {
  PLATFORM_FEE_GST_PERCENT,
  bookingReference,
  checkinCode,
  financialReference,
  reservationReference,
  roundMoney,
} from "../domain/booking.utils";
import type {
  AssignRoomDto,
  BookingDashboardQueryDto,
  CancelBookingDto,
  CheckinDto,
  CheckoutDto,
  ConfirmBookingPaymentDto,
  CreateBookingDto,
  UpdateBookingStatusDto,
} from "../presentation/dtos/booking.dto";
import { BookingPricingService } from "./booking-pricing.service";

@Injectable()
export class BookingsService {
  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly repository: BookingRepository,
    private readonly transactions: TransactionService,
    private readonly pricing: BookingPricingService,
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
    if (isAshramOwner(user))
      return (
        await this.ashrams
          .find({ ownerId: user.id, deletedAt: null })
          .select("_id")
          .lean()
      ).map((a: any) => String(a._id));
    return [
      ...new Set([
        ...(user.scopedAshramIds ?? []),
        ...(user.employerAshramId ? [user.employerAshramId] : []),
      ]),
    ];
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

  /**
   * The priced breakdown for a prospective booking, for display only.
   *
   * Delegates to the same `quote()` that `create()` uses below, so a page
   * rendering this shows exactly what the booking will cost. Only the pricing
   * and the applied coupon are returned — the room, policy and inventory rows
   * it also resolves are internal and have no business on the wire.
   */
  async quote(dto: CreateBookingDto): Promise<any> {
    const quote = await this.pricing.quote(dto);
    return {
      pricing: quote.pricing,
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

  async create(user: AuthenticatedUser, dto: CreateBookingDto): Promise<any> {
    const quote = await this.pricing.quote(dto);
    const code = checkinCode();
    const booking = await this.transactions.run(async (session) => {
      await this.repository.holdInventory({
        ashramId: dto.ashramId,
        roomId: dto.roomId,
        dates: quote.dates,
        count: dto.roomsBookedCount,
        capacity: quote.room.totalInventory,
        session,
      });
      if (quote.coupon) {
        const used = await this.redemptions
          .countDocuments({
            couponId: quote.coupon._id,
            userId: user.id,
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
      const [created] = await this.bookings.create(
        [
          {
            bookingId: bookingReference(),
            reservationNumber: reservationReference(),
            customerId: user.id,
            ashramId: dto.ashramId,
            roomId: dto.roomId,
            checkInDate: new Date(dto.checkInDate),
            checkOutDate: new Date(dto.checkOutDate),
            occupiedDates: quote.dates,
            guestsCount: dto.guestsCount,
            roomsBookedCount: dto.roomsBookedCount,
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
      await Promise.all([
        this.history.create(
          [
            {
              bookingId: created._id,
              toStatus: "pending",
              note: "Inventory held; awaiting payment",
              actorId: user.id,
              actorRole: user.role,
            },
          ],
          { session },
        ),
        this.guests.create(
          [
            {
              bookingId: created._id,
              customerId: user.id,
              guests: dto.guests ?? [],
            },
          ],
          { session },
        ),
        this.notifications.create(
          [
            {
              userId: user.id,
              bookingId: created._id,
              ashramId: dto.ashramId,
              event: "booking_held",
              title: "Reservation held",
              message: `Complete payment for ${created.bookingId} before the hold expires.`,
            },
          ],
          { session },
        ),
        this.audits.create(
          [
            {
              userId: user.id,
              action: "BOOKING_HOLD_CREATED",
              bookingId: created._id,
              ashramId: dto.ashramId,
              after: {
                status: "pending",
                totalAmount: quote.pricing.totalAmount,
              },
            },
          ],
          { session },
        ),
        this.inventoryHolds.create(
          [
            {
              bookingId: created._id,
              ashramId: dto.ashramId,
              roomId: dto.roomId,
              dates: quote.dates,
              units: dto.roomsBookedCount,
              state: "held",
              expiresAt: created.reservationExpiresAt,
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
              userId: user.id,
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

  async paymentOrder(id: string, user: AuthenticatedUser): Promise<any> {
    const booking = await this.bookings.findOne({
      _id: id,
      customerId: user.id,
    });
    if (!booking) throw new NotFoundException("Booking not found");
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
    const gateway = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
    const order = await gateway.orders.create({
      amount: Math.round(booking.pricing.totalAmount * 100),
      currency: "INR",
      receipt: booking.bookingId,
    });
    await this.payments.create({
      bookingId: booking._id,
      userId: user.id,
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
    // No secret means local development against a demo gateway, where there is
    // no signature to check. Production must never take that path — an
    // unverified confirmation would mark a booking paid for nothing — so it
    // refuses instead. Boot validation already demands the keys; this is the
    // second lock.
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

  async confirmPayment(
    id: string,
    user: AuthenticatedUser,
    dto: ConfirmBookingPaymentDto,
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
      throw new BadRequestException("Payment signature verification failed");
    }
    return this.transactions.run(async (session) => {
      if (dto.idempotencyKey) {
        const prior = await this.payments
          .findOne({ idempotencyKey: dto.idempotencyKey, status: "success" })
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
        .findOne({ _id: id, customerId: user.id })
        .session(session);
      if (!booking) throw new NotFoundException("Booking not found");
      if (booking.paymentStatus === "fully_paid")
        throw new ConflictException("Booking is already paid");

      /**
       * The hold may have lapsed while the pilgrim was on the gateway screen.
       *
       * This used to reject outright — but the signature has already been
       * verified above, so the money is real and the gateway has captured it.
       * Throwing here left the customer charged, the booking expired, and no
       * record that anything was owed back; every booking on the platform sat
       * in exactly that state.
       *
       * A lapsed hold is therefore recoverable, not fatal: the same nights are
       * re-acquired, and only if the rooms have genuinely gone to someone else
       * does the confirmation fail — which is the case a refund exists for.
       */
      const holdLapsed =
        booking.status !== "pending" ||
        (booking.reservationExpiresAt &&
          booking.reservationExpiresAt < new Date());

      if (holdLapsed) {
        if (["cancelled", "refunded"].includes(booking.status))
          throw new BadRequestException(
            "This booking was cancelled; the payment will be refunded",
          );
        await this.repository.holdInventory({
          ashramId: String(booking.ashramId),
          roomId: String(booking.roomId),
          dates: booking.occupiedDates,
          count: booking.roomsBookedCount,
          capacity: booking.roomsBookedCount,
          session,
        });
        booking.status = "pending";
        booking.reservationExpiresAt = new Date(Date.now() + 15 * 60_000);
        await this.audits.create(
          [
            {
              userId: user.id,
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

      await this.repository.confirmInventory({
        roomId: String(booking.roomId),
        dates: booking.occupiedDates,
        count: booking.roomsBookedCount,
        session,
      });
      await this.inventoryHolds.updateOne(
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
              method: dto.method,
              status: "pending",
            },
          ],
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
              note: "Payment verified",
              actorId: user.id,
              actorRole: user.role,
            },
          ],
          { session },
        ),
        this.notifications.create(
          [
            {
              userId: user.id,
              bookingId: booking._id,
              ashramId: booking.ashramId,
              event: "booking_confirmed",
              title: "Booking confirmed",
              message: `Your booking ${booking.bookingId} is confirmed.`,
            },
          ],
          { session },
        ),
        this.audits.create(
          [
            {
              userId: user.id,
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
      // Rate as charged at booking time, not today's setting.
      const gstPercent = Number(
        booking.pricing.gstPercent ?? PLATFORM_FEE_GST_PERCENT,
      );
      const invoiceNo = financialReference("INV");
      const [invoice] = await this.invoices.create(
        [
          {
            invoiceNumber: invoiceNo,
            bookingId: booking._id,
            customerId: user.id,
            ashramId: booking.ashramId,
            // Two lines, because only one of them is taxed. The stay is
            // supplied by the ashram and carries no GST; the platform fee is
            // Tirvona's own service and is taxed at the recorded rate.
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
              // The taxable value is the platform fee, not the booking total.
              taxableAmount:
                booking.pricing.gstTaxableAmount ??
                booking.pricing.platformFee ??
                0,
              gstPercent,
              // Halving can leave a stray paise on an odd amount, so the split
              // is rounded and SGST takes the remainder — cgst + sgst always
              // adds back to totalTax exactly.
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

  async historyFor(userId: string): Promise<any[]> {
    return this.bookings
      .find({ customerId: userId })
      .populate("ashramId", "name address rules images")
      .populate("roomId", "name acType type")
      .sort({ createdAt: -1 })
      .lean();
  }
  async get(id: string, user: AuthenticatedUser): Promise<any> {
    const row = await this.bookings
      .findById(id)
      .populate("ashramId", "name address rules images")
      .populate("roomId", "name acType type")
      .populate("customerId", "name email phone")
      .lean();
    if (!row) throw new NotFoundException("Booking not found");
    if (String(row.customerId?._id ?? row.customerId) !== user.id)
      await this.assertCanView(user, row);
    return row;
  }

  async dashboard(
    user: AuthenticatedUser,
    query: BookingDashboardQueryDto,
  ): Promise<any> {
    const scope = await this.scopedAshrams(user);
    if (query.ashramId && scope !== null && !scope.includes(query.ashramId))
      throw new ForbiddenException("You do not have access to this ashram.");
    const filter: any = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
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
    if (query.date) {
      const start = new Date(`${query.date}T00:00:00.000Z`);
      filter.checkInDate = {
        $gte: start,
        $lt: new Date(start.getTime() + 86_400_000),
      };
    }
    return this.bookings
      .find(filter)
      .populate("customerId", "name email phone")
      .populate("ashramId", "name address")
      .populate("roomId", "name type acType")
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean();
  }

  async assignRoom(
    id: string,
    user: AuthenticatedUser,
    dto: AssignRoomDto,
  ): Promise<any> {
    const row = await this.bookings.findById(id);
    if (!row) throw new NotFoundException("Booking not found");
    await this.assertCanManage(user, row);
    const conflict = await this.bookings.exists({
      _id: { $ne: row._id },
      ashramId: row.ashramId,
      assignedRoomNumber: dto.roomNumber,
      status: { $in: ["confirmed", "checked_in"] },
      checkInDate: { $lt: row.checkOutDate },
      checkOutDate: { $gt: row.checkInDate },
    });
    if (conflict)
      throw new ConflictException(
        `Room ${dto.roomNumber} is already assigned for overlapping dates`,
      );
    await this.assignments.findOneAndUpdate(
      { bookingId: row._id, status: { $ne: "released" } },
      {
        $set: {
          ashramId: row.ashramId,
          roomId: row.roomId,
          roomNumber: dto.roomNumber,
          assignedBy: user.id,
          assignedAt: new Date(),
          status: "assigned",
        },
      },
      { upsert: true, new: true },
    );
    row.assignedRoomNumber = dto.roomNumber;
    await row.save();
    return row;
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
    if (row.checkInCode !== dto.checkInCode)
      throw new BadRequestException("Invalid check-in code");
    return this.transactions.run(async (session) => {
      row.status = "checked_in";
      if (dto.roomNumber) row.assignedRoomNumber = dto.roomNumber;
      await row.save({ session });
      await this.checkins.create(
        [
          {
            bookingId: row._id,
            ashramId: row.ashramId,
            verifiedBy: user.id,
            checkedInAt: new Date(),
            guestCount: row.guestsCount,
            roomNumber: row.assignedRoomNumber,
            notes: dto.notes,
          },
        ],
        { session },
      );
      await this.assignments.updateOne(
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
      await this.repository.releaseInventory({
        roomId: String(row.roomId),
        dates: row.occupiedDates,
        count: row.roomsBookedCount,
        state: "booked",
        session,
      });
      await this.inventoryHolds.updateOne(
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
      row.status = "checked_out";
      await row.save({ session });
      await this.checkouts.create(
        [
          {
            bookingId: row._id,
            ashramId: row.ashramId,
            checkedOutBy: user.id,
            damages: dto.damages ?? [],
            additionalCharges: dto.additionalCharges,
            notes: dto.notes,
          },
        ],
        { session },
      );
      await this.assignments.updateOne(
        { bookingId: row._id, status: "occupied" },
        { $set: { status: "released", releasedAt: new Date() } },
        { session },
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

  async cancel(
    id: string,
    user: AuthenticatedUser,
    dto: CancelBookingDto,
  ): Promise<any> {
    const existing = await this.bookings.findById(id);
    if (!existing) throw new NotFoundException("Booking not found");
    if (String(existing.customerId) !== user.id)
      await this.assertCanManage(user, existing);
    if (!["pending", "confirmed"].includes(existing.status))
      throw new BadRequestException("This booking can no longer be cancelled");
    const policy = await this.pricing["policies"]
      .findOne({
        $or: [
          { scope: "ashram", ashramId: existing.ashramId },
          { scope: "platform" },
        ],
        isActive: true,
      })
      .sort({ scope: 1 })
      .lean();
    const hoursBefore =
      (new Date(existing.checkInDate).getTime() - Date.now()) / 3_600_000;
    const refundPercent =
      hoursBefore >= Number(policy?.cancellationFreeHours ?? 24)
        ? Number(policy?.refundBeforeWindowPercent ?? 100)
        : Number(policy?.refundInsideWindowPercent ?? 0);
    return this.transactions.run(async (session) => {
      const state = existing.status === "pending" ? "held" : "booked";
      await this.repository.releaseInventory({
        roomId: String(existing.roomId),
        dates: existing.occupiedDates,
        count: existing.roomsBookedCount,
        state,
        session,
      });
      await this.inventoryHolds.updateOne(
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
      const refundAmount =
        existing.paymentStatus === "fully_paid"
          ? Math.round(existing.pricing.amountPaid * refundPercent) / 100
          : 0;
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
                requestedBy: user.id,
                amount: refundAmount,
                percentage: refundPercent,
                reason: dto.reason,
                policySnapshot: policy ?? {
                  cancellationFreeHours: 24,
                  refundBeforeWindowPercent: 100,
                  refundInsideWindowPercent: 0,
                },
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
              actorId: user.id,
              actorRole: user.role,
            },
          ],
          { session },
        ),
        this.notifications.create(
          [
            {
              userId: existing.customerId,
              bookingId: existing._id,
              ashramId: existing.ashramId,
              event: "booking_cancelled",
              title: "Booking cancelled",
              message: `${existing.bookingId} was cancelled. Refund due: ₹${refundAmount}.`,
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
}
