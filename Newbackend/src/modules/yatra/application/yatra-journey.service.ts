import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { TransactionService } from "../../../common/database/transaction.service";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { WalletService } from "../../wallet/application/wallet.service";
import { YATRA_MODEL, type JourneyLinkModule, type ServiceType } from "../domain/yatra.constants";
import { YatraException } from "../domain/yatra.errors";
import { journeyStatusFor, roundMoney, serviceRequestNumber, toPaise } from "../domain/yatra.utils";
import { bookingView } from "./yatra-booking.service";
import { YatraFinanceService } from "./yatra-finance.service";
import { type YatraActor, YatraAuditService, YatraGatewayService, YatraNotifier } from "./yatra-support.service";

class UnusableServicePayment extends Error {}

const DAY = 86_400_000;

const journeyView = (j: any, bookingStatus: string) => ({
  id: String(j._id),
  journeyNumber: j.journeyNumber,
  bookingId: String(j.bookingId),
  title: j.title,
  originCity: j.originCity,
  destinationCity: j.destinationCity,
  startDate: j.startDate,
  endDate: j.endDate,
  travellers: j.travellers,
  status: journeyStatusFor(bookingStatus, j.startDate, j.endDate),
  createdAt: j.createdAt,
});

/** What the customer and Tirvona see of an add-on request. */
const requestView = (r: any) => ({
  id: String(r._id),
  requestNumber: r.requestNumber,
  journeyId: String(r.journeyId),
  bookingId: String(r.bookingId),
  serviceType: r.serviceType,
  serviceDate: r.serviceDate,
  details: r.details ?? {},
  foodVendorId: r.foodVendorId ? String(r.foodVendorId) : null,
  providerId: r.providerId ? String(r.providerId) : null,
  supplierName: r.supplierName ?? "",
  status: r.status,
  quotedAmount: r.quotedAmount ?? 0,
  quotedAt: r.quotedAt ?? null,
  supplierNote: r.supplierNote ?? "",
  paymentStatus: r.paymentStatus,
  paidAt: r.paidAt ?? null,
  confirmedAt: r.confirmedAt ?? null,
  fulfilledAt: r.fulfilledAt ?? null,
  cancelReason: r.cancelReason ?? "",
  refundAmount: r.refundAmount ?? 0,
  history: (r.history ?? []).map((h: any) => ({ status: h.status, note: h.note, at: h.at })),
  createdAt: r.createdAt,
});

@Injectable()
export class YatraJourneyService {
  private readonly logger = new Logger(YatraJourneyService.name);

  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: YatraAuditService,
    private readonly notifier: YatraNotifier,
    private readonly gateway: YatraGatewayService,
    private readonly wallet: WalletService,
    private readonly finance: YatraFinanceService,
    @InjectModel(YATRA_MODEL.Journey) private readonly journeys: Model<any>,
    @InjectModel(YATRA_MODEL.JourneyLink) private readonly journeyLinks: Model<any>,
    @InjectModel(YATRA_MODEL.ServiceRequest) private readonly requests: Model<any>,
    @InjectModel(YATRA_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(YATRA_MODEL.Departure) private readonly departures: Model<any>,
    @InjectModel(YATRA_MODEL.Tour) private readonly tours: Model<any>,
    @InjectModel(YATRA_MODEL.Operator) private readonly operators: Model<any>,
    @InjectModel(YATRA_MODEL.Payment) private readonly payments: Model<any>,
    @InjectModel(YATRA_MODEL.Ledger) private readonly ledger: Model<any>,
    @InjectModel(YATRA_MODEL.UserRef) private readonly users: Model<any>,
    @InjectModel(YATRA_MODEL.StayBookingRef) private readonly stayBookings: Model<any>,
    @InjectModel(YATRA_MODEL.ParkingBookingRef) private readonly parkingBookings: Model<any>,
    @InjectModel(YATRA_MODEL.AartiBookingRef) private readonly aartiBookings: Model<any>,
    @InjectModel(YATRA_MODEL.FoodVendorRef) private readonly foodVendors: Model<any>,
    @InjectModel(YATRA_MODEL.ProviderRef) private readonly providers: Model<any>,
  ) {}

