import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Razorpay from "razorpay";
import { InjectModel } from "../../../database/orm-nest";
import type { ClientSession, Model } from "../../../database/orm";
import { TransactionService } from "../../../common/database/transaction.service";
import {
  DOCUMENT_MAX_BYTES,
  OPEN_PAYOUT_STATUSES,
  YATRA_MODEL,
  type CommissionAppliesTo,
  type PayeeType,
} from "../domain/yatra.constants";
import { YatraException } from "../domain/yatra.errors";
import {
  channelOfSource,
  commissionBreakdown,
  compareGatewayPayment,
  payeeBalance,
  pickRule,
  refundReversal,
  ruleKeyFor,
  snapshotOf,
  type CommissionSnapshot,
} from "../domain/yatra-finance";
import { csvCell, detectDocumentType, randomCode, roundMoney } from "../domain/yatra.utils";
import { type YatraActor, YatraAuditService, YatraDocumentStorage, YatraNotifier } from "./yatra-support.service";

/** Reads payments and settlements from Razorpay. Replaceable in tests. */
export interface RazorpayReconClient {
  configured(): boolean;
  fetchPayment(paymentId: string): Promise<{ status?: string; amount?: number } | null>;
  /** Payment ids settled on that day (Razorpay combined settlement recon report). */
  settledPayments(day: string): Promise<Array<{ paymentId: string; amount: number; settlementId: string }>>;
}
export const RAZORPAY_RECON_CLIENT = "YATRA_RAZORPAY_RECON_CLIENT";

@Injectable()
export class RazorpayReconHttpClient implements RazorpayReconClient {
  constructor(private readonly config: ConfigService) {}
  private client(): any {
    const keyId = this.config.get<string>("razorpayKeyId");
    const keySecret = this.config.get<string>("razorpayKeySecret");
    return keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;
  }
  configured(): boolean {
    return Boolean(this.client());
  }
  async fetchPayment(paymentId: string) {
    try {
      const p: any = await this.client().payments.fetch(paymentId);
      return { status: p?.status, amount: Number(p?.amount) };
    } catch {
      return null;
    }
  }
  async settledPayments(day: string) {
    const [year, month, date] = day.split("-").map(Number);
    const report: any = await this.client().settlements.reports({ year, month, day: date, count: 1000 });
    return (report?.items ?? [])
      .filter((i: any) => i.type === "payment")
      .map((i: any) => ({ paymentId: String(i.entity_id), amount: Number(i.amount), settlementId: String(i.settlement_id ?? "") }));
  }
}

const payoutView = (p: any) =>
  p && {
    id: String(p._id),
    payoutNumber: p.payoutNumber,
    payeeType: p.payeeType,
    payeeId: String(p.payeeId),
    payeeName: p.payeeName ?? "",
    amount: p.amount,
    status: p.status,
    requestedByRole: p.requestedByRole,
    requestNote: p.requestNote ?? "",
    bank: p.bankSnapshot ?? null,
    approvedAt: p.approvedAt ?? null,
    rejectionReason: p.rejectionReason ?? "",
    transfer: p.transfer
      ? {
          method: p.transfer.method,
          transferDate: p.transfer.transferDate,
          reference: p.transfer.reference,
          amount: p.transfer.amount,
          note: p.transfer.note ?? "",
          hasProof: Boolean(p.transfer.proof?.publicId),
          recordedAt: p.transfer.recordedAt,
        }
      : null,
    reconciliation: p.reconciliation ?? null,
    history: (p.history ?? []).map((h: any) => ({ status: h.status, note: h.note, at: h.at })),
    createdAt: p.createdAt,
  };

const entryView = (e: any) => ({
  id: String(e._id),
  entryType: e.entryType,
  direction: e.direction,
  amount: e.amount,
  reference: e.reference ?? "",
  source: e.source ?? "",
  description: e.description ?? "",
  eligibleAt: e.eligibleAt,
  bookingId: e.bookingId ? String(e.bookingId) : null,
  rideRequestId: e.rideRequestId ? String(e.rideRequestId) : null,
  payoutId: e.payoutId ? String(e.payoutId) : null,
  createdAt: e.createdAt,
});

const ruleView = (r: any) => ({
  id: String(r._id),
  ruleKey: r.ruleKey,
  version: r.version,
  name: r.name ?? "",
  appliesTo: r.appliesTo,
  channel: r.channel,
  operatorId: r.operatorId ? String(r.operatorId) : null,
  ridePartnerId: r.ridePartnerId ? String(r.ridePartnerId) : null,
  commissionBps: r.commissionBps,
  flatFee: r.flatFee ?? 0,
  taxOnCommissionBps: r.taxOnCommissionBps ?? 0,
  tdsBps: r.tdsBps ?? 0,
  status: r.status,
  effectiveFrom: r.effectiveFrom,
  retiredAt: r.retiredAt ?? null,
  note: r.note ?? "",
  createdAt: r.createdAt,
});

const sum = (rows: any[], pick: (r: any) => boolean) => roundMoney(rows.filter(pick).reduce((t, r) => t + Number(r.amount ?? 0), 0));
const dayStart = (day: string) => new Date(`${day}T00:00:00+05:30`);
const istDay = (d: Date | string) => new Date(new Date(d).getTime() + 330 * 60_000).toISOString().slice(0, 10);

