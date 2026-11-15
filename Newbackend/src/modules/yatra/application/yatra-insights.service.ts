import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import QRCode from "qrcode";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { YATRA_AUDIT_MODULE, YATRA_MODEL } from "../domain/yatra.constants";
import { YatraException } from "../domain/yatra.errors";
import { linkCode, roundMoney } from "../domain/yatra.utils";
import { YatraBookingService } from "./yatra-booking.service";
import { YatraFinanceService } from "./yatra-finance.service";
import { YatraRideService } from "./yatra-ride.service";
import { YatraJourneyService } from "./yatra-journey.service";
import { YatraAccessService, type YatraActor, YatraAuditService } from "./yatra-support.service";

const linkView = (l: any, base: string) => ({
  id: String(l._id),
  code: l.code,
  tourId: String(l.tourId),
  departureId: l.departureId ? String(l.departureId) : null,
  campaign: l.campaign ?? "",
  active: Boolean(l.active),
  bookingsCount: l.bookingsCount ?? 0,
  url: `${base}/yatra/go/${l.code}`,
  createdAt: l.createdAt,
});

const sum = (rows: any[], pick: (r: any) => boolean) => roundMoney(rows.filter(pick).reduce((total, r) => total + Number(r.amount ?? 0), 0));
const DIRECT_SOURCES = ["ORGANIZER", "OPERATOR_LINK"];