  // ================================================================ journeys
  private async ownJourney(user: YatraActor, journeyId: string): Promise<{ journey: any; booking: any }> {
    const journey = await this.journeys.findOne({ _id: journeyId, customerId: user.id }).lean();
    if (!journey) throw new YatraException("Journey not found.", 404);
    const booking = await this.bookings.findById(journey.bookingId).lean();
    return { journey, booking };
  }

  async listMine(user: YatraActor): Promise<any[]> {
    const rows = await this.journeys.find({ customerId: user.id }).sort({ startDate: -1 }).limit(100).lean();
    const bookings = await this.bookings.find({ _id: { $in: rows.map((r: any) => r.bookingId) } }).select("status bookingReference seatCount").lean();
    const byId = new Map(bookings.map((b: any) => [String(b._id), b]));
    return rows.map((j: any) => ({
      ...journeyView(j, byId.get(String(j.bookingId))?.status ?? "confirmed"),
      bookingReference: byId.get(String(j.bookingId))?.bookingReference ?? "",
      bookingStatus: byId.get(String(j.bookingId))?.status ?? "",
    }));
  }

  async detail(user: YatraActor, journeyId: string): Promise<any> {
    const { journey, booking } = await this.ownJourney(user, journeyId);
    const [departure, tour, operator, links, requests] = await Promise.all([
      this.departures.findById(journey.departureId).lean(),
      this.tours.findById(journey.tourId).lean(),
      this.operators.findById(journey.operatorId).select("organisationName displayName contactPhone").lean(),
      this.journeyLinks.find({ journeyId }).sort({ createdAt: 1 }).lean(),
      this.requests.find({ journeyId }).sort({ createdAt: -1 }).lean(),
    ]);
    const liveStatus = await this.linkStatuses(links);
    const boarding = (departure?.boardingPoints ?? []).find((p: any) => p.id === booking?.boardingPointId) ?? null;
    return {
      journey: journeyView(journey, booking?.status ?? "confirmed"),
      booking: bookingView(booking),
      departure: departure && {
        departureCode: departure.departureCode,
        departAt: departure.departAt,
        returnAt: departure.returnAt,
        status: departure.status,
        boardingPoint: boarding,
        cancellationReason: departure.cancellationReason ?? "",
      },
      tour: tour && {
        title: tour.title,
        summary: tour.summary ?? "",
        durationDays: tour.durationDays,
        durationNights: tour.durationNights ?? 0,
        itinerary: Array.isArray(tour.itinerary) ? tour.itinerary : [],
        stops: Array.isArray(tour.stops) ? tour.stops : [],
        inclusions: tour.inclusions ?? [],
        exclusions: tour.exclusions ?? [],
        coverImage: tour.coverImage || tour.images?.[0] || "",
      },
      operator: operator && { name: operator.displayName || operator.organisationName, contactPhone: operator.contactPhone ?? "" },
      links: links.map((l: any) => ({
        id: String(l._id),
        module: l.module,
        refId: String(l.refId),
        reference: l.reference,
        title: l.title,
        date: l.date,
        status: liveStatus.get(`${l.module}:${String(l.refId)}`) ?? "unknown",
      })),
      serviceRequests: requests.map(requestView),
    };
  }