/**
 * Central Yatra finance: commission rules, the payee ledger (organisers and
 * ride partners), manual payouts, reports and Razorpay settlement checks.
 * Gross collections are never treated as Tirvona revenue: revenue is the
 * commission, net of reversals.
 */
@Injectable()
export class YatraFinanceService {
  private readonly logger = new Logger(YatraFinanceService.name);

  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: YatraAuditService,
    private readonly notifier: YatraNotifier,
    private readonly storage: YatraDocumentStorage,
    @Optional() @Inject(RAZORPAY_RECON_CLIENT) private readonly recon: RazorpayReconClient | null,
    @InjectModel(YATRA_MODEL.CommissionRule) private readonly rules: Model<any>,
    @InjectModel(YATRA_MODEL.PayeeEntry) private readonly entries: Model<any>,
    @InjectModel(YATRA_MODEL.Payout) private readonly payouts: Model<any>,
    @InjectModel(YATRA_MODEL.Reconciliation) private readonly reconciliations: Model<any>,
    @InjectModel(YATRA_MODEL.Operator) private readonly operators: Model<any>,
    @InjectModel(YATRA_MODEL.RidePartner) private readonly partners: Model<any>,
    @InjectModel(YATRA_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(YATRA_MODEL.Departure) private readonly departures: Model<any>,
    @InjectModel(YATRA_MODEL.Payment) private readonly payments: Model<any>,
    @InjectModel(YATRA_MODEL.Ledger) private readonly ledger: Model<any>,
    @InjectModel(YATRA_MODEL.Member) private readonly members: Model<any>,
  ) {}