@Injectable()
export class YatraInsightsService {
  constructor(
    private readonly config: ConfigService,
    private readonly access: YatraAccessService,
    private readonly audit: YatraAuditService,
    private readonly finance: YatraFinanceService,
    @InjectModel(YATRA_MODEL.Link) private readonly links: Model<any>,
    @InjectModel(YATRA_MODEL.Tour) private readonly tours: Model<any>,
    @InjectModel(YATRA_MODEL.Departure) private readonly departures: Model<any>,
    @InjectModel(YATRA_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(YATRA_MODEL.Ledger) private readonly ledger: Model<any>,
    @InjectModel(YATRA_MODEL.Payment) private readonly payments: Model<any>,
    @InjectModel(YATRA_MODEL.Operator) private readonly operators: Model<any>,
    @InjectModel(YATRA_MODEL.Document) private readonly documents: Model<any>,
    @InjectModel(YATRA_MODEL.Vehicle) private readonly vehicles: Model<any>,
    @InjectModel(YATRA_MODEL.ServiceRequest) private readonly requests: Model<any>,
    @InjectModel("AuditLog") private readonly audits: Model<any>,
    @InjectModel(YATRA_MODEL.RidePartner) partners: Model<any>,
    @InjectModel(YATRA_MODEL.RideRequest) rides: Model<any>,
    @InjectModel(YATRA_MODEL.Issue) issues: Model<any>,
    @InjectModel(YATRA_MODEL.Payout) payouts: Model<any>,
  ) {
    this.models = { partners, rides, issues, payouts };
  }

  private readonly models: { partners: Model<any>; rides: Model<any>; issues: Model<any>; payouts: Model<any> };

  private base(): string {
    return String(this.config.get<string>("frontendUrl") ?? "").replace(/\/+$/, "");
  }

  // ------------------------------------------------------------ booking links
  async listLinks(user: YatraActor): Promise<any[]> {
    const { operator } = await this.access.require(user, "viewBookings");
    const rows = await this.links.find({ operatorId: operator._id }).sort({ createdAt: -1 }).lean();
    return rows.map((l: any) => linkView(l, this.base()));
  }

  async createLink(user: YatraActor, dto: { tourId: string; departureId?: string; campaign?: string }): Promise<any> {
    const { operator } = await this.access.require(user, "manageLinks", { approved: true });
    const tour = await this.tours.findOne({ _id: dto.tourId, operatorId: operator._id }).lean();
    if (!tour) throw new YatraException("Tour not found.", 404);
    if (dto.departureId && !(await this.departures.exists({ _id: dto.departureId, tourId: tour._id, operatorId: operator._id })))
      throw new YatraException("Departure not found.", 404);
    let link: any = null;
    for (let attempt = 0; attempt < 5 && !link; attempt += 1) {
      try {
        link = await this.links.create({ operatorId: operator._id, tourId: tour._id, departureId: dto.departureId ?? null, code: linkCode(), campaign: dto.campaign ?? "", active: true, createdBy: user.id });
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
      }
    }
    if (!link) throw new YatraException("Could not create the link. Please try again.", 503);
    await this.audit.record(user, "link.created", { operatorId: String(operator._id), linkId: String(link._id), tourId: dto.tourId, departureId: dto.departureId ?? null });
    const view = linkView(link, this.base());
    return { ...view, qr: await QRCode.toDataURL(view.url, { width: 480, margin: 2 }) };
  }

  async linkQr(user: YatraActor, linkId: string): Promise<any> {
    const { operator } = await this.access.require(user, "viewBookings");
    const link = await this.links.findOne({ _id: linkId, operatorId: operator._id }).lean();
    if (!link) throw new YatraException("Link not found.", 404);
    const view = linkView(link, this.base());
    return { ...view, qr: await QRCode.toDataURL(view.url, { width: 480, margin: 2 }) };
  }

  async setLinkActive(user: YatraActor, linkId: string, active: boolean): Promise<any> {
    const { operator } = await this.access.require(user, "manageLinks", { writable: true });
    const link = await this.links.findOneAndUpdate({ _id: linkId, operatorId: operator._id }, { $set: { active } }, { new: true }).lean();
    if (!link) throw new YatraException("Link not found.", 404);
    await this.audit.record(user, active ? "link.activated" : "link.deactivated", { linkId });
    return linkView(link, this.base());
  }

  /** Public: where a link points. The attribution itself is recorded server-side at booking time. */
  async resolveLink(code: string): Promise<any> {
    const link = await this.links.findOne({ code: String(code).toLowerCase(), active: true }).lean();
    if (!link) throw new YatraException("This booking link is not active.", 404, "LINK_NOT_FOUND");
    const tour = await this.tours.findOne({ _id: link.tourId, status: "published" }).select("slug title").lean();
    if (!tour) throw new YatraException("This tour is not available right now.", 404, "LINK_NOT_FOUND");
    let departureCode: string | null = null;
    if (link.departureId) {
      const departure = await this.departures.findById(link.departureId).select("departureCode status departAt").lean();
      if (departure && departure.status === "scheduled" && new Date(departure.departAt).getTime() > Date.now()) departureCode = departure.departureCode;
    }
    const upcoming = departureCode
      ? []
      : await this.departures.find({ tourId: link.tourId, status: "scheduled", departAt: { $gt: new Date() } }).select("departureCode departAt fare capacity bookedSeats").sort({ departAt: 1 }).limit(20).lean();
    return {
      code: link.code,
      tourTitle: tour.title,
      tourSlug: tour.slug,
      departureCode,
      departures: upcoming.map((d: any) => ({ departureCode: d.departureCode, departAt: d.departAt, fare: d.fare, seatsLeft: Math.max(0, d.capacity - d.bookedSeats) })),
    };
  }

  // ---------------------------------------------------------- organiser money
  /** The organiser's payable, from the payee ledger: earnings net of commission, taxes, refunds and transfers. */
  async earnings(user: YatraActor, query: { from?: string; to?: string; page: number; limit: number }): Promise<any> {
    const { operator } = await this.access.require(user, "viewFinance");
    const payeeId = String(operator._id);
    const [summary, statement] = await Promise.all([this.finance.summary("operator", payeeId), this.finance.statement("operator", payeeId, query.page, query.limit)]);
    const bookingPayments = await this.ledger.find({ operatorId: operator._id, type: "booking_payment" }).select("amount source").lean();
    const direct = sum(bookingPayments, (r) => DIRECT_SOURCES.includes(r.source));
    return {
      summary: {
        ...summary,
        directSales: direct,
        marketplaceSales: roundMoney(sum(bookingPayments, () => true) - direct),
        confirmedBookings: bookingPayments.length,
        commissionNote: "Earnings become payable after the journey ends. Tirvona pays you manually by bank transfer or UPI.",
      },
      items: statement.items,
      total: statement.total,
    };
  }

  async payouts(user: YatraActor): Promise<any> {
    const { operator } = await this.access.require(user, "viewFinance");
    const list = await this.finance.listPayouts({ payeeType: "operator", payeeId: String(operator._id), page: 1, limit: 100 });
    return { items: list.items, note: "Request a payout of your payable balance. Tirvona Finance reviews it and records the transfer." };
  }

  async requestPayout(user: YatraActor, amount: number, note?: string): Promise<any> {
    const { operator } = await this.access.require(user, "managePayoutDetails", { writable: true });
    return this.finance.requestPayout(user, "operator", String(operator._id), amount, note ?? "");
  }

  async cancelPayout(user: YatraActor, payoutId: string): Promise<any> {
    const { operator } = await this.access.require(user, "managePayoutDetails");
    return this.finance.cancelPayout(user, payoutId, { payeeType: "operator", payeeId: String(operator._id) });
  }

  async payoutProof(user: YatraActor, payoutId: string): Promise<any> {
    const { operator } = await this.access.require(user, "viewFinance");
    return this.finance.proofLink(payoutId, { payeeType: "operator", payeeId: String(operator._id) });
  }

  async reports(user: YatraActor): Promise<any> {
    const { operator } = await this.access.require(user, "viewFinance");
    const since = new Date(Date.now() - 90 * 86_400_000);
    const [bookings, departures, payments] = await Promise.all([
      this.bookings.find({ operatorId: operator._id, createdAt: { $gte: since } }).select("status source seatCount pricing createdAt").lean(),
      this.departures.find({ operatorId: operator._id, departAt: { $gte: new Date(Date.now() - 30 * 86_400_000) } }).sort({ departAt: 1 }).limit(100).lean(),
      this.ledger.find({ operatorId: operator._id, type: "booking_payment", createdAt: { $gte: new Date(Date.now() - 183 * 86_400_000) } }).select("amount createdAt").lean(),
    ]);
    const count = (key: string) =>
      bookings.reduce((acc: Record<string, number>, b: any) => ({ ...acc, [b[key]]: (acc[b[key]] ?? 0) + 1 }), {});
    const months = new Map<string, number>();
    for (const p of payments) {
      const key = new Date(p.createdAt).toISOString().slice(0, 7);
      months.set(key, roundMoney((months.get(key) ?? 0) + Number(p.amount)));
    }
    return {
      bookingsByStatus: count("status"),
      bookingsBySource: count("source"),
      seatFill: departures.map((d: any) => ({
        departureId: String(d._id),
        departureCode: d.departureCode,
        departAt: d.departAt,
        status: d.status,
        capacity: d.capacity,
        bookedSeats: d.bookedSeats,
        fillPercent: d.capacity ? Math.round((d.bookedSeats / d.capacity) * 100) : 0,
      })),
      revenueByMonth: [...months.entries()].sort().map(([month, amount]) => ({ month, amount })),
    };
  }

  // ------------------------------------------------------------ admin views
  async adminOverview(): Promise<any> {
    const [operators, documentsPending, vehiclesPending, toursPending, departuresOpen, cancellations, requestsOpen, ledger, pendingPayments] = await Promise.all([
      this.operators.find({}).select("status").lean(),
      this.documents.countDocuments({ status: "pending", operatorId: { $ne: null } }),
      this.vehicles.countDocuments({ status: "pending_verification" }),
      this.tours.countDocuments({ status: { $in: ["pending_review", "approved"] } }),
      this.departures.countDocuments({ status: "scheduled", departAt: { $gt: new Date() } }),
      this.bookings.countDocuments({ status: "cancellation_requested" }),
      this.requests.countDocuments({ status: { $in: ["requested", "supplier_pending"] } }),
      this.ledger.find({}).select("type amount").limit(20000).lean(),
      this.bookings.countDocuments({ status: { $in: ["held", "payment_pending"] } }),
    ]);
    const byStatus: Record<string, number> = operators.reduce(
      (acc: Record<string, number>, o: any) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + 1 }),
      {} as Record<string, number>,
    );
    const collected = sum(ledger, (r) => ["booking_payment", "service_payment"].includes(r.type));
    const refunded = sum(ledger, (r) => ["booking_refund", "service_refund"].includes(r.type));
    return {
      operators: byStatus,
      operatorsAwaitingReview: (byStatus.submitted ?? 0) + (byStatus.under_review ?? 0),
      documentsPending,
      vehiclesPending,
      toursAwaitingAction: toursPending,
      upcomingDepartures: departuresOpen,
      cancellationRequests: cancellations,
      openServiceRequests: requestsOpen,
      unpaidHolds: pendingPayments,
      ...(await this.p5Counts()),
      money: {
        collected,
        refundedToWallet: refunded,
        unappliedReturned: sum(ledger, (r) => r.type === "unapplied_refund"),
        net: roundMoney(collected - refunded),
      },
    };
  }

  private async p5Counts(): Promise<Record<string, number>> {
    const [partnersToReview, ridesNeedingPartner, openIssues, payoutsToProcess] = await Promise.all([
      this.models.partners.countDocuments({ status: "submitted" }),
      this.models.rides.countDocuments({ status: { $in: ["requested", "rejected"] } }),
      this.models.issues.countDocuments({ status: { $in: ["open", "in_progress"] } }),
      this.models.payouts.countDocuments({ status: { $in: ["pending", "under_review", "approved"] } }),
    ]);
    return { partnersToReview, ridesNeedingPartner, openIssues, payoutsToProcess };
  }

  async adminFinance(query: { from?: string; to?: string }): Promise<any> {
    const filter: Record<string, unknown> = {};
    const createdAt: Record<string, Date> = {};
    if (query.from) createdAt.$gte = new Date(`${query.from}T00:00:00+05:30`);
    if (query.to) createdAt.$lt = new Date(new Date(`${query.to}T00:00:00+05:30`).getTime() + 86_400_000);
    if (Object.keys(createdAt).length) filter.createdAt = createdAt;
    const rows = await this.ledger.find(filter).limit(20000).lean();
    const operatorIds = [...new Set(rows.filter((r: any) => r.operatorId).map((r: any) => String(r.operatorId)))];
    const ops = await this.operators.find({ _id: { $in: operatorIds } }).select("organisationName").lean();
    const names = new Map(ops.map((o: any) => [String(o._id), o.organisationName]));
    const perOperator = operatorIds.map((id) => {
      const mine = rows.filter((r: any) => String(r.operatorId) === id);
      const gross = sum(mine, (r) => r.type === "booking_payment");
      const refunds = sum(mine, (r) => r.type === "booking_refund");
      const direct = sum(mine, (r) => r.type === "booking_payment" && DIRECT_SOURCES.includes(r.source));
      return { operatorId: id, operatorName: names.get(id) ?? "", grossSales: gross, refunds, netSales: roundMoney(gross - refunds), directSales: direct, marketplaceSales: roundMoney(gross - direct), addOnSales: sum(mine, (r) => r.type === "service_payment") };
    });
    const stale = new Date(Date.now() - 30 * 60_000);
    const issues = await this.payments.find({ $or: [{ unapplied: true }, { status: "pending", createdAt: { $lt: stale } }] }).sort({ createdAt: -1 }).limit(100).lean();
    return {
      totals: {
        bookingPayments: sum(rows, (r) => r.type === "booking_payment"),
        addOnPayments: sum(rows, (r) => r.type === "service_payment"),
        refundsToWallet: sum(rows, (r) => ["booking_refund", "service_refund"].includes(r.type)),
        unappliedReturned: sum(rows, (r) => r.type === "unapplied_refund"),
      },
      perOperator: perOperator.sort((a, b) => b.grossSales - a.grossSales),
      paymentIssues: issues.map((p: any) => ({
        id: String(p._id),
        purpose: p.purpose,
        bookingId: p.bookingId ? String(p.bookingId) : null,
        serviceRequestId: p.serviceRequestId ? String(p.serviceRequestId) : null,
        amount: p.amount,
        status: p.status,
        unapplied: Boolean(p.unapplied),
        failureReason: p.failureReason ?? "",
        orderId: p.gateway?.orderId ?? "",
        paymentId: p.gateway?.paymentId ?? "",
        createdAt: p.createdAt,
      })),
    };
  }

  async adminLedger(query: { type?: string; operatorId?: string; page: number; limit: number }): Promise<any> {
    const filter: Record<string, unknown> = {};
    if (query.type) filter.type = query.type;
    if (query.operatorId) filter.operatorId = query.operatorId;
    const [rows, total] = await Promise.all([
      this.ledger.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.ledger.countDocuments(filter),
    ]);
    return {
      items: rows.map((r: any) => ({ id: String(r._id), type: r.type, direction: r.direction, amount: r.amount, source: r.source, reference: r.reference, description: r.description, bookingId: r.bookingId ? String(r.bookingId) : null, operatorId: r.operatorId ? String(r.operatorId) : null, createdAt: r.createdAt })),
      total,
    };
  }

  async adminAudit(query: { action?: string; page: number; limit: number }): Promise<any> {
    const filter: Record<string, unknown> = { module: YATRA_AUDIT_MODULE };
    if (query.action) filter.action = query.action;
    const [rows, total] = await Promise.all([
      this.audits.find(filter).sort({ timestamp: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.audits.countDocuments(filter),
    ]);
    return {
      items: rows.map((r: any) => ({ id: String(r._id), userId: r.userId ? String(r.userId) : null, action: r.action, details: r.details ?? {}, before: r.before ?? null, after: r.after ?? null, timestamp: r.timestamp })),
      total,
    };
  }
}

/** Razorpay webhook entry point for Yatra bookings and add-ons. */
@Injectable()
export class YatraWebhookService {
  constructor(
    private readonly bookings: YatraBookingService,
    private readonly journeys: YatraJourneyService,
    private readonly rides: YatraRideService,
  ) {}

  async confirmPaymentFromWebhook(orderId: string, paymentId: string, captured?: { amountPaise?: number }): Promise<boolean> {
    if (await this.bookings.confirmPaymentFromWebhook(orderId, paymentId, captured)) return true;
    if (await this.journeys.confirmFromWebhook(orderId, paymentId, captured)) return true;
    return this.rides.confirmFromWebhook(orderId, paymentId, captured);
  }
}

/**
 * Housekeeping, off unless YATRA_MAINTENANCE_ENABLED=true. Correctness does
 * not depend on it: an expired hold is reclaimed in place by the next
 * checkout. It only tidies statuses and marks finished departures completed.
 */
@Injectable()
export class YatraMaintenanceService {
  private readonly logger = new Logger(YatraMaintenanceService.name);
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly bookings: YatraBookingService,
    private readonly rides: YatraRideService,
    private readonly finance: YatraFinanceService,
    @InjectModel(YATRA_MODEL.Departure) private readonly departures: Model<any>,
    @InjectModel(YATRA_MODEL.Booking) private readonly bookingRows: Model<any>,
    @InjectModel(YATRA_MODEL.Reconciliation) private readonly reconciliations: Model<any>,
  ) {}

  /** One pass of every job; exposed for tests and for an operator-triggered run. */
  async runOnce(now = new Date()): Promise<Record<string, number>> {
    const expired = await this.bookings.expireLapsed();
    const finished = new Date(now.getTime() - 86_400_000);
    const done = await this.departures.find({ status: { $in: ["scheduled", "sales_closed"] }, returnAt: { $lt: finished } }).select("_id").limit(100).lean();
    for (const d of done) {
      await this.departures.updateOne({ _id: d._id, status: { $in: ["scheduled", "sales_closed"] } }, { $set: { status: "completed" } });
      await this.bookingRows.updateMany({ departureId: d._id, status: "confirmed" }, { $set: { status: "completed" } });
    }
    const ridesReleased = await this.rides.releaseUnanswered();
    const reminders = await this.bookings.sendJourneyReminders();
    let reconciled = 0;
    if (this.config.get<boolean>("yatraReconciliationEnabled")) {
      // Once a day: the day before yesterday (India time), which Razorpay has normally settled.
      const day = new Date(now.getTime() + 330 * 60_000 - 2 * 86_400_000).toISOString().slice(0, 10);
      if (!(await this.reconciliations.exists({ kind: "razorpay_settlement", periodDate: day }))) {
        await this.finance.reconcileRazorpay(null, day);
        reconciled = 1;
      }
    }
    return { expired, completedDepartures: done.length, ridesReleased, reminders, reconciled };
  }

  @Interval(60_000)
  async sweep(): Promise<void> {
    if (!this.config.get<boolean>("yatraMaintenanceEnabled") || this.running) return;
    this.running = true;
    try {
      const result = await this.runOnce();
      if (Object.values(result).some(Boolean)) this.logger.log(`Yatra sweep: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error(`Yatra sweep failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