  private async linkStatuses(links: any[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const ids = (module: string) => links.filter((l) => l.module === module).map((l) => l.refId);
    const [stays, parking, aarti] = await Promise.all([
      ids("stay").length ? this.stayBookings.find({ _id: { $in: ids("stay") } }).select("status").lean() : [],
      ids("parking").length ? this.parkingBookings.find({ _id: { $in: ids("parking") } }).select("status").lean() : [],
      ids("aarti").length ? this.aartiBookings.find({ _id: { $in: ids("aarti") } }).select("status").lean() : [],
    ]);
    for (const r of stays as any[]) out.set(`stay:${String(r._id)}`, String(r.status ?? ""));
    for (const r of parking as any[]) out.set(`parking:${String(r._id)}`, String(r.status ?? ""));
    for (const r of aarti as any[]) out.set(`aarti:${String(r._id)}`, String(r.status ?? ""));
    return out;
  }

  /** The customer's own Stay, Parking and Aarti bookings around the journey dates. */
  async linkable(user: YatraActor, journeyId: string): Promise<any[]> {
    const { journey } = await this.ownJourney(user, journeyId);
    const from = new Date(new Date(journey.startDate).getTime() - 2 * DAY);
    const to = new Date(new Date(journey.endDate).getTime() + 2 * DAY);
    const linked = new Set((await this.journeyLinks.find({ journeyId }).select("module refId").lean()).map((l: any) => `${l.module}:${String(l.refId)}`));
    const [stays, parking, aarti] = await Promise.all([
      this.stayBookings.find({ customerId: user.id, checkInDate: { $gte: from, $lte: to } }).limit(20).lean(),
      this.parkingBookings.find({ customerId: user.id, entryAt: { $gte: from, $lte: to } }).limit(20).lean(),
      this.aartiBookings.find({ customerId: user.id, startsAt: { $gte: from, $lte: to } }).limit(20).lean(),
    ]);
    const rows = [
      ...stays.map((s: any) => ({ module: "stay", refId: String(s._id), reference: s.reservationNumber || s.bookingId || "", title: "Stay booking", date: s.checkInDate, status: s.status })),
      ...parking.map((p: any) => ({ module: "parking", refId: String(p._id), reference: p.bookingReference ?? "", title: `Parking ${p.vehicleNumber ?? ""}`.trim(), date: p.entryAt, status: p.status })),
      ...aarti.map((a: any) => ({ module: "aarti", refId: String(a._id), reference: a.bookingReference ?? "", title: `Aarti pass × ${a.passCount ?? 1}`, date: a.startsAt, status: a.status })),
    ];
    return rows.filter((r) => !linked.has(`${r.module}:${r.refId}`) && !["cancelled", "expired"].includes(String(r.status)));
  }

  /** Attaches one of the customer's own bookings. Ownership is checked against the owning module's table. */
  async addLink(user: YatraActor, journeyId: string, module: JourneyLinkModule, refId: string): Promise<any> {
    const { journey } = await this.ownJourney(user, journeyId);
    const source: Record<JourneyLinkModule, Model<any>> = { stay: this.stayBookings, parking: this.parkingBookings, aarti: this.aartiBookings };
    const row = await source[module].findOne({ _id: refId, customerId: user.id }).lean();
    if (!row) throw new YatraException("That booking was not found in your account.", 404);
    const snapshot =
      module === "stay"
        ? { reference: row.reservationNumber || row.bookingId || "", title: "Stay booking", date: row.checkInDate }
        : module === "parking"
          ? { reference: row.bookingReference ?? "", title: `Parking ${row.vehicleNumber ?? ""}`.trim(), date: row.entryAt }
          : { reference: row.bookingReference ?? "", title: `Aarti pass × ${row.passCount ?? 1}`, date: row.startsAt };
    try {
      const link = await this.journeyLinks.create({ journeyId: journey._id, customerId: user.id, module, refId, ...snapshot });
      return { id: String(link._id), module, refId, ...snapshot, status: row.status };
    } catch (error: any) {
      if (error?.code === 11000) throw new YatraException("This booking is already part of the journey.", 409);
      throw error;
    }
  }

  async removeLink(user: YatraActor, journeyId: string, linkId: string): Promise<{ removed: true }> {
    await this.ownJourney(user, journeyId);
    const result = await this.journeyLinks.deleteOne({ _id: linkId, journeyId, customerId: user.id });
    if (!result?.deletedCount) throw new YatraException("Link not found.", 404);
    return { removed: true };
  }

  // ================================================================ suppliers
  async foodSuppliers(): Promise<any[]> {
    const rows = await this.foodVendors.find({ status: "active" }).select("businessName").sort({ businessName: 1 }).limit(200).lean();
    return rows.map((r: any) => ({ id: String(r._id), name: r.businessName }));
  }

  async pujaProviders(city?: string): Promise<any[]> {
    const filter: Record<string, unknown> = { status: "ACTIVE", isPubliclyListed: true };
    if (city) filter.homeCity = { $regex: `^${escapeRegex(city.trim())}$`, $options: "i" };
    const rows = await this.providers.find(filter).select("displayName homeCity avatarUrl").sort({ displayName: 1 }).limit(100).lean();
    return rows.map((r: any) => ({ id: String(r._id), name: r.displayName, city: r.homeCity ?? "", avatarUrl: r.avatarUrl ?? "" }));
  }

  private async supplierFor(type: ServiceType, dto: any): Promise<{ foodVendorId: unknown; providerId: unknown; name: string; ownerUserId: string | null }> {
    if (type === "food" && dto.foodVendorId) {
      const vendor = await this.foodVendors.findOne({ _id: dto.foodVendorId, status: "active" }).lean();
      if (!vendor) throw new YatraException("That restaurant is not available.", 404);
      return { foodVendorId: vendor._id, providerId: null, name: vendor.businessName, ownerUserId: vendor.ownerUserId ? String(vendor.ownerUserId) : null };
    }
    if (type === "puja" && dto.providerId) {
      const provider = await this.providers.findOne({ _id: dto.providerId, status: "ACTIVE" }).lean();
      if (!provider) throw new YatraException("That pandit is not available.", 404);
      return { foodVendorId: null, providerId: provider._id, name: provider.displayName, ownerUserId: provider.userId ? String(provider.userId) : null };
    }
    return { foodVendorId: null, providerId: null, name: "", ownerUserId: null };
  }

  private async notifyAdmins(title: string, body: string): Promise<void> {
    const admins = await this.users.find({ role: "super_admin", status: "active" }).select("_id").limit(20).lean();
    await this.notifier.users(admins.map((a: any) => String(a._id)), title, body, "/admin/yatra/service-requests", "yatra.admin");
  }

  // ========================================================= service requests
  async createRequest(user: YatraActor, journeyId: string, dto: any): Promise<any> {
    const { journey, booking } = await this.ownJourney(user, journeyId);
    if (!booking || !["confirmed", "cancellation_requested"].includes(booking.status))
      throw new YatraException("Add-ons can be requested only for a confirmed journey.", 409);
    const serviceDate = new Date(dto.serviceDate);
    const start = new Date(journey.startDate).getTime() - DAY;
    const end = new Date(journey.endDate).getTime() + DAY;
    if (Number.isNaN(serviceDate.getTime()) || serviceDate.getTime() < start || serviceDate.getTime() > end)
      throw new YatraException("Choose a date within your journey.", 400, "DATE_OUTSIDE_JOURNEY");
    if (serviceDate.getTime() < Date.now() - DAY) throw new YatraException("That date has passed.", 400);
    const details =
      dto.serviceType === "food"
        ? { mealType: dto.mealType, quantity: dto.quantity, dietaryPreference: dto.dietaryPreference ?? "satvik", location: dto.location, notes: dto.notes ?? "" }
        : { ritualName: dto.ritualName, preferredTime: dto.preferredTime ?? "", location: dto.location, attendees: dto.attendees ?? booking.seatCount, notes: dto.notes ?? "" };
    if (dto.serviceType === "food" && (!dto.mealType || !dto.quantity)) throw new YatraException("Choose the meal and how many people.", 400);
    if (dto.serviceType === "puja" && !dto.ritualName) throw new YatraException("Tell us which puja you would like.", 400);
    const supplier = await this.supplierFor(dto.serviceType, dto);
    // The organiser's referral rule (if any) that applies now stays with the request.
    const commissionSnapshot = await this.finance.snapshotFor("addon_referral", { operatorId: journey.operatorId });
    const request = await this.requests.create({
      commissionSnapshot,
      requestNumber: serviceRequestNumber(),
      journeyId: journey._id,
      bookingId: booking._id,
      customerId: user.id,
      operatorId: journey.operatorId,
      serviceType: dto.serviceType,
      serviceDate,
      details,
      foodVendorId: supplier.foodVendorId,
      providerId: supplier.providerId,
      supplierName: supplier.name,
      status: supplier.name ? "supplier_pending" : "requested",
      history: [{ status: supplier.name ? "supplier_pending" : "requested", note: "Requested by customer", by: user.id }],
    });
    await this.audit.record(user, "service_request.created", { requestId: String(request._id), journeyId, serviceType: dto.serviceType });
    if (supplier.ownerUserId)
      await this.notifier.users([supplier.ownerUserId], "New Yatra service request", `${dto.serviceType === "food" ? "Meal" : "Puja"} request ${request.requestNumber} for ${serviceDate.toDateString()}.`, dto.serviceType === "food" ? "/restaurant/yatra-requests" : "/provider/yatra-requests", "yatra.supplier");
    await this.notifyAdmins("New Yatra add-on request", `${request.requestNumber} (${dto.serviceType}).`);
    return requestView(request);
  }

  async cancelRequest(user: YatraActor, requestId: string, reason: string): Promise<any> {
    const request = await this.requests.findOne({ _id: requestId, customerId: user.id });
    if (!request) throw new YatraException("Request not found.", 404);
    if (!["requested", "supplier_pending", "accepted"].includes(request.status))
      throw new YatraException(request.status === "confirmed" ? "This add-on is paid. Contact Tirvona support to cancel it." : "This request is already closed.", 409);
    request.status = "cancelled";
    request.cancelledAt = new Date();
    request.cancelReason = reason.trim();
    request.history.push({ status: "cancelled", note: reason.trim() || "Cancelled by customer", by: user.id });
    await request.save();
    await this.payments.updateMany({ serviceRequestId: request._id, status: "pending" }, { $set: { status: "superseded", failureReason: "Request cancelled" } });
    return requestView(request.toObject());
  }

  async requestPaymentOrder(user: YatraActor, requestId: string): Promise<any> {
    const request = await this.requests.findOne({ _id: requestId, customerId: user.id }).lean();
    if (!request) throw new YatraException("Request not found.", 404);
    if (request.status !== "accepted") throw new YatraException("You can pay once the supplier has accepted the request.", 409, "NOT_PAYABLE");
    const amount = roundMoney(request.quotedAmount);
    const order = await this.gateway.createOrder(amount, request.requestNumber, { module: "yatra", serviceRequestId: String(request._id) });
    await this.transactions.run(async (session) => {
      await this.payments.updateMany({ serviceRequestId: request._id, status: "pending" }, { $set: { status: "superseded", failureReason: "Superseded by a newer payment attempt" } }, { session });
      await this.payments.create(
        [
          {
            purpose: "service_request",
            serviceRequestId: request._id,
            bookingId: request.bookingId,
            operatorId: request.operatorId,
            userId: user.id,
            amount,
            method: order.demo ? "demo" : "razorpay",
            channel: "checkout",
            status: "pending",
            gateway: { orderId: order.orderId, provider: order.demo ? "demo" : "razorpay" },
          },
        ],
        { session },
      );
    });
    return { demo: order.demo, orderId: order.orderId, amount: order.amount, currency: order.currency, keyId: order.keyId, name: "Tirvona Yatra", description: `${request.serviceType === "food" ? "Meal" : "Puja"} · ${request.requestNumber}` };
  }

  async confirmRequestPayment(user: YatraActor, requestId: string, dto: any): Promise<any> {
    const request = await this.requests.findOne({ _id: requestId, customerId: user.id }).lean();
    if (!request) throw new YatraException("Request not found.", 404);
    if (!this.gateway.verifySignature(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature ?? ""))
      throw new YatraException("Payment verification failed.", 400, "SIGNATURE_INVALID");
    const payment = await this.payments.findOne({ serviceRequestId: request._id, "gateway.orderId": dto.razorpay_order_id }).lean();
    if (!payment) throw new YatraException("This payment does not belong to this request.", 400, "ORDER_MISMATCH");
    const outcome = await this.settle(payment._id, { paymentId: dto.razorpay_payment_id, signature: dto.razorpay_signature ?? "", via: "checkout" });
    if (outcome === "refunded")
      throw new YatraException("Your payment was received but this request could no longer be confirmed. The amount has been added to your Tirvona wallet.", 409, "PAYMENT_REFUNDED_TO_WALLET");
    return requestView(await this.requests.findById(request._id).lean());
  }

  async confirmFromWebhook(orderId: string, paymentId: string, captured?: { amountPaise?: number }): Promise<boolean> {
    const payment = await this.payments.findOne({ "gateway.orderId": orderId, purpose: "service_request" }).lean();
    if (!payment) return false;
    await this.settle(payment._id, { paymentId, via: "webhook", capturedPaise: captured?.amountPaise });
    return true;
  }

  private async settle(paymentRowId: unknown, proof: { paymentId: string; signature?: string; via: string; capturedPaise?: number }): Promise<"confirmed" | "already" | "refunded"> {
    try {
      const outcome = await this.transactions.run(async (session) => {
        const payment = await this.payments.findById(paymentRowId).session(session);
        if (payment.status === "paid") {
          if (payment.gateway?.paymentId === proof.paymentId) return "already" as const;
          throw new UnusableServicePayment("A second payment arrived for a paid order.");
        }
        if (await this.payments.exists({ "gateway.paymentId": proof.paymentId, _id: { $ne: payment._id } }).session(session)) return "already" as const;
        const request = await this.requests.findById(payment.serviceRequestId).session(session);
        if (!request || request.status !== "accepted") throw new UnusableServicePayment("The request is no longer waiting for payment.");
        if (proof.capturedPaise !== undefined && proof.capturedPaise !== toPaise(payment.amount)) throw new UnusableServicePayment("The captured amount does not match.");
        if (roundMoney(payment.amount) !== roundMoney(request.quotedAmount)) throw new UnusableServicePayment("The amount does not match the quote.");
        const now = new Date();
        payment.status = "paid";
        payment.paidAt = now;
        payment.confirmedBy = proof.via;
        payment.set("gateway.paymentId", proof.paymentId);
        payment.set("gateway.signature", proof.signature ?? "");
        await payment.save({ session });
        request.status = "confirmed";
        request.paymentStatus = "paid";
        request.paidAt = now;
        request.confirmedAt = now;
        request.history.push({ status: "confirmed", note: `Payment verified (${proof.via})`, by: payment.userId });
        await request.save({ session });
        await this.ledger.create(
          [
            {
              type: "service_payment",
              direction: "credit",
              amount: payment.amount,
              serviceRequestId: request._id,
              bookingId: request.bookingId,
              paymentId: payment._id,
              operatorId: request.operatorId,
              customerId: payment.userId,
              reference: request.requestNumber,
              description: `Yatra ${request.serviceType} add-on ${request.requestNumber}`,
              idempotencyKey: `yatra:payment:${proof.paymentId}`,
            },
          ],
          { session },
        );
        return "confirmed" as const;
      });
      return outcome;
    } catch (error) {
      if (!(error instanceof UnusableServicePayment)) throw error;
      return this.refundUnusable(paymentRowId, proof, error.message);
    }
  }

  private async refundUnusable(paymentRowId: unknown, proof: { paymentId: string; signature?: string; via: string }, reason: string): Promise<"refunded" | "already"> {
    try {
      return await this.transactions.run(async (session) => {
        const payment = await this.payments.findById(paymentRowId).session(session);
        if (await this.ledger.exists({ idempotencyKey: `yatra:unapplied:${proof.paymentId}` }).session(session)) return "already" as const;
        if (payment.status !== "paid") {
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
            sourceId: payment.serviceRequestId,
            description: `Yatra add-on payment returned: ${reason}`,
            idempotencyKey: `refund:yatra:unapplied:${proof.paymentId}`,
            actorRole: "system",
          },
          session,
        );
        const common = { serviceRequestId: payment.serviceRequestId, bookingId: payment.bookingId, paymentId: payment._id, operatorId: payment.operatorId, customerId: payment.userId };
        await this.ledger.create(
          [
            { ...common, type: "unapplied_payment", direction: "credit", amount: payment.amount, description: reason, idempotencyKey: `yatra:unapplied:${proof.paymentId}` },
            { ...common, type: "unapplied_refund", direction: "debit", amount: payment.amount, description: "Returned to wallet", idempotencyKey: `yatra:unapplied-refund:${proof.paymentId}` },
          ],
          { session, ordered: true },
        );
        return "refunded" as const;
      });
    } catch (error: any) {
      if (error?.code === 11000) return "already";
      throw error;
    }
  }