  // ========================================================= commission rules
  async listRules(query: { status?: string; appliesTo?: string }): Promise<any[]> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.appliesTo) filter.appliesTo = query.appliesTo;
    const rows = await this.rules.find(filter).sort({ ruleKey: 1, version: -1 }).limit(500).lean();
    return rows.map(ruleView);
  }

  /**
   * Creates a rule. If an active rule already exists for the same scope, it is
   * retired and the new one becomes the next version. Existing bookings keep
   * the snapshot of the version they were created under.
   */
  async createRule(actor: YatraActor, dto: any): Promise<any> {
    if (dto.operatorId && dto.ridePartnerId) throw new YatraException("A rule is for an organiser or a ride partner, not both.", 400);
    if (dto.appliesTo === "ride" && dto.operatorId) throw new YatraException("Ride rules can name a ride partner, not an organiser.", 400);
    if (dto.appliesTo !== "ride" && dto.ridePartnerId) throw new YatraException("Only ride rules can name a ride partner.", 400);
    const channel = dto.appliesTo === "yatra_booking" ? dto.channel ?? "any" : "any";
    const ruleKey = ruleKeyFor(dto.appliesTo, channel, dto.operatorId, dto.ridePartnerId);
    const created = await this.transactions.run(async (session) => {
      const current = await this.rules.findOne({ ruleKey, status: "active" }).session(session);
      const last = await this.rules.findOne({ ruleKey }).sort({ version: -1 }).session(session);
      if (current) {
        current.status = "retired";
        current.retiredAt = new Date();
        current.retiredBy = actor.id;
        await current.save({ session });
      }
      const [rule] = await this.rules.create(
        [
          {
            ruleKey,
            version: Number(last?.version ?? 0) + 1,
            name: dto.name ?? "",
            appliesTo: dto.appliesTo,
            channel,
            operatorId: dto.operatorId ?? null,
            ridePartnerId: dto.ridePartnerId ?? null,
            commissionBps: dto.commissionBps,
            flatFee: dto.flatFee ?? 0,
            taxOnCommissionBps: dto.taxOnCommissionBps ?? 0,
            tdsBps: dto.tdsBps ?? 0,
            status: "active",
            effectiveFrom: new Date(),
            createdBy: actor.id,
            note: dto.note ?? "",
          },
        ],
        { session },
      );
      await this.audit.record(actor, "commission_rule.created", { ruleKey, version: rule.version }, { before: current ? ruleView(current.toObject()) : null, after: ruleView(rule.toObject()) }, session);
      return rule;
    });
    return ruleView(created.toObject ? created.toObject() : created);
  }

  async retireRule(actor: YatraActor, ruleId: string): Promise<any> {
    const rule = await this.rules.findOneAndUpdate({ _id: ruleId, status: "active" }, { $set: { status: "retired", retiredAt: new Date(), retiredBy: actor.id } }, { new: true }).lean();
    if (!rule) throw new YatraException("Active rule not found.", 404);
    await this.audit.record(actor, "commission_rule.retired", { ruleKey: rule.ruleKey, version: rule.version });
    return ruleView(rule);
  }

  /** The snapshot a new booking, ride or add-on keeps for life. */
  async snapshotFor(appliesTo: CommissionAppliesTo, q: { source?: string; operatorId?: unknown; ridePartnerId?: unknown }): Promise<CommissionSnapshot> {
    const active = await this.rules.find({ appliesTo, status: "active" }).lean();
    return snapshotOf(
      pickRule(active, {
        appliesTo,
        channel: q.source ? channelOfSource(q.source) : "any",
        operatorId: q.operatorId ? String(q.operatorId) : null,
        ridePartnerId: q.ridePartnerId ? String(q.ridePartnerId) : null,
      }),
    );
  }

  // ============================================================ payee ledger
  private async post(session: ClientSession | undefined, rows: any[]): Promise<void> {
    for (const row of rows.filter((r) => r.amount > 0)) {
      if (await this.entries.exists({ idempotencyKey: row.idempotencyKey }).session(session ?? null)) continue;
      try {
        await this.entries.create([row], session ? { session } : {});
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
      }
    }
  }

  /** Posts a confirmed booking's earning for its organiser (payable after the journey ends). */
  async postBookingEarning(session: ClientSession, booking: any, eligibleAt: Date): Promise<boolean> {
    const snap: CommissionSnapshot | null = booking.commissionSnapshot ?? null;
    if (!snap || snap.missing) return false;
    const b = commissionBreakdown(booking.pricing.amountPaid, snap);
    const base = { payeeType: "operator", payeeId: booking.operatorId, bookingId: booking._id, reference: booking.bookingReference, source: booking.source, ruleSnapshot: snap, eligibleAt };
    const key = `payee:booking:${String(booking._id)}`;
    await this.post(session, [
      { ...base, entryType: "gross_earning", direction: "credit", amount: b.gross, description: "Booking amount", idempotencyKey: `${key}:gross` },
      { ...base, entryType: "commission", direction: "debit", amount: b.commission, description: `Tirvona commission (rule v${snap.version})`, idempotencyKey: `${key}:commission` },
      { ...base, entryType: "tax_on_commission", direction: "debit", amount: b.taxOnCommission, description: "GST on commission", idempotencyKey: `${key}:tax` },
      { ...base, entryType: "tds", direction: "debit", amount: b.tds, description: "TDS withheld", idempotencyKey: `${key}:tds` },
    ]);
    return true;
  }

  /** Takes back a refund from the organiser, returning the matching commission and taxes. */
  async postBookingRefund(session: ClientSession, booking: any, refundAmount: number): Promise<void> {
    const snap: CommissionSnapshot | null = booking.commissionSnapshot ?? null;
    if (!snap || snap.missing || refundAmount <= 0) return;
    const earning = await this.entries.findOne({ idempotencyKey: `payee:booking:${String(booking._id)}:gross` }).session(session);
    if (!earning) return;
    const r = refundReversal(commissionBreakdown(booking.pricing.amountPaid, snap), refundAmount);
    const base = { payeeType: "operator", payeeId: booking.operatorId, bookingId: booking._id, reference: booking.bookingReference, source: booking.source, ruleSnapshot: snap, eligibleAt: earning.eligibleAt };
    const key = `payee:booking:${String(booking._id)}:refund`;
    await this.post(session, [
      { ...base, entryType: "refund_deduction", direction: "debit", amount: r.refundDeduction, description: "Refunded to the customer", idempotencyKey: `${key}:amount` },
      { ...base, entryType: "commission_reversal", direction: "credit", amount: r.commissionReversal, description: "Commission on the refunded amount", idempotencyKey: `${key}:commission` },
      { ...base, entryType: "tax_reversal", direction: "credit", amount: r.taxReversal, description: "GST on the reversed commission", idempotencyKey: `${key}:tax` },
      { ...base, entryType: "tds_reversal", direction: "credit", amount: r.tdsReversal, description: "TDS on the refunded amount", idempotencyKey: `${key}:tds` },
    ]);
  }

  /** A completed ride's earning for its partner. */
  async postRideEarning(session: ClientSession | undefined, ride: any): Promise<boolean> {
    const snap: CommissionSnapshot | null = ride.commissionSnapshot ?? null;
    if (!snap || snap.missing || !ride.partnerId) return false;
    const b = commissionBreakdown(ride.quotedAmount, snap);
    const base = { payeeType: "ride_partner", payeeId: ride.partnerId, rideRequestId: ride._id, reference: ride.requestNumber, ruleSnapshot: snap, eligibleAt: ride.completedAt ?? new Date() };
    const key = `payee:ride:${String(ride._id)}`;
    await this.post(session, [
      { ...base, entryType: "gross_earning", direction: "credit", amount: b.gross, description: "Ride fare", idempotencyKey: `${key}:gross` },
      { ...base, entryType: "commission", direction: "debit", amount: b.commission, description: `Tirvona commission (rule v${snap.version})`, idempotencyKey: `${key}:commission` },
      { ...base, entryType: "tax_on_commission", direction: "debit", amount: b.taxOnCommission, description: "GST on commission", idempotencyKey: `${key}:tax` },
      { ...base, entryType: "tds", direction: "debit", amount: b.tds, description: "TDS withheld", idempotencyKey: `${key}:tds` },
    ]);
    return true;
  }

  /** Organiser referral share on a delivered add-on (only when a referral rule applied). */
  async postReferral(request: any): Promise<boolean> {
    const snap: CommissionSnapshot | null = request.commissionSnapshot ?? null;
    if (!snap || snap.missing || !request.operatorId || request.paymentStatus !== "paid") return false;
    const amount = commissionBreakdown(request.quotedAmount, snap).commission;
    await this.post(undefined, [
      {
        payeeType: "operator",
        payeeId: request.operatorId,
        serviceRequestId: request._id,
        reference: request.requestNumber,
        ruleSnapshot: snap,
        entryType: "referral_earning",
        direction: "credit",
        amount,
        eligibleAt: request.fulfilledAt ?? new Date(),
        description: `Referral share on ${request.serviceType} add-on`,
        idempotencyKey: `payee:service:${String(request._id)}:referral`,
      },
    ]);
    return true;
  }

  /** Bookings confirmed while no commission rule matched: nothing is payable for them yet. */
  async bookingsAwaitingRule(): Promise<any[]> {
    const rows = (await this.bookings.find({ status: { $in: ["confirmed", "completed", "cancellation_requested"] } }).select("bookingReference operatorId source pricing departAt commissionSnapshot").sort({ createdAt: -1 }).limit(5000).lean()).filter((b: any) => !b.commissionSnapshot || b.commissionSnapshot.missing);
    return rows.slice(0, 200).map((b: any) => ({ id: String(b._id), bookingReference: b.bookingReference, operatorId: String(b.operatorId), source: b.source, amountPaid: b.pricing?.amountPaid ?? 0, departAt: b.departAt }));
  }

  /** Finance applies the currently active rule to a booking that had none, and posts its earning. */
  async applyCurrentRule(actor: YatraActor, bookingId: string): Promise<any> {
    return this.transactions.run(async (session) => {
      const booking = await this.bookings.findById(bookingId).session(session);
      if (!booking) throw new YatraException("Booking not found.", 404);
      if (booking.commissionSnapshot && !booking.commissionSnapshot.missing) throw new YatraException("This booking already has a commission rule.", 409);
      const snap = await this.snapshotFor("yatra_booking", { source: booking.source, operatorId: booking.operatorId });
      if (snap.missing) throw new YatraException("No active commission rule matches this booking. Create one first.", 409);
      booking.commissionSnapshot = { ...snap, appliedLaterBy: actor.id };
      booking.markModified?.("commissionSnapshot");
      await booking.save({ session });
      const departure = await this.departures.findById(booking.departureId).session(session);
      if (["confirmed", "completed", "cancellation_requested"].includes(booking.status))
        await this.postBookingEarning(session, booking, departure?.returnAt ?? departure?.departAt ?? new Date());
      await this.audit.record(actor, "commission_rule.applied_to_booking", { bookingId, ruleKey: snap.ruleKey, version: snap.version }, {}, session);
      return { bookingId, snapshot: snap };
    });
  }

  async addAdjustment(actor: YatraActor, dto: { payeeType: PayeeType; payeeId: string; direction: "credit" | "debit"; amount: number; reason: string }): Promise<any> {
    await this.payee(dto.payeeType, dto.payeeId);
    const key = `payee:adjustment:${randomCode(12)}`;
    await this.post(undefined, [
      { payeeType: dto.payeeType, payeeId: dto.payeeId, entryType: "adjustment", direction: dto.direction, amount: roundMoney(dto.amount), description: dto.reason, idempotencyKey: key, recordedBy: actor.id, eligibleAt: new Date() },
    ]);
    await this.audit.record(actor, "payee.adjustment", { ...dto });
    return this.summary(dto.payeeType, dto.payeeId);
  }

  // ================================================================ balances
  private async payee(payeeType: PayeeType, payeeId: string): Promise<any> {
    const row = payeeType === "operator" ? await this.operators.findById(payeeId).lean() : await this.partners.findById(payeeId).lean();
    if (!row) throw new YatraException(payeeType === "operator" ? "Organiser not found." : "Ride partner not found.", 404);
    return row;
  }

  async summary(payeeType: PayeeType, payeeId: string): Promise<any> {
    const rows = await this.entries.find({ payeeType, payeeId }).select("entryType direction amount eligibleAt").lean();
    const balance = payeeBalance(rows);
    const open = await this.payouts.find({ payeeId, status: { $in: OPEN_PAYOUT_STATUSES } }).select("amount").lean();
    const inOpenPayouts = sum(open, () => true);
    return { ...balance, inOpenPayouts, requestable: roundMoney(Math.max(0, balance.available - inOpenPayouts)) };
  }

  async statement(payeeType: PayeeType, payeeId: string, page: number, limit: number): Promise<any> {
    const filter = { payeeType, payeeId };
    const [rows, total] = await Promise.all([
      this.entries.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.entries.countDocuments(filter),
    ]);
    return { items: rows.map(entryView), total };
  }

  /** Everyone Tirvona owes money to, with their balances. */
  async payees(payeeType?: PayeeType): Promise<any[]> {
    const ops = payeeType === "ride_partner" ? [] : await this.operators.find({ status: { $in: ["approved", "suspended"] } }).select("organisationName").lean();
    const parts = payeeType === "operator" ? [] : await this.partners.find({ status: { $in: ["approved", "suspended"] } }).select("businessName").lean();
    const out: any[] = [];
    for (const o of ops) out.push({ payeeType: "operator", payeeId: String(o._id), name: o.organisationName, ...(await this.summary("operator", String(o._id))) });
    for (const p of parts) out.push({ payeeType: "ride_partner", payeeId: String(p._id), name: p.businessName, ...(await this.summary("ride_partner", String(p._id))) });
    return out.sort((a, b) => b.available - a.available);
  }

  // ================================================================= payouts
  private bankOf(row: any) {
    const p = row?.payout ?? {};
    if (!p.accountNumberLast4 && !p.upiId) return null;
    return { accountHolderName: p.accountHolderName ?? "", accountNumberLast4: p.accountNumberLast4 ?? "", ifsc: p.ifsc ?? "", bankName: p.bankName ?? "", upiId: p.upiId ?? "" };
  }

  /** A payout request against the payee's delivered, unpaid balance. One open request at a time. */
  async requestPayout(actor: YatraActor, payeeType: PayeeType, payeeId: string, amount: number, note = "", byFinance = false): Promise<any> {
    const payee = await this.payee(payeeType, payeeId);
    const bank = this.bankOf(payee);
    if (!bank) throw new YatraException("Add bank or UPI details before requesting a payout.", 400, "NO_PAYOUT_ACCOUNT");
    const value = roundMoney(amount);
    const { requestable } = await this.summary(payeeType, payeeId);
    if (!(value >= 1)) throw new YatraException("Enter an amount of at least ₹1.", 400);
    if (value > requestable) throw new YatraException(`You can request at most ₹${requestable}.`, 400, "AMOUNT_ABOVE_PAYABLE");
    try {
      const payout = await this.payouts.create({
        payoutNumber: `YPO-${randomCode(8)}`,
        payeeType,
        payeeId,
        payeeName: payee.organisationName ?? payee.businessName ?? "",
        amount: value,
        status: "pending",
        requestedBy: actor.id,
        requestedByRole: byFinance ? "finance" : "payee",
        requestNote: note,
        bankSnapshot: bank,
        history: [{ status: "pending", note: note || "Payout requested", by: actor.id }],
      });
      await this.audit.record(actor, "payout.requested", { payoutId: String(payout._id), payeeType, payeeId, amount: value, byFinance });
      return payoutView(payout.toObject());
    } catch (error: any) {
      if (error?.code === 11000) throw new YatraException("There is already an open payout for this payee. Finish or cancel it first.", 409, "PAYOUT_ALREADY_OPEN");
      throw error;
    }
  }

  async listPayouts(query: { status?: string; payeeType?: string; payeeId?: string; page: number; limit: number }): Promise<any> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.payeeType) filter.payeeType = query.payeeType;
    if (query.payeeId) filter.payeeId = query.payeeId;
    const [rows, total] = await Promise.all([
      this.payouts.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.payouts.countDocuments(filter),
    ]);
    return { items: rows.map(payoutView), total };
  }

  async getPayout(payoutId: string, scope?: { payeeType: PayeeType; payeeId: string }): Promise<any> {
    const filter: Record<string, unknown> = { _id: payoutId };
    if (scope) Object.assign(filter, { payeeType: scope.payeeType, payeeId: scope.payeeId });
    const payout = await this.payouts.findOne(filter).lean();
    if (!payout) throw new YatraException("Payout not found.", 404);
    return payoutView(payout);
  }

  private async move(actor: YatraActor, payoutId: string, from: string[], to: string, extra: Record<string, unknown>, note: string, scope?: Record<string, unknown>) {
    const updated = await this.transactions.run(async (session) => {
      const payout = await this.payouts.findOne({ _id: payoutId, ...(scope ?? {}) }).session(session);
      if (!payout) throw new YatraException("Payout not found.", 404);
      if (!from.includes(payout.status)) throw new YatraException(`A ${payout.status.replace(/_/g, " ")} payout cannot be moved to ${to.replace(/_/g, " ")}.`, 409);
      const before = payout.status;
      Object.assign(payout, extra, { status: to });
      payout.history.push({ status: to, note, by: actor.id });
      await payout.save({ session });
      await this.audit.record(actor, `payout.${to}`, { payoutId, amount: payout.amount, note }, { before: { status: before }, after: { status: to } }, session);
      return payout;
    });
    return updated;
  }

  /** Finance review. Approval re-checks the balance; it never moves money. */
  async reviewPayout(actor: YatraActor, payoutId: string, action: "start_review" | "approve" | "reject", note = ""): Promise<any> {
    if (action === "reject" && note.trim().length < 3) throw new YatraException("Please give a reason (at least 3 characters).", 400);
    if (action === "approve") {
      const payout = await this.payouts.findById(payoutId).lean();
      if (!payout) throw new YatraException("Payout not found.", 404);
      const s = await this.summary(payout.payeeType, String(payout.payeeId));
      if (payout.amount > roundMoney(s.available - (s.inOpenPayouts - payout.amount)))
        throw new YatraException("The payee's delivered balance no longer covers this payout (a refund or adjustment reduced it).", 409, "AMOUNT_ABOVE_PAYABLE");
    }
    const rules = {
      start_review: { from: ["pending"], to: "under_review", extra: { reviewedBy: actor.id, reviewedAt: new Date() } },
      approve: { from: ["pending", "under_review"], to: "approved", extra: { approvedBy: actor.id, approvedAt: new Date() } },
      reject: { from: ["pending", "under_review", "approved"], to: "rejected", extra: { rejectionReason: note.trim() } },
    }[action];
    const payout = await this.move(actor, payoutId, rules.from, rules.to, rules.extra, note.trim() || action.replace("_", " "));
    await this.notifyPayee(payout, `Payout ${payout.payoutNumber} ${rules.to.replace(/_/g, " ")}${note ? `: ${note}` : "."}`);
    return payoutView(payout.toObject());
  }

  async cancelPayout(actor: YatraActor, payoutId: string, scope?: { payeeType: PayeeType; payeeId: string }): Promise<any> {
    const payout = await this.move(actor, payoutId, ["pending", "under_review"], "cancelled", { cancelledAt: new Date() }, "Cancelled", scope);
    return payoutView(payout.toObject());
  }

  /**
   * Finance records a transfer it has already made outside Tirvona, with the
   * bank reference (UTR) and a private proof file. The payee's balance goes
   * down by a ledger "transfer" row; nothing is sent to any bank.
   */
  async recordTransfer(
    actor: YatraActor,
    payoutId: string,
    dto: { method: string; transferDate: string; reference: string; amount: number; note?: string },
    proof?: Express.Multer.File,
  ): Promise<any> {
    const reference = dto.reference.trim().toUpperCase();
    if (reference.length < 6) throw new YatraException("Enter the bank reference (UTR) of the transfer.", 400);
    const transferDate = new Date(dto.transferDate);
    if (Number.isNaN(transferDate.getTime()) || transferDate.getTime() > Date.now() + 86_400_000)
      throw new YatraException("Enter the date the transfer was made.", 400);
    const current = await this.payouts.findById(payoutId).lean();
    if (!current) throw new YatraException("Payout not found.", 404);
    if (current.status !== "approved") throw new YatraException("Only an approved payout can have a transfer recorded.", 409);
    if (roundMoney(dto.amount) !== roundMoney(current.amount))
      throw new YatraException(`The transfer amount must equal the approved payout (₹${current.amount}).`, 400, "AMOUNT_MISMATCH");
    if (await this.payouts.exists({ "transfer.reference": reference })) throw new YatraException("This bank reference is already recorded on another payout.", 409, "DUPLICATE_UTR");
    let proofRef: any = null;
    if (proof?.buffer?.length) {
      if (proof.buffer.length > DOCUMENT_MAX_BYTES) throw new YatraException("The proof file can be at most 10 MB.", 400);
      const detected = detectDocumentType(proof.buffer);
      if (!detected) throw new YatraException("Upload the proof as JPG, PNG, WEBP or PDF.", 400);
      const stored = await this.storage.put(proof.buffer, `yatra-payouts/${payoutId}`, detected.resourceType);
      proofRef = { ...stored, format: stored.format || detected.ext, mimeType: detected.mime };
    }
    try {
      const payout = await this.transactions.run(async (session) => {
        const row = await this.payouts.findOne({ _id: payoutId, status: "approved" }).session(session);
        if (!row) throw new YatraException("Only an approved payout can have a transfer recorded.", 409);
        row.transfer = { method: dto.method, transferDate, reference, amount: roundMoney(dto.amount), note: dto.note ?? "", proof: proofRef, recordedBy: actor.id, recordedAt: new Date() };
        row.markModified?.("transfer");
        row.status = "transfer_recorded";
        row.history.push({ status: "transfer_recorded", note: `Transfer recorded, UTR ${reference}`, by: actor.id });
        await row.save({ session });
        await this.post(session, [
          { payeeType: row.payeeType, payeeId: row.payeeId, payoutId: row._id, entryType: "transfer", direction: "debit", amount: row.amount, reference, description: `Payout ${row.payoutNumber} (${dto.method.toUpperCase()} ${reference})`, idempotencyKey: `payout:${String(row._id)}:transfer`, recordedBy: actor.id, eligibleAt: new Date() },
        ]);
        await this.audit.record(actor, "payout.transfer_recorded", { payoutId, reference, amount: row.amount, method: dto.method, hasProof: Boolean(proofRef) }, { before: { status: "approved" }, after: { status: "transfer_recorded" } }, session);
        return row;
      });
      await this.notifyPayee(payout, `₹${payout.amount} was sent to you (${dto.method.toUpperCase()} ${reference}).`);
      return payoutView(payout.toObject());
    } catch (error: any) {
      if (error?.code === 11000) throw new YatraException("This bank reference is already recorded on another payout.", 409, "DUPLICATE_UTR");
      throw error;
    }
  }

  /** Confirms a recorded transfer against the bank statement. A difference needs a note and stays visible. */
  async reconcilePayout(actor: YatraActor, payoutId: string, dto: { bankAmount: number; note?: string }): Promise<any> {
    const current = await this.payouts.findById(payoutId).lean();
    if (!current) throw new YatraException("Payout not found.", 404);
    const difference = roundMoney(Number(dto.bankAmount) - Number(current.transfer?.amount ?? 0));
    if (difference !== 0 && (dto.note ?? "").trim().length < 3)
      throw new YatraException(`The bank shows a difference of ₹${difference}. Explain it in the note.`, 400, "RECONCILIATION_DIFFERENCE");
    const payout = await this.move(
      actor,
      payoutId,
      ["transfer_recorded"],
      "reconciled",
      { reconciliation: { bankAmount: roundMoney(dto.bankAmount), difference, note: dto.note ?? "", reconciledBy: actor.id, reconciledAt: new Date() } },
      difference ? `Reconciled with difference ₹${difference}` : "Reconciled with bank statement",
    );
    return payoutView(payout.toObject());
  }

  async proofLink(payoutId: string, scope?: { payeeType: PayeeType; payeeId: string }): Promise<any> {
    const filter: Record<string, unknown> = { _id: payoutId };
    if (scope) Object.assign(filter, scope);
    const payout = await this.payouts.findOne(filter).lean();
    if (!payout?.transfer?.proof?.publicId) throw new YatraException("No transfer proof on this payout.", 404);
    return this.storage.signedUrl(payout.transfer.proof);
  }

  private async notifyPayee(payout: any, message: string): Promise<void> {
    if (payout.payeeType === "operator") await this.notifier.operatorTeam(String(payout.payeeId), "Payout update", message, "/operator/earnings");
    else {
      const partner = await this.partners.findById(payout.payeeId).select("ownerUserId").lean();
      await this.notifier.users([partner?.ownerUserId ? String(partner.ownerUserId) : null], "Payout update", message, "/ride-partner/earnings", "yatra.partner");
    }
  }

  // =============================================================== dashboard
  async dashboard(query: { from?: string; to?: string }): Promise<any> {
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = dayStart(query.from);
    if (query.to) range.$lt = new Date(dayStart(query.to).getTime() + 86_400_000);
    const when = Object.keys(range).length ? { createdAt: range } : {};
    const [ledger, payeeRows, payouts, recon, bookingCount] = await Promise.all([
      this.ledger.find(when).select("type amount").limit(50000).lean(),
      this.entries.find(when).select("payeeType entryType direction amount").limit(50000).lean(),
      this.payouts.find(when).select("status amount reconciliation").lean(),
      this.reconciliations.find({}).sort({ periodDate: -1 }).limit(14).lean(),
      this.bookings.countDocuments({ ...when, status: { $in: ["confirmed", "completed", "cancellation_requested", "cancelled"] }, paymentStatus: { $ne: "unpaid" } }),
    ]);
    const collected = sum(ledger, (r) => ["booking_payment", "service_payment", "ride_payment"].includes(r.type));
    const refunds = sum(ledger, (r) => ["booking_refund", "service_refund", "ride_refund"].includes(r.type));
    const commission = roundMoney(sum(payeeRows, (r) => r.entryType === "commission") - sum(payeeRows, (r) => r.entryType === "commission_reversal"));
    const gst = roundMoney(sum(payeeRows, (r) => r.entryType === "tax_on_commission") - sum(payeeRows, (r) => r.entryType === "tax_reversal"));
    const tds = roundMoney(sum(payeeRows, (r) => r.entryType === "tds") - sum(payeeRows, (r) => r.entryType === "tds_reversal"));
    const allPayees = await this.payees();
    const payable = (type: string) => roundMoney(allPayees.filter((p) => p.payeeType === type).reduce((t, p) => t + Math.max(0, p.available), 0));
    const pendingDelivery = (type: string) => roundMoney(allPayees.filter((p) => p.payeeType === type).reduce((t, p) => t + Math.max(0, p.pending), 0));
    return {
      collections: { total: collected, bookings: sum(ledger, (r) => r.type === "booking_payment"), addOns: sum(ledger, (r) => r.type === "service_payment"), rides: sum(ledger, (r) => r.type === "ride_payment"), confirmedBookings: bookingCount },
      refunds: { toWallet: refunds, unusablePaymentsReturned: sum(ledger, (r) => r.type === "unapplied_refund") },
      // Revenue is Tirvona's commission, not the gross collected.
      tirvona: { commission, gstOnCommission: gst, tdsWithheld: tds, revenueExGst: commission },
      payables: { organisers: payable("operator"), ridePartners: payable("ride_partner"), notYetDelivered: { organisers: pendingDelivery("operator"), ridePartners: pendingDelivery("ride_partner") } },
      transfers: {
        pending: sum(payouts, (p) => OPEN_PAYOUT_STATUSES.includes(p.status)),
        pendingCount: payouts.filter((p: any) => OPEN_PAYOUT_STATUSES.includes(p.status)).length,
        completed: sum(payouts, (p) => ["transfer_recorded", "reconciled"].includes(p.status)),
        awaitingReconciliation: payouts.filter((p: any) => p.status === "transfer_recorded").length,
        reconciliationDifferences: roundMoney(payouts.reduce((t: number, p: any) => t + Math.abs(Number(p.reconciliation?.difference ?? 0)), 0)),
      },
      razorpaySettlement: recon.map((r: any) => ({ periodDate: r.periodDate, status: r.status, checked: r.checkedCount, matched: r.matchedCount, settled: r.settledCount, mismatches: (r.mismatches ?? []).length, note: r.note })),
      bookingsAwaitingRule: (await this.bookingsAwaitingRule()).length,
    };
  }

  /** Day-by-day totals (India time) for a date range. */
  async dailyReport(from: string, to: string): Promise<any[]> {
    const start = dayStart(from);
    const end = new Date(dayStart(to).getTime() + 86_400_000);
    if (end.getTime() - start.getTime() > 370 * 86_400_000) throw new YatraException("Choose a range of at most one year.", 400);
    const [ledger, payeeRows, payouts] = await Promise.all([
      this.ledger.find({ createdAt: { $gte: start, $lt: end } }).select("type amount createdAt").lean(),
      this.entries.find({ createdAt: { $gte: start, $lt: end } }).select("entryType amount createdAt").lean(),
      this.payouts.find({ status: { $in: ["transfer_recorded", "reconciled"] } }).select("amount transfer").lean(),
    ]);
    const days = new Map<string, any>();
    const row = (d: string) => days.get(d) ?? days.set(d, { date: d, collections: 0, refunds: 0, commission: 0, gstOnCommission: 0, transfers: 0 }).get(d);
    for (const l of ledger) {
      const r = row(istDay(l.createdAt));
      if (["booking_payment", "service_payment", "ride_payment"].includes(l.type)) r.collections = roundMoney(r.collections + l.amount);
      if (["booking_refund", "service_refund", "ride_refund"].includes(l.type)) r.refunds = roundMoney(r.refunds + l.amount);
    }
    for (const e of payeeRows) {
      const r = row(istDay(e.createdAt));
      if (e.entryType === "commission") r.commission = roundMoney(r.commission + e.amount);
      if (e.entryType === "commission_reversal") r.commission = roundMoney(r.commission - e.amount);
      if (e.entryType === "tax_on_commission") r.gstOnCommission = roundMoney(r.gstOnCommission + e.amount);
      if (e.entryType === "tax_reversal") r.gstOnCommission = roundMoney(r.gstOnCommission - e.amount);
    }
    for (const p of payouts) {
      const at = p.transfer?.recordedAt ? new Date(p.transfer.recordedAt) : null;
      if (!at || at < start || at >= end) continue;
      const r = row(istDay(at));
      r.transfers = roundMoney(r.transfers + p.amount);
    }
    return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async reportCsv(actor: YatraActor, from: string, to: string): Promise<{ filename: string; csv: string }> {
    const rows = await this.dailyReport(from, to);
    const header = ["Date", "Collections", "Refunds to wallet", "Tirvona commission", "GST on commission", "Payout transfers"];
    const lines = rows.map((r) => [r.date, r.collections, r.refunds, r.commission, r.gstOnCommission, r.transfers].map(csvCell).join(","));
    await this.audit.record(actor, "finance.report_exported", { from, to, rows: rows.length });
    return { filename: `tirvona-yatra-finance-${from}-to-${to}.csv`, csv: [header.map(csvCell).join(","), ...lines].join("\r\n") };
  }

  // =========================================================== reconciliation
  /**
   * Razorpay settlement reconciliation for one day (India time): every Yatra
   * payment captured that day is checked against Razorpay, and against the
   * settlement report. Independent of organiser payout reconciliation.
   */
  async reconcileRazorpay(actor: YatraActor | null, day: string): Promise<any> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new YatraException("Use a date like 2026-12-01.", 400);
    const start = dayStart(day);
    const end = new Date(start.getTime() + 86_400_000);
    const paid = await this.payments.find({ status: "paid", paidAt: { $gte: start, $lt: end }, method: { $ne: "demo" } }).lean();
    const record: any = { kind: "razorpay_settlement", periodDate: day, ranBy: actor?.id ?? null, ranAt: new Date(), collectedAmount: sum(paid, () => true), checkedCount: paid.length };
    if (!this.recon || !this.recon.configured()) {
      Object.assign(record, { status: "skipped", note: "Razorpay keys are not configured here.", matchedCount: 0, settledCount: 0, settledAmount: 0, mismatches: [] });
    } else {
      try {
        const settled = await this.recon.settledPayments(day).catch(() => []);
        const settledIds = new Map(settled.map((s) => [s.paymentId, s]));
        const mismatches: any[] = [];
        let matched = 0;
        let settledCount = 0;
        let settledAmount = 0;
        for (const p of paid) {
          const paymentId = String(p.gateway?.paymentId ?? "");
          const issue = compareGatewayPayment({ paymentId, amount: p.amount }, await this.recon.fetchPayment(paymentId));
          if (issue) mismatches.push({ paymentId, orderId: p.gateway?.orderId ?? "", amount: p.amount, issue, unapplied: Boolean(p.unapplied) });
          else matched += 1;
          const s = settledIds.get(paymentId);
          if (s) {
            settledCount += 1;
            settledAmount += s.amount / 100;
          }
        }
        Object.assign(record, { status: "completed", matchedCount: matched, settledCount, settledAmount: roundMoney(settledAmount), mismatches, note: settledCount < matched ? "Razorpay settles a few days after capture; unsettled payments are normal for recent days." : "" });
      } catch (error) {
        Object.assign(record, { status: "failed", note: (error as Error).message.slice(0, 300), matchedCount: 0, settledCount: 0, settledAmount: 0, mismatches: [] });
      }
    }
    const saved = await this.reconciliations.findOneAndUpdate({ kind: "razorpay_settlement", periodDate: day }, { $set: record }, { new: true, upsert: true }).lean();
    if (actor) await this.audit.record(actor, "reconciliation.razorpay_run", { day, status: saved.status, mismatches: (saved.mismatches ?? []).length });
    return { ...saved, id: String(saved._id) };
  }

  async reconciliationRuns(limit = 60): Promise<any[]> {
    const rows = await this.reconciliations.find({}).sort({ periodDate: -1 }).limit(limit).lean();
    return rows.map((r: any) => ({ id: String(r._id), periodDate: r.periodDate, status: r.status, checkedCount: r.checkedCount, matchedCount: r.matchedCount, settledCount: r.settledCount, settledAmount: r.settledAmount, collectedAmount: r.collectedAmount, mismatches: r.mismatches ?? [], note: r.note ?? "", ranAt: r.ranAt }));
  }

  // ======================================================== payee self-service
  async operatorIdForOwner(userId: string): Promise<string | null> {
    const member = await this.members.findOne({ userId, status: "active" }).lean();
    return member ? String(member.operatorId) : null;
  }
}
