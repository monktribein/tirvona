import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { InjectModel } from "../../../database/orm-nest";
import type { ClientSession, Model } from "../../../database/orm";
import { TransactionService } from "../../../common/database/transaction.service";
import { canonicalPhone } from "../../../common/phone/phone.util";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { paymentLinkKey, signPaymentLink, verifyPaymentLink } from "../../bookings/domain/payment-link-token";
import { WalletService } from "../../wallet/application/wallet.service";
import {
  MANIFEST_BOOKING_STATUSES,
  OPEN_BOOKING_STATUSES,
  YATRA_MODEL,
  CANCELLATION_PROTECTION,
  TIRVONA_APP_URL,
  YATRA_PAYMENT_LINK_PURPOSE,
  type BookingSource,
} from "../domain/yatra.constants";
import { YatraException } from "../domain/yatra.errors";
import {
  bookingRefundQuote,
  bookingReference,
  csvCell,
  DEFAULT_CANCELLATION_POLICY,
  fareCollected,
  journeyNumber,
  otherPoliciesView,
  priceServiceAddOns,
  roundMoney,
  seatFareOf,
  ticketCode,
  toPaise,
} from "../domain/yatra.utils";
import type { WhatsAppYatraContext } from "../../../integrations/whatsapp/utils/whatsapp-message.builder";
import { YatraFinanceService } from "./yatra-finance.service";
import { YatraInventoryService } from "./yatra-inventory.service";
import {
  YatraAccessService,
  type YatraActor,
  YatraAuditService,
  YatraGatewayService,
  YatraNotifier,
  YatraSettingsService,
} from "./yatra-support.service";

/** Thrown inside a confirmation transaction when a verified payment cannot be used; rolls it back. */
class UnusablePayment extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

const passengerView = (p: any) => ({
  name: p.name,
  age: p.age ?? null,
  gender: p.gender ?? "",
  phone: p.phone ?? "",
  seatNo: p.seatNo ?? "",
  checkedInAt: p.checkedInAt ?? null,
});

/** The booking as its customer sees it. */
export const bookingView = (b: any) =>
  b && {
    id: String(b._id),
    bookingReference: b.bookingReference,
    departureId: String(b.departureId),
    tourId: String(b.tourId),
    operatorId: String(b.operatorId),
    source: b.source,
    seats: b.seats ?? [],
    seatCount: b.seatCount,
    passengers: (b.passengers ?? []).map(passengerView),
    contact: { name: b.contact?.name ?? "", phone: b.contact?.phone ?? "", email: b.contact?.email ?? "" },
    boardingPointId: b.boardingPointId ?? "",
    boardingPointName: b.boardingPointName ?? "",
    droppingPointId: b.droppingPointId ?? "",
    droppingPointName: b.droppingPointName ?? "",
    departAt: b.departAt,
    tourTitle: b.tourTitle ?? "",
    pricing: {
      farePerSeat: b.pricing?.farePerSeat ?? 0,
      seatCount: b.pricing?.seatCount ?? b.seatCount,
      subtotal: b.pricing?.subtotal ?? 0,
      protected: Boolean(b.pricing?.protected),
      protectionFee: b.pricing?.protectionFee ?? 0,
      addOns: b.pricing?.addOns ?? [],
      addOnsTotal: b.pricing?.addOnsTotal ?? 0,
      seatFares: b.pricing?.seatFares ?? null,
      totalAmount: b.pricing?.totalAmount ?? 0,
      amountPaid: b.pricing?.amountPaid ?? 0,
      refundAmount: b.pricing?.refundAmount ?? 0,
      currency: b.pricing?.currency ?? "INR",
    },
    policy: b.policySnapshot ?? DEFAULT_CANCELLATION_POLICY,
    status: b.status,
    paymentStatus: b.paymentStatus,
    holdExpiresAt: b.holdExpiresAt ?? null,
    confirmedAt: b.confirmedAt ?? null,
    journeyId: b.journeyId ? String(b.journeyId) : null,
    ticketCode: ["confirmed", "cancellation_requested", "completed"].includes(b.status) ? b.ticketCode ?? "" : "",
    cancellation: b.cancellation?.status
      ? {
          status: b.cancellation.status,
          requestedAt: b.cancellation.requestedAt ?? null,
          reason: b.cancellation.reason ?? "",
          quotedPercent: b.cancellation.quotedPercent ?? 0,
          quotedAmount: b.cancellation.quotedAmount ?? 0,
          decidedAt: b.cancellation.decidedAt ?? null,
          decisionNote: b.cancellation.decisionNote ?? "",
          refundPercent: b.cancellation.refundPercent ?? 0,
          refundAmount: b.cancellation.refundAmount ?? 0,
          refundedToWalletAt: b.cancellation.refundedToWalletAt ?? null,
        }
      : null,
    history: (b.history ?? []).map((h: any) => ({ status: h.status, note: h.note, at: h.at })),
    createdAt: b.createdAt,
  };

/** The booking as the partner and admin see it: adds who booked it and through which link. */
export const bookingStaffView = (b: any) =>
  b && {
    ...bookingView(b),
    ticketCode: "",
    customerId: b.customerId ? String(b.customerId) : null,
    bookedByUserId: b.bookedByUserId ? String(b.bookedByUserId) : null,
    organizerStaffUserId: b.organizerStaffUserId ? String(b.organizerStaffUserId) : null,
    organizerMemberRole: b.organizerMemberRole ?? "",
    attribution: { code: b.attribution?.code ?? "", campaign: b.attribution?.campaign ?? "" },
    paymentLink: b.paymentLink?.jti ? { issuedAt: b.paymentLink.issuedAt, expiresAt: b.paymentLink.expiresAt } : null,
  };