  // ============================================================ supplier side
  private async supplierScope(user: YatraActor): Promise<Record<string, unknown>> {
    const [vendors, providers] = await Promise.all([
      this.foodVendors.find({ ownerUserId: user.id }).select("_id").lean(),
      this.providers.find({ userId: user.id }).select("_id").lean(),
    ]);
    const or: Record<string, unknown>[] = [];
    if (vendors.length) or.push({ foodVendorId: { $in: vendors.map((v: any) => v._id) } });
    if (providers.length) or.push({ providerId: { $in: providers.map((p: any) => p._id) } });
    if (!or.length) throw new YatraException("You are not registered as a restaurant or pandit on Tirvona.", 404, "NOT_A_SUPPLIER");
    return { $or: or };
  }

  /** Suppliers see the customer's name and phone only once the add-on is paid. */
  private supplierView(r: any, contact: Map<string, any>) {
    const base = requestView(r);
    const paid = ["confirmed", "fulfilled"].includes(r.status);
    const c = contact.get(String(r.customerId));
    return { ...base, customer: paid && c ? { name: c.name ?? "", phone: c.phone ?? "" } : null };
  }

  async supplierRequests(user: YatraActor, status?: string): Promise<any[]> {
    const filter: Record<string, unknown> = await this.supplierScope(user);
    if (status) filter.status = status;
    const rows = await this.requests.find(filter).sort({ serviceDate: 1 }).limit(200).lean();
    const ids = [...new Set(rows.filter((r: any) => ["confirmed", "fulfilled"].includes(r.status)).map((r: any) => String(r.customerId)))];
    const people = ids.length ? await this.users.find({ _id: { $in: ids } }).select("name phone").lean() : [];
    const contact = new Map(people.map((p: any) => [String(p._id), p]));
    return rows.map((r: any) => this.supplierView(r, contact));
  }

  async supplierRespond(user: YatraActor, requestId: string, dto: { decision: "accept" | "reject"; quotedAmount?: number; note?: string }): Promise<any> {
    const scope = await this.supplierScope(user);
    const request = await this.requests.findOne({ _id: requestId, ...scope });
    if (!request) throw new YatraException("Request not found.", 404);
    return this.respond(user, request, dto, "supplier");
  }

  async supplierFulfil(user: YatraActor, requestId: string): Promise<any> {
    const scope = await this.supplierScope(user);
    const request = await this.requests.findOne({ _id: requestId, ...scope });
    if (!request) throw new YatraException("Request not found.", 404);
    return this.fulfil(user, request);
  }

  private async respond(actor: YatraActor, request: any, dto: { decision: "accept" | "reject"; quotedAmount?: number; note?: string }, by: "supplier" | "admin"): Promise<any> {
    if (request.status !== "supplier_pending") throw new YatraException("This request is not waiting for a supplier's answer.", 409);
    const note = (dto.note ?? "").trim();
    if (dto.decision === "accept") {
      const amount = roundMoney(Number(dto.quotedAmount));
      if (!(amount >= 1 && amount <= 500_000)) throw new YatraException("Enter the price for this request (₹1 to ₹5,00,000).", 400);
      request.status = "accepted";
      request.quotedAmount = amount;
      request.quotedAt = new Date();
      request.quotedBy = actor.id;
    } else {
      if (note.length < 3) throw new YatraException("Please give a reason (at least 3 characters).", 400);
      request.status = "rejected";
    }
    request.supplierNote = note;
    request.history.push({ status: request.status, note: `${by === "admin" ? "Tirvona" : "Supplier"}: ${note || (dto.decision === "accept" ? `accepted at ₹${request.quotedAmount}` : "rejected")}`, by: actor.id });
    await request.save();
    await this.audit.record(actor, `service_request.${dto.decision}ed`, { requestId: String(request._id), by, quotedAmount: request.quotedAmount });
    await this.notifier.users(
      [String(request.customerId)],
      dto.decision === "accept" ? "Your add-on was accepted" : "Your add-on was declined",
      dto.decision === "accept" ? `${request.requestNumber}: pay ₹${request.quotedAmount} to confirm it.` : `${request.requestNumber}: ${note}`,
      `/profile/journeys/${String(request.journeyId)}`,
      "yatra.booking",
    );
    return requestView(request.toObject());
  }