@Injectable()
export class YatraBookingService {
  private readonly logger = new Logger(YatraBookingService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly transactions: TransactionService,
    private readonly access: YatraAccessService,
    private readonly audit: YatraAuditService,
    private readonly notifier: YatraNotifier,
    private readonly settings: YatraSettingsService,
    private readonly gateway: YatraGatewayService,
    private readonly inventory: YatraInventoryService,
    private readonly wallet: WalletService,
    private readonly finance: YatraFinanceService,
    @InjectModel(YATRA_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(YATRA_MODEL.Payment) private readonly payments: Model<any>,
    @InjectModel(YATRA_MODEL.Ledger) private readonly ledger: Model<any>,
    @InjectModel(YATRA_MODEL.Link) private readonly links: Model<any>,
    @InjectModel(YATRA_MODEL.Journey) private readonly journeys: Model<any>,
    @InjectModel(YATRA_MODEL.Departure) private readonly departures: Model<any>,
    @InjectModel(YATRA_MODEL.Tour) private readonly tours: Model<any>,
    @InjectModel(YATRA_MODEL.Operator) private readonly operators: Model<any>,
    @InjectModel(YATRA_MODEL.UserRef) private readonly users: Model<any>,
    @InjectModel(YATRA_MODEL.Vehicle) private readonly vehicles: Model<any>,
  ) {}

  // ================================================================ creation
  async createCustomerBooking(user: YatraActor, dto: any): Promise<any> {
    const departure = await this.loadDeparture(dto);
    let source: BookingSource = "MARKETPLACE";
    let attribution = { linkId: null as unknown, code: "", campaign: "" };
    if (dto.linkCode) {
      // A link only counts for its own partner's departure; anything else is ignored.
      const link = await this.links.findOne({ code: String(dto.linkCode).toLowerCase(), active: true }).lean();
      if (
        link &&
        String(link.operatorId) === String(departure.operatorId) &&
        String(link.tourId) === String(departure.tourId) &&
        (!link.departureId || String(link.departureId) === String(departure._id))
      ) {
        source = "OPERATOR_LINK";
        attribution = { linkId: link._id, code: link.code, campaign: link.campaign ?? "" };
      }
    }
    const settings = await this.settings.get();
    const booking = await this.createBooking({
      departure,
      dto,
      source,
      attribution,
      customerId: user.id,
      bookedByUserId: user.id,
      holdMinutes: settings.holdMinutes,
      maxSeats: settings.maxSeatsPerBooking,
    });
    return bookingView(booking);
  }

  /**
   * A partner books seats for its own customer from the same central
   * inventory. The booking is held until the customer pays Tirvona through
   * a payment link; nothing is confirmed by the partner.
   */
  async createOrganizerBooking(user: YatraActor, dto: any): Promise<any> {
    const { operator, member } = await this.access.require(user, "createBookings", { approved: true });
    const departure = await this.loadDeparture(dto);
    if (String(departure.operatorId) !== String(operator._id)) throw new YatraException("Departure not found.", 404);
    const settings = await this.settings.get();
    const booking = await this.createBooking({
      departure,
      dto,
      source: "ORGANIZER",
      attribution: { linkId: null, code: "", campaign: "" },
      customerId: null,
      bookedByUserId: user.id,
      organizer: { staffUserId: user.id, role: member.role },
      holdMinutes: settings.paymentLinkMinutes,
      maxSeats: settings.maxSeatsPerBooking,
    });
    const link = await this.issueLink(booking, user.id, settings.paymentLinkMinutes);
    await this.audit.record(user, "booking.organizer_created", { operatorId: String(operator._id), bookingId: String(booking._id), seats: booking.seats });
    return { booking: bookingStaffView(link.booking), paymentLink: link.url, paymentLinkExpiresAt: link.expiresAt };
  }

  /**
   * Holds every seat of a departure for one pilgrim whose full-bus request the partner accepted.
   * Payment is the normal Tirvona checkout; nothing here confirms the booking. The traveller names
   * are placeholders until the pilgrim fills them in on their journey page.
   */
  async createCharterBooking(input: { departure: any; customerId: string; organiserUserId: string; contact: { name: string; phone: string; email?: string } }): Promise<any> {
    const { departure } = input;
    if (!(await this.inventory.wholeBusFree(departure))) throw new YatraException("Some seats on this departure are already booked, so the whole bus can no longer be held.", 409, "SEATS_TAKEN");
    const blocked = new Set((departure.blockedSeats ?? []).map((s: string) => String(s)));
    const seatNos: string[] = (departure.seatLayout?.seats ?? []).map((s: any) => String(s.seatNo)).filter((n: string) => !blocked.has(n));
    if (!seatNos.length) throw new YatraException("This departure has no seats to hold.", 409);
    const settings = await this.settings.get();
    const first = String(input.contact.name || "Group leader").trim();
    const passengers = seatNos.map((_, i) => ({ name: i === 0 ? first : `${first} (group member ${i + 1})`, ...(i === 0 ? { phone: input.contact.phone } : {}) }));
    return this.createBooking({
      departure,
      dto: {
        passengers,
        seats: departure.seatMode === "choose" ? seatNos : [],
        contact: input.contact,
        boardingPointId: departure.boardingPoints?.[0]?.id,
        droppingPointId: departure.droppingPoints?.[0]?.id,
      },
      source: "MARKETPLACE",
      attribution: { linkId: null, code: "", campaign: "" },
      customerId: input.customerId,
      bookedByUserId: input.organiserUserId,
      holdMinutes: Math.max(settings.paymentLinkMinutes, settings.holdMinutes),
      maxSeats: Math.max(settings.maxSeatsPerBooking, seatNos.length),
    });
  }

  private async loadDeparture(dto: any): Promise<any> {
    if (dto.departureId) {
      const d = await this.departures.findById(dto.departureId).lean();
      if (!d) throw new YatraException("Departure not found.", 404);
      return d;
    }
    return this.inventory.findByCode(dto.departureCode);
  }

  private async createBooking(input: {
    departure: any;
    dto: any;
    source: BookingSource;
    attribution: { linkId: unknown; code: string; campaign: string };
    customerId: string | null;
    bookedByUserId: string;
    organizer?: { staffUserId: string; role: string };
    holdMinutes: number;
    maxSeats: number;
  }): Promise<any> {
    const { departure, dto } = input;
    const { tour, reason } = await this.inventory.context(departure);
    if (reason) throw new YatraException(reason, 409, "NOT_SELLABLE");
    const passengers = Array.isArray(dto.passengers) ? dto.passengers : [];
    const count = passengers.length;
    if (count < 1) throw new YatraException("Add at least one traveller.", 400);
    if (count > input.maxSeats) throw new YatraException(`You can book at most ${input.maxSeats} seats at a time.`, 400, "TOO_MANY_SEATS");
    const chosen = departure.seatMode === "choose" ? (dto.seats ?? []) : [];
    if (departure.seatMode === "choose" && chosen.length !== count)
      throw new YatraException("Choose one seat for each traveller.", 400, "SEATS_REQUIRED");
    const boarding = (departure.boardingPoints ?? []).find((p: any) => p.id === dto.boardingPointId) ?? (departure.boardingPoints?.length === 1 ? departure.boardingPoints[0] : null);
    if (!boarding) throw new YatraException("Choose a boarding point.", 400, "BOARDING_POINT_REQUIRED");
    // A dropping point is required only when the partner listed some.
    const droppingList: any[] = departure.droppingPoints ?? [];
    const dropping = droppingList.find((p: any) => p.id === dto.droppingPointId) ?? (droppingList.length === 1 ? droppingList[0] : null);
    if (droppingList.length && !dropping) throw new YatraException("Choose a dropping point.", 400, "DROPPING_POINT_REQUIRED");
    const fare = roundMoney(departure.fare);
    // Each chosen seat is sold at its own rate; seats given automatically cost the default fare.
    const seatRates: Record<string, number> = {};
    let subtotal = roundMoney(fare * count);
    if (departure.seatMode === "choose") {
      subtotal = 0;
      for (const seatNo of chosen) {
        const rate = seatFareOf(departure, String(seatNo));
        seatRates[String(seatNo).toUpperCase()] = rate;
        subtotal = roundMoney(subtotal + rate);
      }
    }
    const protect = Boolean(dto.cancellationProtection);
    const protectionFee = protect ? roundMoney(CANCELLATION_PROTECTION.feePerSeat * count) : 0;
    // Optional services of the tour (stay, food, taxi), priced per traveller at the partner's rate.
    const addOns = priceServiceAddOns(tour?.serviceAddOns, dto.addOns, count);
    const total = roundMoney(subtotal + protectionFee + addOns.total);
    const holdUntil = new Date(Date.now() + input.holdMinutes * 60_000);
    // The commission rule that applies now stays with the booking for life.
    const commissionSnapshot = await this.finance.snapshotFor("yatra_booking", { source: input.source, operatorId: departure.operatorId });

    return this.transactions.run(async (session) => {
      const [booking] = await this.bookings.create(
        [
          {
            bookingReference: bookingReference(),
            departureId: departure._id,
            tourId: departure.tourId,
            operatorId: departure.operatorId,
            customerId: input.customerId,
            source: input.source,
            bookedByUserId: input.bookedByUserId,
            organizerStaffUserId: input.organizer?.staffUserId ?? null,
            organizerMemberRole: input.organizer?.role ?? "",
            attribution: input.attribution,
            seats: [],
            seatCount: count,
            passengers: [],
            contact: {
              name: String(dto.contact?.name ?? passengers[0]?.name ?? "").trim(),
              phone: canonicalPhone(String(dto.contact?.phone ?? passengers[0]?.phone ?? "")),
              email: String(dto.contact?.email ?? "").trim().toLowerCase(),
            },
            boardingPointId: boarding.id,
            boardingPointName: boarding.name,
            droppingPointId: dropping?.id ?? "",
            droppingPointName: dropping?.name ?? "",
            departAt: departure.departAt,
            tourTitle: tour?.title ?? "",
            pricing: { farePerSeat: fare, seatCount: count, subtotal, protected: protect, protectionFee, addOns: addOns.lines, addOnsTotal: addOns.total, seatFares: departure.seatMode === "choose" ? seatRates : null, totalAmount: total, amountPaid: 0, refundAmount: 0, currency: "INR" },
            policySnapshot: tour?.cancellationPolicy ?? DEFAULT_CANCELLATION_POLICY,
            commissionSnapshot,
            status: "held",
            paymentStatus: "unpaid",
            holdExpiresAt: holdUntil,
            history: [{ status: "held", note: `Seats held (${input.source.toLowerCase().replace("_", " ")})`, by: input.bookedByUserId }],
          },
        ],
        { session },
      );
      const seats = await this.inventory.holdSeats(session, departure, booking._id, { seats: chosen, count }, holdUntil);
      booking.seats = seats;
      booking.passengers = passengers.map((p: any, i: number) => ({
        name: String(p.name).trim(),
        age: p.age ?? null,
        gender: p.gender ?? "",
        phone: p.phone ? canonicalPhone(String(p.phone)) : "",
        seatNo: seats[i],
        checkedInAt: null,
      }));
      await booking.save({ session });
      return booking;
    });
  }

  // ========================================================== customer views
  private async ownBooking(user: YatraActor, bookingId: string): Promise<any> {
    const booking = await this.bookings.findOne({ _id: bookingId, customerId: user.id }).lean();
    if (!booking) throw new YatraException("Booking not found.", 404);
    return booking;
  }

  async listMine(user: YatraActor, status: string | undefined, page: number, limit: number): Promise<any> {
    const filter: Record<string, unknown> = { customerId: user.id };
    if (status) filter.status = status;
    const [rows, total] = await Promise.all([
      this.bookings.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.bookings.countDocuments(filter),
    ]);
    return { items: rows.map(bookingView), total };
  }

  async getMine(user: YatraActor, bookingId: string): Promise<any> {
    const booking = await this.ownBooking(user, bookingId);
    const departure = await this.departures.findById(booking.departureId).lean();
    const operator = await this.operators.findById(booking.operatorId).select("organisationName displayName contactPhone").lean();
    return {
      booking: bookingView(booking),
      departure: departure && { departureCode: departure.departureCode, departAt: departure.departAt, returnAt: departure.returnAt, boardingPoints: departure.boardingPoints ?? [], droppingPoints: departure.droppingPoints ?? [], status: departure.status },
      operator: operator && { name: operator.displayName || operator.organisationName, contactPhone: operator.contactPhone ?? "" },
    };
  }

  /** The customer gives up an unpaid hold; the seats go back on sale at once. */
  async releaseMine(user: YatraActor, bookingId: string): Promise<any> {
    await this.ownBooking(user, bookingId);
    return bookingView(await this.releaseOpen(bookingId, user, "Released by customer", { customerId: user.id }));
  }

  private async releaseOpen(bookingId: string, actor: YatraActor, note: string, scope: Record<string, unknown>): Promise<any> {
    return this.transactions.run(async (session) => {
      const booking = await this.bookings.findOne({ _id: bookingId, ...scope }).session(session);
      if (!booking) throw new YatraException("Booking not found.", 404);
      if (!OPEN_BOOKING_STATUSES.includes(booking.status)) throw new YatraException("Only an unpaid booking can be released.", 409);
      await this.inventory.releaseSeats(session, booking.departureId, booking._id);
      await this.payments.updateMany({ bookingId: booking._id, status: "pending" }, { $set: { status: "superseded", failureReason: note } }, { session });
      booking.status = "cancelled";
      booking.holdExpiresAt = null;
      booking.history.push({ status: "cancelled", note, by: actor.id });
      await booking.save({ session });
      return booking;
    });
  }

  // ================================================================ payments
  async paymentOrder(user: YatraActor, bookingId: string): Promise<any> {
    const booking = await this.ownBooking(user, bookingId);
    return this.createOrderFor(booking, user.id, "checkout");
  }

  private async createOrderFor(booking: any, payerId: string, channel: string): Promise<any> {
    if (booking.paymentStatus === "paid") throw new YatraException("This booking is already paid.", 409, "ALREADY_PAID");
    if (!OPEN_BOOKING_STATUSES.includes(booking.status)) throw new YatraException("This booking can no longer be paid for.", 409, "NOT_PAYABLE");
    if (!booking.holdExpiresAt || new Date(booking.holdExpiresAt).getTime() <= Date.now())
      throw new YatraException("Your seat hold expired. Please book again.", 410, "HOLD_EXPIRED");
    const total = roundMoney(booking.pricing.totalAmount);
    const order = await this.gateway.createOrder(total, booking.bookingReference, { module: "yatra", bookingId: String(booking._id) });
    await this.transactions.run(async (session) => {
      await this.payments.updateMany(
        { bookingId: booking._id, purpose: "booking", status: "pending" },
        { $set: { status: "superseded", failureReason: "Superseded by a newer payment attempt" } },
        { session },
      );
      await this.payments.create(
        [
          {
            purpose: "booking",
            bookingId: booking._id,
            operatorId: booking.operatorId,
            userId: payerId,
            amount: total,
            method: order.demo ? "demo" : "razorpay",
            channel,
            status: "pending",
            gateway: { orderId: order.orderId, provider: order.demo ? "demo" : "razorpay" },
          },
        ],
        { session },
      );
      await this.bookings.updateOne({ _id: booking._id, status: "held" }, { $set: { status: "payment_pending" } }, { session });
    });
    return {
      demo: order.demo,
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId,
      bookingId: String(booking._id),
      holdExpiresAt: booking.holdExpiresAt,
      name: "Tirvona Yatra",
      description: `${booking.tourTitle} · ${booking.seatCount} seat(s)`,
    };
  }

  async confirmPayment(user: YatraActor, bookingId: string, dto: any): Promise<any> {
    const booking = await this.ownBooking(user, bookingId);
    return this.confirmFromClient(booking, dto);
  }

  private async confirmFromClient(booking: any, dto: any): Promise<any> {
    if (!this.gateway.verifySignature(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature ?? ""))
      throw new YatraException("Payment verification failed. If money was taken, it will be confirmed automatically or returned.", 400, "SIGNATURE_INVALID");
    // The order must be one this server created for this very booking.
    const payment = await this.payments.findOne({ bookingId: booking._id, purpose: "booking", "gateway.orderId": dto.razorpay_order_id }).lean();
    if (!payment) throw new YatraException("This payment does not belong to this booking.", 400, "ORDER_MISMATCH");
    const result = await this.settle(payment._id, { paymentId: dto.razorpay_payment_id, signature: dto.razorpay_signature ?? "", via: "checkout" });
    if (result.outcome === "refunded")
      throw new YatraException(
        "Your payment was received but the seats were no longer available. The full amount has been added to your Tirvona wallet.",
        409,
        "PAYMENT_REFUNDED_TO_WALLET",
      );
    const fresh = await this.bookings.findById(booking._id).lean();
    return { booking: bookingView(fresh), journeyId: fresh.journeyId ? String(fresh.journeyId) : null };
  }

  /** Razorpay webhook: true when the order belongs to Yatra (handled or already handled). */
  async confirmPaymentFromWebhook(orderId: string, paymentId: string, captured?: { amountPaise?: number }): Promise<boolean> {
    const payment = await this.payments.findOne({ "gateway.orderId": orderId }).lean();
    if (!payment) return false;
    if (payment.purpose !== "booking") return false;
    await this.settle(payment._id, { paymentId, via: "webhook", capturedPaise: captured?.amountPaise });
    return true;
  }

  /**
   * Applies one verified payment exactly once. Duplicate deliveries (client
   * and webhook, or webhook retries) are no-ops. A payment that cannot be
   * used — booking cancelled, already paid, or its seats taken after the
   * hold lapsed — is never kept: the payer gets it back in their wallet.
   */
  private async settle(
    paymentRowId: unknown,
    proof: { paymentId: string; signature?: string; via: string; capturedPaise?: number },
  ): Promise<{ outcome: "confirmed" | "already" | "refunded"; bookingId: string }> {
    let bookingId = "";
    try {
      const outcome = await this.transactions.run(async (session) => {
        const payment = await this.payments.findById(paymentRowId).session(session);
        if (!payment) throw new YatraException("Payment not found.", 404);
        bookingId = String(payment.bookingId);
        if (payment.status === "paid") {
          if (payment.gateway?.paymentId === proof.paymentId) return "already" as const;
          throw new UnusablePayment("A second payment arrived for an order that is already paid.");
        }
        const reused = await this.payments.findOne({ "gateway.paymentId": proof.paymentId, _id: { $ne: payment._id } }).session(session);
        if (reused) return "already" as const;
        const booking = await this.bookings.findById(payment.bookingId).session(session);
        if (!booking) throw new UnusablePayment("Booking not found.");
        if (proof.capturedPaise !== undefined && proof.capturedPaise !== toPaise(payment.amount))
          throw new UnusablePayment("The captured amount does not match the order.");
        if (roundMoney(payment.amount) !== roundMoney(booking.pricing.totalAmount))
          throw new UnusablePayment("The payment amount does not match the booking.");
        if (["confirmed", "cancellation_requested", "completed"].includes(booking.status))
          throw new UnusablePayment("The booking was already paid.");
        if (booking.status === "cancelled") throw new UnusablePayment("The booking was cancelled before the payment arrived.");
        const departure = await this.departures.findById(booking.departureId).session(session);
        if (!departure || departure.status === "cancelled" || new Date(departure.departAt).getTime() <= Date.now())
          throw new UnusablePayment("The departure is closed.");
        if (!(await this.inventory.confirmSeats(session, departure._id, booking._id, booking.seats)))
          throw new UnusablePayment("The seats were taken after the hold expired.");

        const now = new Date();
        payment.status = "paid";
        payment.paidAt = now;
        payment.confirmedBy = proof.via;
        payment.set("gateway.paymentId", proof.paymentId);
        payment.set("gateway.signature", proof.signature ?? "");
        await payment.save({ session });
        await this.payments.updateMany(
          { bookingId: booking._id, purpose: "booking", status: "pending", _id: { $ne: payment._id } },
          { $set: { status: "superseded", failureReason: "Another payment confirmed this booking" } },
          { session },
        );

        const tour = await this.tours.findById(booking.tourId).session(session);
        const [journey] = await this.journeys.create(
          [
            {
              journeyNumber: journeyNumber(),
              customerId: payment.userId,
              bookingId: booking._id,
              departureId: booking.departureId,
              tourId: booking.tourId,
              operatorId: booking.operatorId,
              title: tour?.title ?? booking.tourTitle,
              originCity: tour?.originCity ?? "",
              destinationCity: tour?.destinationCity ?? "",
              startDate: departure.departAt,
              endDate: departure.returnAt ?? new Date(new Date(departure.departAt).getTime() + Number(tour?.durationDays ?? 1) * 86_400_000),
              travellers: booking.seatCount,
              status: "upcoming",
            },
          ],
          { session },
        );
        booking.customerId = payment.userId;
        booking.status = "confirmed";
        booking.paymentStatus = "paid";
        booking.pricing.amountPaid = booking.pricing.totalAmount;
        booking.confirmedAt = now;
        booking.holdExpiresAt = null;
        booking.journeyId = journey._id;
        booking.ticketCode = ticketCode();
        booking.history.push({ status: "confirmed", note: `Payment verified (${proof.via})`, by: payment.userId });
        await booking.save({ session });
        await this.inventory.adjustBooked(session, departure._id, booking.seatCount);
        await this.finance.postBookingEarning(session, booking, journey.endDate);
        if (booking.attribution?.linkId)
          await this.links.updateOne({ _id: booking.attribution.linkId }, { $inc: { bookingsCount: 1 } }, { session });
        await this.ledger.create(
          [
            {
              type: "booking_payment",
              direction: "credit",
              amount: payment.amount,
              bookingId: booking._id,
              paymentId: payment._id,
              operatorId: booking.operatorId,
              customerId: payment.userId,
              source: booking.source,
              reference: booking.bookingReference,
              description: `Yatra booking ${booking.bookingReference}`,
              idempotencyKey: `yatra:payment:${proof.paymentId}`,
            },
          ],
          { session },
        );
        return "confirmed" as const;
      });
      if (outcome === "confirmed") await this.afterConfirmed(bookingId);
      return { outcome, bookingId };
    } catch (error) {
      if (!(error instanceof UnusablePayment)) throw error;
      const outcome = await this.refundUnusable(paymentRowId, proof, error.reason);
      return { outcome, bookingId };
    }
  }

  private async refundUnusable(
    paymentRowId: unknown,
    proof: { paymentId: string; signature?: string; via: string },
    reason: string,
  ): Promise<"refunded" | "already"> {
    try {
      return await this.transactions.run(async (session) => {
        const payment = await this.payments.findById(paymentRowId).session(session);
        const paidAlready = payment.status === "paid";
        if (paidAlready && payment.gateway?.paymentId === proof.paymentId) return "already" as const;
        if (await this.ledger.exists({ idempotencyKey: `yatra:unapplied:${proof.paymentId}` }).session(session)) return "already" as const;
        const booking = await this.bookings.findById(payment.bookingId).session(session);
        if (!paidAlready) {
          payment.status = "paid";
          payment.unapplied = true;
          payment.paidAt = new Date();
          payment.confirmedBy = proof.via;
          payment.failureReason = `UNAPPLIED_PAYMENT: ${reason}`;
          payment.set("gateway.paymentId", proof.paymentId);
        payment.set("gateway.signature", proof.signature ?? "");
          await payment.save({ session });
        }
        await this.wallet.credit(
          {
            userId: String(payment.userId),
            amount: payment.amount,
            module: "yatra",
            category: "refund",
            sourceId: payment.bookingId,
            reference: booking?.bookingReference ?? "",
            description: `Yatra payment returned: ${reason}`,
            idempotencyKey: `refund:yatra:unapplied:${proof.paymentId}`,
            actorRole: "system",
          },
          session,
        );
        const common = { bookingId: payment.bookingId, paymentId: payment._id, operatorId: payment.operatorId, customerId: payment.userId, reference: booking?.bookingReference ?? "", source: booking?.source ?? "" };
        await this.ledger.create(
          [
            { ...common, type: "unapplied_payment", direction: "credit", amount: payment.amount, description: `Payment ${proof.paymentId} could not be used: ${reason}`, idempotencyKey: `yatra:unapplied:${proof.paymentId}` },
            { ...common, type: "unapplied_refund", direction: "debit", amount: payment.amount, description: "Returned to the payer's Tirvona wallet", idempotencyKey: `yatra:unapplied-refund:${proof.paymentId}` },
          ],
          { session, ordered: true },
        );
        this.logger.warn(`Yatra payment ${proof.paymentId} refunded to wallet: ${reason}`);
        return "refunded" as const;
      });
    } catch (error: any) {
      if (error?.code === 11000) return "already";
      throw error;
    }
  }

  private async afterConfirmed(bookingId: string): Promise<void> {
    const booking = await this.bookings.findById(bookingId).lean();
    if (!booking) return;
    await this.notifier.users(
      [String(booking.customerId)],
      "Yatra booking confirmed",
      `${booking.tourTitle}: ${booking.seatCount} seat(s), booking ${booking.bookingReference}.`,
      booking.journeyId ? `/profile/journeys/${String(booking.journeyId)}` : "/profile/journeys",
      "yatra.booking",
    );
    await this.notifier.operatorTeam(String(booking.operatorId), "New confirmed Yatra booking", `${booking.bookingReference}: ${booking.seatCount} seat(s) on ${booking.tourTitle}.`, `/operator/bookings/${bookingId}`);
    await this.notifier.emailCustomer(booking, {
      title: "Your Yatra booking is confirmed",
      message: `${booking.tourTitle} on ${new Date(booking.departAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.`,
      reference: booking.bookingReference,
      highlight: booking.ticketCode ? { label: "Ticket code", code: booking.ticketCode } : undefined,
      details: [
        { label: "Seats", value: (booking.seats ?? []).join(", ") },
        { label: "Boarding point", value: booking.boardingPointName ?? "" },
        { label: "Amount paid", value: `₹${booking.pricing?.amountPaid ?? 0}` },
      ],
      ctaPath: booking.journeyId ? `/profile/journeys/${String(booking.journeyId)}` : "/profile/journeys",
    });
    // WhatsApp ticket: the same message whether the pilgrim or a partner made the booking.
    try {
      await this.notifier.whatsappTicket(booking, await this.whatsappContext(booking));
    } catch (error) {
      this.logger.warn(`Yatra WhatsApp ticket not sent for ${booking.bookingReference}: ${(error as Error).message}`);
    }
  }

  /** What the WhatsApp ticket says: seats, passengers, points, rules and the refund policy in plain words. */
  private async whatsappContext(booking: any): Promise<WhatsAppYatraContext> {
    const [departure, tour, operator] = await Promise.all([
      this.departures.findById(booking.departureId).lean(),
      this.tours.findById(booking.tourId).lean(),
      this.operators.findById(booking.operatorId).select("displayName organisationName").lean(),
    ]);
    const vehicle = departure?.vehicleId ? await this.vehicles.findById(departure.vehicleId).select("registrationNumber make model isAc").lean() : null;
    const boarding = (departure?.boardingPoints ?? []).find((p: any) => p.id === booking.boardingPointId);
    const dropping = (departure?.droppingPoints ?? []).find((p: any) => p.id === booking.droppingPointId);
    const passengers = (Array.isArray(booking.passengers) ? booking.passengers : []).map((p: any, i: number) => ({
      name: String(p?.name ?? "").trim(),
      seat: p?.seatNo ?? p?.seat ?? booking.seats?.[i],
    }));
    const policy = booking.policySnapshot ?? DEFAULT_CANCELLATION_POLICY;
    const refundLines: string[] = [];
    for (const w of policy.windows ?? [])
      refundLines.push(`${w.label || `${w.hoursBefore} hours or more before departure`}: ${w.refundPercent}% of the fare refunded`);
    refundLines.push(policy.notes || `Cancelling later: ${Number(policy.defaultRefundPercent ?? 0)}% refund.`);
    if (booking.pricing?.protected)
      refundLines.unshift(`You added cancellation protection: cancel at least ${CANCELLATION_PROTECTION.cutoffHours} hours before departure for a full refund of the fare. The ₹${booking.pricing.protectionFee} protection fee is not refundable.`);
    refundLines.push("Refunds are credited to your Tirvona Wallet.");
    const siteUrl = String(this.config.get<string>("frontendUrl") ?? "").replace(/\/+$/, "");
    const route = [tour?.originCity, tour?.destinationCity].filter(Boolean).join(" → ");
    return {
      guestName: booking.contact?.name || passengers[0]?.name,
      reference: booking.bookingReference,
      ticketCode: booking.ticketCode,
      tourTitle: booking.tourTitle || tour?.title,
      route,
      departAt: booking.departAt,
      returnAt: departure?.returnAt ?? undefined,
      seats: booking.seats ?? [],
      passengers,
      boardingName: booking.boardingPointName || boarding?.name,
      boardingAddress: boarding?.address || boarding?.landmark || "",
      boardingTime: boarding?.time,
      droppingName: booking.droppingPointName || dropping?.name,
      droppingTime: dropping?.time,
      vehicle: vehicle ? [vehicle.registrationNumber, [vehicle.make, vehicle.model].filter(Boolean).join(" "), vehicle.isAc ? "AC" : ""].filter(Boolean).join(" · ") : undefined,
      operatorName: operator?.displayName || operator?.organisationName,
      amountPaid: booking.pricing?.amountPaid,
      protectionFee: booking.pricing?.protected ? booking.pricing?.protectionFee : undefined,
      addOnLines: (booking.pricing?.addOns ?? []).map((a: any) => `${a.title} – ₹${a.amount}`),
      currency: booking.pricing?.currency,
      refundLines,
      ruleLines: otherPoliciesView(tour?.otherPolicies).map((p) => `${p.title}: ${p.text}`),
      ticketUrl: booking.journeyId && siteUrl ? `${siteUrl}/profile/journeys/${String(booking.journeyId)}` : undefined,
      appUrl: TIRVONA_APP_URL,
    };
  }

  // ============================================================ payment links
  private linkKey(): Buffer {
    const key = paymentLinkKey({ explicit: this.config.get<string>("paymentLinkSecret"), jwtSecret: this.config.get<string>("jwtSecret") });
    if (!key) throw new YatraException("Payment links are not configured.", 503);
    return key;
  }

  private async issueLink(booking: any, actorId: string, minutes: number): Promise<{ url: string; expiresAt: Date; booking: any }> {
    const jti = randomBytes(9).toString("base64url");
    const expiresAt = new Date(Math.min(new Date(booking.holdExpiresAt).getTime(), Date.now() + minutes * 60_000));
    const token = signPaymentLink({ v: 1, p: YATRA_PAYMENT_LINK_PURPOSE, b: String(booking._id), j: jti, iat: Date.now(), exp: expiresAt.getTime() }, this.linkKey());
    const updated = await this.bookings.findOneAndUpdate(
      { _id: booking._id },
      { $set: { paymentLink: { jti, issuedAt: new Date(), expiresAt, issuedBy: actorId } } },
      { new: true },
    ).lean();
    const base = String(this.config.get<string>("frontendUrl") ?? "").replace(/\/+$/, "");
    return { url: `${base}/yatra/pay/${token}`, expiresAt, booking: updated };
  }

  /** A fresh payment link for a partner booking; re-holds its seats if the old hold lapsed. */
  async reissuePaymentLink(user: YatraActor, bookingId: string): Promise<any> {
    const { operator } = await this.access.require(user, "createBookings", { approved: true });
    const settings = await this.settings.get();
    const holdUntil = new Date(Date.now() + settings.paymentLinkMinutes * 60_000);
    const booking = await this.transactions.run(async (session) => {
      const row = await this.bookings.findOne({ _id: bookingId, operatorId: operator._id, source: "ORGANIZER" }).session(session);
      if (!row) throw new YatraException("Booking not found.", 404);
      if (!OPEN_BOOKING_STATUSES.includes(row.status) && row.status !== "expired")
        throw new YatraException("Only an unpaid booking can get a new payment link.", 409);
      const departure = await this.departures.findById(row.departureId).session(session);
      const { reason } = await this.inventory.context(departure);
      if (reason) throw new YatraException(reason, 409, "NOT_SELLABLE");
      if (!(await this.inventory.reholdSeats(session, row.departureId, row._id, row.seats, holdUntil)))
        throw new YatraException("Some of these seats were sold to someone else. Create a new booking.", 409, "SEAT_TAKEN");
      row.status = "held";
      row.holdExpiresAt = holdUntil;
      row.history.push({ status: "held", note: "Payment link reissued", by: user.id });
      await row.save({ session });
      await this.payments.updateMany({ bookingId: row._id, status: "pending" }, { $set: { status: "superseded", failureReason: "Payment link reissued" } }, { session });
      return row;
    });
    const link = await this.issueLink(booking, user.id, settings.paymentLinkMinutes);
    await this.audit.record(user, "booking.payment_link_issued", { bookingId, operatorId: String(operator._id) });
    return { booking: bookingStaffView(link.booking), paymentLink: link.url, paymentLinkExpiresAt: link.expiresAt };
  }

  private async bookingForToken(token: string): Promise<any> {
    const verdict = verifyPaymentLink(token, this.linkKey(), Date.now(), YATRA_PAYMENT_LINK_PURPOSE);
    if (!verdict.ok && verdict.reason !== "expired") throw new YatraException("This payment link is not valid.", 404, "LINK_INVALID");
    const claims = verdict.ok ? verdict.claims : JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
    const booking = await this.bookings.findById(claims.b).lean();
    if (!booking || booking.paymentLink?.jti !== claims.j) throw new YatraException("This payment link was replaced by a newer one.", 410, "LINK_REPLACED");
    return { booking, expired: !verdict.ok };
  }

  async paymentLinkSummary(token: string): Promise<any> {
    const { booking, expired } = await this.bookingForToken(token);
    const operator = await this.operators.findById(booking.operatorId).select("organisationName displayName").lean();
    const status = ["confirmed", "cancellation_requested", "completed"].includes(booking.status)
      ? "paid"
      : booking.status === "cancelled"
        ? "cancelled"
        : expired || booking.status === "expired" || new Date(booking.holdExpiresAt ?? 0).getTime() <= Date.now()
          ? "expired"
          : "payable";
    return {
      status,
      bookingReference: booking.bookingReference,
      tourTitle: booking.tourTitle,
      departAt: booking.departAt,
      boardingPointName: booking.boardingPointName,
      seats: booking.seats,
      travellers: (booking.passengers ?? []).map((p: any) => p.name),
      leadName: booking.contact?.name ?? "",
      amount: booking.pricing.totalAmount,
      currency: "INR",
      holdExpiresAt: booking.holdExpiresAt,
      organiser: operator?.displayName || operator?.organisationName || "",
      claimed: Boolean(booking.customerId),
    };
  }

  /** The customer signs in and pays: the booking becomes theirs (for the journey and any refund). */
  async paymentLinkOrder(user: YatraActor, token: string): Promise<any> {
    const { booking, expired } = await this.bookingForToken(token);
    if (expired) throw new YatraException("This payment link has expired. Ask your partner for a new one.", 410, "LINK_EXPIRED");
    const claimed = await this.bookings.findOneAndUpdate(
      { _id: booking._id, $or: [{ customerId: null }, { customerId: user.id }] },
      { $set: { customerId: user.id } },
      { new: true },
    ).lean();
    if (!claimed) throw new YatraException("This booking is already linked to another Tirvona account.", 409, "LINK_CLAIMED");
    return this.createOrderFor(claimed, user.id, "payment_link");
  }

  async paymentLinkConfirm(user: YatraActor, token: string, dto: any): Promise<any> {
    const { booking } = await this.bookingForToken(token);
    if (String(booking.customerId) !== String(user.id)) throw new YatraException("This booking is linked to another Tirvona account.", 409, "LINK_CLAIMED");
    return this.confirmFromClient(booking, dto);
  }

  // ================================================================== ticket
  async ticket(user: YatraActor, bookingId: string): Promise<any> {
    const booking = await this.ownBooking(user, bookingId);
    if (!["confirmed", "cancellation_requested", "completed"].includes(booking.status))
      throw new YatraException("A ticket is available once the booking is confirmed.", 409);
    const payload = JSON.stringify({ t: "yatra", r: booking.bookingReference, c: booking.ticketCode });
    const qr = await QRCode.toDataURL(payload, { width: 480, margin: 2, errorCorrectionLevel: "M" });
    const departure = await this.departures.findById(booking.departureId).lean();
    const boarding = (departure?.boardingPoints ?? []).find((p: any) => p.id === booking.boardingPointId);
    const dropping = (departure?.droppingPoints ?? []).find((p: any) => p.id === booking.droppingPointId);
    return { booking: bookingView(booking), qr, boardingPoint: boarding ?? null, droppingPoint: dropping ?? null, departureCode: departure?.departureCode ?? "" };
  }

  // ============================================================ cancellation
  async refundPreview(user: YatraActor, bookingId: string): Promise<any> {
    const booking = await this.ownBooking(user, bookingId);
    if (booking.paymentStatus !== "paid") return { refundPercent: 0, refundAmount: 0, label: "Nothing has been paid." };
    return bookingRefundQuote(booking);
  }

  async requestCancellation(user: YatraActor, bookingId: string, reason: string, asOrganizer = false): Promise<any> {
    const scope: Record<string, unknown> = { _id: bookingId };
    if (asOrganizer) {
      const { operator } = await this.access.require(user, "createBookings", { writable: true });
      Object.assign(scope, { operatorId: operator._id });
    } else scope.customerId = user.id;
    const booking = await this.bookings.findOne(scope);
    if (!booking) throw new YatraException("Booking not found.", 404);
    if (booking.status !== "confirmed") throw new YatraException("Only a confirmed booking can be cancelled.", 409);
    if (new Date(booking.departAt).getTime() <= Date.now()) throw new YatraException("This journey has already departed.", 409);
    const quote = bookingRefundQuote(booking);
    booking.status = "cancellation_requested";
    booking.cancellation = {
      status: "requested",
      requestedAt: new Date(),
      requestedBy: user.id,
      reason: reason.trim(),
      quotedPercent: quote.refundPercent,
      quotedAmount: quote.refundAmount,
    };
    booking.history.push({ status: "cancellation_requested", note: reason.trim(), by: user.id });
    await booking.save();
    await this.audit.record(user, "booking.cancellation_requested", { bookingId, asOrganizer, quote });
    const admins = await this.users.find({ role: "super_admin", status: "active" }).select("_id").limit(20).lean();
    await this.notifier.users(admins.map((a: any) => String(a._id)), "Yatra cancellation request", `${booking.bookingReference}: refund quote ₹${quote.refundAmount}.`, "/admin/yatra/cancellations", "yatra.admin");
    await this.notifier.operatorTeam(String(booking.operatorId), "Cancellation requested", `${booking.bookingReference} asked to cancel.`, `/operator/bookings/${bookingId}`);
    return { booking: bookingView(booking.toObject()), quote };
  }

  /**
   * Super Admin approves or rejects a cancellation. An approved refund goes
   * to the customer's Tirvona wallet exactly once (idempotency key per
   * booking) and the seats return to the central inventory.
   */
  async decideCancellation(
    admin: YatraActor,
    bookingId: string,
    decision: "approve" | "reject",
    options: { refundPercent?: number; note?: string; direct?: boolean } = {},
  ): Promise<any> {
    const note = (options.note ?? "").trim();
    if (decision === "reject" && note.length < 3) throw new YatraException("Please give a reason (at least 3 characters).", 400);
    const result = await this.transactions.run(async (session) => {
      const booking = await this.bookings.findById(bookingId).session(session);
      if (!booking) throw new YatraException("Booking not found.", 404);
      const allowed = options.direct ? ["confirmed", "cancellation_requested"] : ["cancellation_requested"];
      if (!allowed.includes(booking.status)) throw new YatraException("This booking has no open cancellation request.", 409);
      if (decision === "reject") {
        booking.status = "confirmed";
        booking.cancellation.status = "rejected";
        booking.cancellation.decidedAt = new Date();
        booking.cancellation.decidedBy = admin.id;
        booking.cancellation.decisionNote = note;
        booking.history.push({ status: "confirmed", note: `Cancellation rejected: ${note}`, by: admin.id });
        await booking.save({ session });
        return { booking, refund: 0 };
      }
      const quote = bookingRefundQuote(booking, new Date(), options.refundPercent);
      const now = new Date();
      if (!booking.cancellation?.status) {
        booking.cancellation = { status: "requested", requestedAt: now, requestedBy: admin.id, reason: note || "Cancelled by Tirvona", quotedPercent: quote.refundPercent, quotedAmount: quote.refundAmount };
      }
      booking.status = "cancelled";
      booking.cancellation.status = "approved";
      booking.cancellation.decidedAt = now;
      booking.cancellation.decidedBy = admin.id;
      booking.cancellation.decisionNote = note;
      booking.cancellation.refundPercent = quote.refundPercent;
      booking.cancellation.refundAmount = quote.refundAmount;
      booking.pricing.refundAmount = quote.refundAmount;
      if (quote.refundAmount > 0) {
        booking.paymentStatus = quote.refundAmount >= fareCollected(booking) ? "refunded" : "partially_refunded";
        booking.cancellation.refundedToWalletAt = now;
      }
      booking.history.push({ status: "cancelled", note: `Cancelled. Refund ₹${quote.refundAmount} (${quote.refundPercent}%) to wallet.`, by: admin.id });
      await booking.save({ session });
      await this.inventory.releaseSeats(session, booking.departureId, booking._id);
      await this.inventory.adjustBooked(session, booking.departureId, -booking.seatCount);
      await this.journeys.updateOne({ bookingId: booking._id }, { $set: { status: "cancelled" } }, { session });
      if (quote.refundAmount > 0) {
        await this.wallet.credit(
          {
            userId: String(booking.customerId),
            amount: quote.refundAmount,
            module: "yatra",
            category: "refund",
            sourceId: booking._id,
            reference: booking.bookingReference,
            description: `Refund for cancelled Yatra booking ${booking.bookingReference}`,
            idempotencyKey: `refund:yatra:${String(booking._id)}`,
            actorId: admin.id,
            actorRole: admin.role,
          },
          session,
        );
        await this.ledger.create(
          [
            {
              type: "booking_refund",
              direction: "debit",
              amount: quote.refundAmount,
              bookingId: booking._id,
              operatorId: booking.operatorId,
              customerId: booking.customerId,
              source: booking.source,
              reference: booking.bookingReference,
              description: `Refund ${quote.refundPercent}% to wallet`,
              idempotencyKey: `yatra:refund:${String(booking._id)}`,
              recordedBy: admin.id,
            },
          ],
          { session },
        );
        await this.finance.postBookingRefund(session, booking, quote.refundAmount);
      }
      await this.audit.record(admin, "booking.cancellation_approved", { bookingId, refundPercent: quote.refundPercent, refundAmount: quote.refundAmount, direct: Boolean(options.direct) }, { before: { status: "cancellation_requested" }, after: { status: "cancelled" } }, session);
      return { booking, refund: quote.refundAmount };
    });
    const b = result.booking;
    await this.notifier.users(
      [String(b.customerId)],
      decision === "approve" ? "Yatra booking cancelled" : "Cancellation not approved",
      decision === "approve"
        ? `${b.bookingReference} is cancelled.${result.refund ? ` ₹${result.refund} was added to your Tirvona wallet.` : ""}`
        : `${b.bookingReference}: ${note}`,
      b.journeyId ? `/profile/journeys/${String(b.journeyId)}` : "/profile/journeys",
      "yatra.booking",
    );
    if (decision === "reject") await this.audit.record(admin, "booking.cancellation_rejected", { bookingId, note });
    else
      await this.notifier.emailCustomer(b, {
        title: "Your Yatra booking is cancelled",
        message: result.refund ? `₹${result.refund} was added to your Tirvona wallet.` : "No refund applies under the cancellation policy.",
        reference: b.bookingReference,
        ctaPath: "/profile/wallet",
      });
    return bookingStaffView(b.toObject ? b.toObject() : b);
  }

  /** Tirvona cancels a whole departure: every paid traveller gets a full refund to their wallet. */
  async cancelDeparture(admin: YatraActor, departureId: string, reason: string): Promise<any> {
    if (reason.trim().length < 3) throw new YatraException("Please give a reason (at least 3 characters).", 400);
    const departure = await this.departures.findById(departureId).lean();
    if (!departure) throw new YatraException("Departure not found.", 404);
    if (["cancelled", "completed"].includes(departure.status)) throw new YatraException("This departure is already closed.", 409);
    await this.departures.updateOne(
      { _id: departureId },
      { $set: { status: "cancelled", cancelledAt: new Date(), cancelledBy: admin.id, cancellationReason: reason.trim() } },
    );
    await this.audit.record(admin, "departure.cancelled", { departureId, reason }, { before: { status: departure.status }, after: { status: "cancelled" } });
    const paid = await this.bookings.find({ departureId, status: { $in: ["confirmed", "cancellation_requested"] } }).select("_id").lean();
    let refunded = 0;
    const failed: string[] = [];
    for (const b of paid) {
      try {
        await this.decideCancellation(admin, String(b._id), "approve", { refundPercent: 100, note: `Departure cancelled: ${reason.trim()}`, direct: true });
        refunded += 1;
      } catch (error) {
        failed.push(String(b._id));
        this.logger.error(`Refund for booking ${String(b._id)} failed: ${(error as Error).message}`);
      }
    }
    const open = await this.bookings.find({ departureId, status: { $in: OPEN_BOOKING_STATUSES } }).select("_id").lean();
    for (const b of open) await this.releaseOpen(String(b._id), admin, "Departure cancelled", {}).catch(() => undefined);
    await this.notifier.operatorTeam(String(departure.operatorId), "Departure cancelled by Tirvona", `${departure.departureCode}: ${reason.trim()}`, "/operator/departures");
    return { refunded, released: open.length, failed };
  }

  // ======================================================= organiser views
  async operatorBookings(user: YatraActor, query: { departureId?: string; status?: string; source?: string; q?: string; page: number; limit: number }): Promise<any> {
    const { operator } = await this.access.require(user, "viewBookings");
    const filter: Record<string, unknown> = { operatorId: operator._id };
    if (query.departureId) filter.departureId = query.departureId;
    if (query.status) filter.status = query.status;
    if (query.source) filter.source = query.source;
    if (query.q) filter.bookingReference = { $regex: escapeRegex(query.q.toUpperCase()) };
    const [rows, total] = await Promise.all([
      this.bookings.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.bookings.countDocuments(filter),
    ]);
    return { items: rows.map(bookingStaffView), total };
  }

  async operatorBooking(user: YatraActor, bookingId: string): Promise<any> {
    const { operator } = await this.access.require(user, "viewBookings");
    const booking = await this.bookings.findOne({ _id: bookingId, operatorId: operator._id }).lean();
    if (!booking) throw new YatraException("Booking not found.", 404);
    return bookingStaffView(booking);
  }

  async operatorRelease(user: YatraActor, bookingId: string): Promise<any> {
    const { operator } = await this.access.require(user, "createBookings", { writable: true });
    const booking = await this.releaseOpen(bookingId, user, "Released by partner", { operatorId: operator._id });
    await this.audit.record(user, "booking.organizer_released", { bookingId, operatorId: String(operator._id) });
    return bookingStaffView(booking.toObject());
  }

  async manifest(user: YatraActor, departureId: string): Promise<any> {
    const { operator } = await this.access.require(user, "checkIn");
    const departure = await this.departures.findOne({ _id: departureId, operatorId: operator._id }).lean();
    if (!departure) throw new YatraException("Departure not found.", 404);
    const rows = await this.bookings.find({ departureId, status: { $in: MANIFEST_BOOKING_STATUSES } }).sort({ boardingPointName: 1, createdAt: 1 }).lean();
    const passengers = rows.flatMap((b: any) =>
      (b.passengers ?? []).map((p: any) => ({
        bookingId: String(b._id),
        bookingReference: b.bookingReference,
        bookingStatus: b.status,
        source: b.source,
        boardingPointId: b.boardingPointId,
        boardingPointName: b.boardingPointName,
        droppingPointName: b.droppingPointName ?? "",
        contactPhone: b.contact?.phone ?? "",
        ...passengerView(p),
      })),
    );
    passengers.sort((a: any, b: any) => String(a.seatNo).localeCompare(String(b.seatNo), "en", { numeric: true }));
    return {
      departure: { id: String(departure._id), departureCode: departure.departureCode, departAt: departure.departAt, boardingPoints: departure.boardingPoints ?? [], capacity: departure.capacity, bookedSeats: departure.bookedSeats },
      bookings: rows.length,
      passengers,
      checkedIn: passengers.filter((p: any) => p.checkedInAt).length,
    };
  }

  async manifestCsv(user: YatraActor, departureId: string): Promise<{ filename: string; csv: string }> {
    const data = await this.manifest(user, departureId);
    const header = ["Seat", "Passenger", "Age", "Gender", "Booking", "Boarding point", "Contact phone", "Checked in"];
    const lines = data.passengers.map((p: any) =>
      [p.seatNo, p.name, p.age ?? "", p.gender, p.bookingReference, p.boardingPointName, p.contactPhone, p.checkedInAt ? new Date(p.checkedInAt).toISOString() : ""].map(csvCell).join(","),
    );
    await this.audit.record(user, "manifest.exported", { departureId, passengers: data.passengers.length });
    return { filename: `manifest-${data.departure.departureCode}.csv`, csv: [header.map(csvCell).join(","), ...lines].join("\r\n") };
  }

  /** Boarding: the ticket's QR (or reference + code) checks travellers in. */
  async checkIn(user: YatraActor, departureId: string, dto: { qr?: string; bookingReference?: string; ticketCode?: string; seatNos?: string[] }): Promise<any> {
    const { operator } = await this.access.require(user, "checkIn", { writable: true });
    let reference = dto.bookingReference ?? "";
    let code = dto.ticketCode ?? "";
    if (dto.qr) {
      try {
        const parsed = JSON.parse(dto.qr);
        if (parsed?.t !== "yatra") throw new Error("not a yatra ticket");
        reference = String(parsed.r ?? "");
        code = String(parsed.c ?? "");
      } catch {
        throw new YatraException("This QR code is not a Tirvona Yatra ticket.", 400, "QR_INVALID");
      }
    }
    const booking = await this.bookings.findOne({ bookingReference: reference.trim().toUpperCase(), operatorId: operator._id });
    if (!booking || String(booking.departureId) !== String(departureId)) throw new YatraException("No booking with that reference on this departure.", 404, "TICKET_NOT_FOUND");
    if (!booking.ticketCode || booking.ticketCode.toUpperCase() !== code.trim().toUpperCase()) throw new YatraException("The ticket code does not match.", 400, "TICKET_CODE_MISMATCH");
    if (!["confirmed", "cancellation_requested"].includes(booking.status)) throw new YatraException(`This booking is ${booking.status.replace(/_/g, " ")}; it cannot board.`, 409);
    const wanted = new Set((dto.seatNos ?? []).map((s) => String(s).toUpperCase()));
    const now = new Date();
    booking.passengers = (booking.passengers ?? []).map((p: any) => (wanted.size === 0 || wanted.has(String(p.seatNo)) ? { ...p, checkedInAt: p.checkedInAt ?? now } : p));
    booking.markModified?.("passengers");
    booking.history.push({ status: booking.status, note: `Boarded${wanted.size ? ` (seats ${[...wanted].join(", ")})` : ""}`, by: user.id });
    await booking.save();
    await this.audit.record(user, "booking.checked_in", { bookingId: String(booking._id), departureId, seats: [...wanted] });
    return bookingStaffView(booking.toObject());
  }

  // ============================================================ admin views
  async adminBookings(query: { status?: string; source?: string; operatorId?: string; departureId?: string; q?: string; page: number; limit: number }): Promise<any> {
    const filter: Record<string, unknown> = {};
    for (const key of ["status", "source", "operatorId", "departureId"] as const) if (query[key]) filter[key] = query[key];
    if (query.q) filter.bookingReference = { $regex: escapeRegex(query.q.toUpperCase()) };
    const [rows, total] = await Promise.all([
      this.bookings.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.bookings.countDocuments(filter),
    ]);
    return { items: rows.map(bookingStaffView), total };
  }

  async adminBooking(bookingId: string): Promise<any> {
    const booking = await this.bookings.findById(bookingId).lean();
    if (!booking) throw new YatraException("Booking not found.", 404);
    const [payments, ledger, operator] = await Promise.all([
      this.payments.find({ bookingId }).sort({ createdAt: -1 }).lean(),
      this.ledger.find({ bookingId }).sort({ createdAt: 1 }).lean(),
      this.operators.findById(booking.operatorId).select("organisationName").lean(),
    ]);
    return {
      booking: bookingStaffView(booking),
      operatorName: operator?.organisationName ?? "",
      payments: payments.map((p: any) => ({ id: String(p._id), amount: p.amount, status: p.status, method: p.method, channel: p.channel, orderId: p.gateway?.orderId ?? "", paymentId: p.gateway?.paymentId ?? "", paidAt: p.paidAt, unapplied: Boolean(p.unapplied), failureReason: p.failureReason ?? "", createdAt: p.createdAt })),
      ledger: ledger.map((l: any) => ({ id: String(l._id), type: l.type, direction: l.direction, amount: l.amount, description: l.description, createdAt: l.createdAt })),
    };
  }

  // ============================================================ maintenance
  /** Expires unpaid bookings whose hold lapsed and frees their seats. Safe to run on several instances. */
  async sendJourneyReminders(limit = 100): Promise<number> {
    const { reminderHours } = await this.settings.get();
    const now = new Date();
    const until = new Date(now.getTime() + reminderHours * 3_600_000);
    const due = await this.bookings.find({ status: "confirmed", reminderSentAt: null, departAt: { $gt: now, $lte: until } }).select("_id").limit(limit).lean();
    let sent = 0;
    for (const row of due) {
      const booking = await this.bookings.findOneAndUpdate({ _id: row._id, status: "confirmed", reminderSentAt: null }, { $set: { reminderSentAt: new Date() } }, { new: true }).lean();
      if (!booking) continue;
      const when = new Date(booking.departAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      await this.notifier.users([String(booking.customerId)], "Your Yatra starts soon", `${booking.tourTitle}: board at ${booking.boardingPointName} on ${when}. Ticket ${booking.ticketCode}.`, booking.journeyId ? `/profile/journeys/${String(booking.journeyId)}` : "/profile/journeys", "yatra.reminder");
      await this.notifier.emailCustomer(booking, { title: "Your Yatra starts soon", message: `Board at ${booking.boardingPointName} on ${when}.`, reference: booking.bookingReference, highlight: { label: "Ticket code", code: booking.ticketCode }, ctaPath: booking.journeyId ? `/profile/journeys/${String(booking.journeyId)}` : "/profile/journeys" });
      sent += 1;
    }
    return sent;
  }

  async expireLapsed(limit = 100): Promise<number> {
    const cutoff = new Date(Date.now() - 60_000);
    const due = await this.bookings.find({ status: { $in: OPEN_BOOKING_STATUSES }, holdExpiresAt: { $lt: cutoff } }).select("_id").limit(limit).lean();
    let expired = 0;
    for (const row of due) {
      const done = await this.transactions.run(async (session: ClientSession) => {
        const claimed = await this.bookings.findOneAndUpdate(
          { _id: row._id, status: { $in: OPEN_BOOKING_STATUSES }, holdExpiresAt: { $lt: cutoff } },
          { $set: { status: "expired", holdExpiresAt: null } },
          { new: true, session },
        );
        if (!claimed) return false;
        await this.inventory.releaseSeats(session, claimed.departureId, claimed._id);
        claimed.history.push({ status: "expired", note: "Seat hold expired without payment", by: null });
        await claimed.save({ session });
        return true;
      });
      if (done) expired += 1;
    }
    return expired;
  }
}