  private async fulfil(actor: YatraActor, request: any): Promise<any> {
    if (request.status !== "confirmed") throw new YatraException("Only a confirmed (paid) add-on can be marked as delivered.", 409);
    request.status = "fulfilled";
    request.fulfilledAt = new Date();
    request.history.push({ status: "fulfilled", note: "Delivered", by: actor.id });
    await request.save();
    await this.finance.postReferral(request.toObject());
    await this.audit.record(actor, "service_request.fulfilled", { requestId: String(request._id) });
    return requestView(request.toObject());
  }

  // =============================================================== admin side
  async adminRequests(query: { status?: string; serviceType?: string; page: number; limit: number }): Promise<any> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.serviceType) filter.serviceType = query.serviceType;
    const [rows, total] = await Promise.all([
      this.requests.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.requests.countDocuments(filter),
    ]);
    return { items: rows.map(requestView), total };
  }

  async adminAssign(admin: YatraActor, requestId: string, dto: { foodVendorId?: string; providerId?: string }): Promise<any> {
    const request = await this.requests.findById(requestId);
    if (!request) throw new YatraException("Request not found.", 404);
    if (!["requested", "supplier_pending", "rejected"].includes(request.status)) throw new YatraException("A supplier can be assigned only before the request is accepted.", 409);
    const supplier = await this.supplierFor(request.serviceType, dto);
    if (!supplier.name) throw new YatraException(request.serviceType === "food" ? "Choose a restaurant." : "Choose a pandit.", 400);
    request.foodVendorId = supplier.foodVendorId;
    request.providerId = supplier.providerId;
    request.supplierName = supplier.name;
    request.status = "supplier_pending";
    request.history.push({ status: "supplier_pending", note: `Assigned to ${supplier.name} by Tirvona`, by: admin.id });
    await request.save();
    await this.audit.record(admin, "service_request.assigned", { requestId, supplier: supplier.name });
    if (supplier.ownerUserId)
      await this.notifier.users([supplier.ownerUserId], "New Yatra service request", `${request.requestNumber} was assigned to you.`, request.serviceType === "food" ? "/restaurant/yatra-requests" : "/provider/yatra-requests", "yatra.supplier");
    return requestView(request.toObject());
  }

  async adminRespond(admin: YatraActor, requestId: string, dto: { decision: "accept" | "reject"; quotedAmount?: number; note?: string }): Promise<any> {
    const request = await this.requests.findById(requestId);
    if (!request) throw new YatraException("Request not found.", 404);
    return this.respond(admin, request, dto, "admin");
  }

  async adminFulfil(admin: YatraActor, requestId: string): Promise<any> {
    const request = await this.requests.findById(requestId);
    if (!request) throw new YatraException("Request not found.", 404);
    return this.fulfil(admin, request);
  }

  /** Cancels an add-on; a paid one is refunded in full to the customer's wallet, once. */
  async adminCancel(admin: YatraActor, requestId: string, reason: string): Promise<any> {
    if (reason.trim().length < 3) throw new YatraException("Please give a reason (at least 3 characters).", 400);
    const result = await this.transactions.run(async (session) => {
      const request = await this.requests.findById(requestId).session(session);
      if (!request) throw new YatraException("Request not found.", 404);
      if (["cancelled", "fulfilled", "rejected"].includes(request.status)) throw new YatraException("This request is already closed.", 409);
      const paid = request.paymentStatus === "paid";
      request.status = "cancelled";
      request.cancelledAt = new Date();
      request.cancelReason = reason.trim();
      if (paid) {
        request.paymentStatus = "refunded";
        request.refundAmount = request.quotedAmount;
        await this.wallet.credit(
          {
            userId: String(request.customerId),
            amount: request.quotedAmount,
            module: "yatra",
            category: "refund",
            sourceId: request._id,
            reference: request.requestNumber,
            description: `Refund for cancelled Yatra add-on ${request.requestNumber}`,
            idempotencyKey: `refund:yatra:service:${String(request._id)}`,
            actorId: admin.id,
            actorRole: admin.role,
          },
          session,
        );
        await this.ledger.create(
          [
            {
              type: "service_refund",
              direction: "debit",
              amount: request.quotedAmount,
              serviceRequestId: request._id,
              bookingId: request.bookingId,
              operatorId: request.operatorId,
              customerId: request.customerId,
              reference: request.requestNumber,
              description: "Add-on refunded to wallet",
              idempotencyKey: `yatra:service-refund:${String(request._id)}`,
              recordedBy: admin.id,
            },
          ],
          { session },
        );
      }
      request.history.push({ status: "cancelled", note: `Cancelled by Tirvona: ${reason.trim()}${paid ? ` (₹${request.quotedAmount} to wallet)` : ""}`, by: admin.id });
      await request.save({ session });
      await this.payments.updateMany({ serviceRequestId: request._id, status: "pending" }, { $set: { status: "superseded", failureReason: "Request cancelled" } }, { session });
      await this.audit.record(admin, "service_request.cancelled", { requestId, refunded: paid ? request.quotedAmount : 0, reason }, {}, session);
      return request;
    });
    await this.notifier.users([String(result.customerId)], "Add-on cancelled", `${result.requestNumber}: ${reason.trim()}`, `/profile/journeys/${String(result.journeyId)}`, "yatra.booking");
    return requestView(result.toObject());
  }
}
