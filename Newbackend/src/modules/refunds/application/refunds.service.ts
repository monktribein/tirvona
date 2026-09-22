import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Types, type Model } from "mongoose";
import { createHash, randomUUID } from "node:crypto";
import Razorpay from "razorpay";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { canManageAllAshrams } from "../../../common/auth/ashram-access";
import { resolveAshramScope } from "../../../common/auth/ashram-scope";
import {
  actorFromUser,
  bookingBelongsTo,
  bookingOwnerFilter,
  type BookingActor,
} from "../../bookings/domain/booking-customer";
import { calculateRefund } from "../domain/refund-calculator";
import {
  REFUND_TRANSITIONS,
  type RefundStatus,
} from "../infrastructure/persistence/refund.schemas";
import { RefundPolicyService } from "./refund-policy.service";

interface AuditActor {
  id?: string | null;
  role?: string;
  whatsappCustomerId?: string | null;
}

const PLATFORM_ROLES = ["super_admin", "national_admin"];
const FINANCE_ROLES = ["finance_manager"];
const SUPPORT_ROLES = ["support"];
const ASHRAM_ROLES = ["ashram_owner", "owner", "manager"];

@Injectable()
export class RefundsService {
  constructor(
    @InjectModel("RefundRequest") private readonly requests: Model<any>,
    @InjectModel("RefundCalculation") private readonly calculations: Model<any>,
    @InjectModel("RefundTransaction") private readonly transactions: Model<any>,
    @InjectModel("RefundStatusHistory") private readonly history: Model<any>,
    @InjectModel("RefundAuditLog") private readonly audit: Model<any>,
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("BookingNotification")
    private readonly notifications: Model<any>,
    private readonly policies: RefundPolicyService,
    private readonly config: ConfigService,
  ) { }

  private async scopeFor(
    user: AuthenticatedUser,
  ): Promise<Record<string, any>> {
    if (
      PLATFORM_ROLES.includes(user.role) || canManageAllAshrams(user) ||
      FINANCE_ROLES.includes(user.role) ||
      SUPPORT_ROLES.includes(user.role)
    )
      return { isDeleted: false };

    if (ASHRAM_ROLES.includes(user.role)) {
      const ids = (await resolveAshramScope(user, this.ashrams)) ?? [];
      return { isDeleted: false, ashramId: { $in: ids } };
    }

    return { isDeleted: false, customerId: user.id };
  }

  private canApprove(user: AuthenticatedUser): boolean {
    return (
      PLATFORM_ROLES.includes(user.role) || FINANCE_ROLES.includes(user.role)
    );
  }

  private canReview(user: AuthenticatedUser): boolean {
    return this.canApprove(user) || SUPPORT_ROLES.includes(user.role);
  }

  private assertTransition(from: RefundStatus, to: RefundStatus): void {
    if (!REFUND_TRANSITIONS[from]?.includes(to))
      throw new BadRequestException(
        `A refund cannot move from ${from.replace(/_/g, " ")} to ${to.replace(/_/g, " ")}`,
      );
  }

  private async recordStatus(
    request: any,
    to: RefundStatus,
    user: AuthenticatedUser | null,
    note = "",
  ): Promise<void> {
    const from = request.status as RefundStatus;
    this.assertTransition(from, to);
    request.status = to;
    await this.history.create({
      requestId: request._id,
      fromStatus: from,
      toStatus: to,
      note,
      actorId: user?.id ?? null,
      actorRole: user?.role ?? "system",
    });
  }

  /**
   * Who acted, for the audit trail: a website user or staff member by `id`,
   * a WhatsApp guest by `whatsappCustomerId`. Never both, and never an
   * invented User for a guest.
   */
  private actorFields(actor: AuditActor | null): Record<string, unknown> {
    return {
      actorId: actor?.id ?? null,
      actorWhatsAppCustomerId: actor?.whatsappCustomerId ?? null,
      actorRole: actor?.role ?? "system",
    };
  }

  private log(
    action: string,
    user: AuditActor | null,
    requestId: unknown,
    extra: Record<string, unknown> = {},
  ): Promise<any> {
    return this.audit.create({
      requestId,
      action,
      ...this.actorFields(user),
      ...extra,
    });
  }

  private async loadSource(module: string, sourceId: string) {
    if (module !== "ashram_booking")
      throw new BadRequestException(
        `Refunds for ${module.replace(/_/g, " ")} are not yet wired to a source record`,
      );
    const booking = await this.bookings.findById(sourceId).lean();
    if (!booking) throw new NotFoundException("Booking not found");
    const pricing = booking.pricing ?? {};
    return {
      // A booking belongs to a website account or to a WhatsApp customer,
      // never both. Whichever it is, the refund request follows it.
      customerId: booking.customerId ? String(booking.customerId) : null,
      whatsappCustomerId: booking.whatsappCustomerId
        ? String(booking.whatsappCustomerId)
        : null,
      ashramId: booking.ashramId ? String(booking.ashramId) : null,
      reference: booking.bookingId ?? "",
      status: booking.status,
      // What `BookingsService.cancel` decided, when it has run.
      cancellationRefundAmount:
        booking.cancellation?.refundAmount === undefined ||
        booking.cancellation?.refundAmount === null
          ? null
          : Number(booking.cancellation.refundAmount),
      row: booking,
      source: {
        amountPaid: Number(pricing.amountPaid ?? 0),
        baseAmount: Number(pricing.basePrice ?? 0),
        addOnsAmount: Number(pricing.servicesPrice ?? 0),
        donationAmount: Number(pricing.donationAmount ?? 0),
        platformFee: Number(pricing.platformFee ?? 0),
        gstAmount: Number(pricing.gstAmount ?? 0),
        serviceDate: booking.checkInDate ? new Date(booking.checkInDate) : null,
      },
    };
  }

  async create(
    user: AuthenticatedUser,
    dto: {
      module: string;
      sourceId: string;
      reason: string;
      customerNote?: string;
    },
  ): Promise<any> {
    return this.createFor(actorFromUser(user), dto);
  }

  /**
   * Opens a refund request for a website user, a member of staff acting for a
   * customer, or a WhatsApp guest — through one path. Ownership is decided by
   * `bookingBelongsTo` against whichever identity the booking carries, so a
   * guest can reach only their own booking and no User row is ever invented.
   */
  async createFor(
    actor: BookingActor,
    dto: {
      module: string;
      sourceId: string;
      reason: string;
      customerNote?: string;
    },
  ): Promise<any> {
    const loaded = await this.loadSource(dto.module, dto.sourceId);
    const requester: AuditActor = {
      id: actor.userId,
      whatsappCustomerId: actor.whatsappCustomerId,
      role: actor.role,
    };

    const onBehalf = Boolean(
      actor.principal && this.canReview(actor.principal),
    );
    if (!onBehalf && !bookingBelongsTo(loaded.row, actor))
      throw new ForbiddenException("This purchase belongs to another account");

    if (loaded.source.amountPaid <= 0)
      throw new BadRequestException(
        "Nothing has been collected against this booking, so there is nothing to refund",
      );

    // A cancellation that already recorded a refund is being paid out through
    // the booking's own refund. Opening a second claim for the same money is
    // how a guest gets refunded twice.
    const settledElsewhere = await (
      this.bookings.db?.models?.BookingRefund as Model<any> | undefined
    )
      ?.findOne({
        bookingId: dto.sourceId,
        status: { $in: ["processing", "success"] },
      })
      .lean();
    if (settledElsewhere)
      throw new ConflictException(
        "This booking's cancellation refund has already been processed",
      );

    const { policy, policyId } = await this.policies.resolve(
      dto.module,
      loaded.ashramId,
    );
    const breakdown = calculateRefund(policy, loaded.source, new Date());

    // One authoritative refund decision. When the booking has been cancelled,
    // `BookingsService.cancel` has already decided how much comes back, and
    // this request is only the review/payout lifecycle for that amount — it
    // does not get to recompute it under a second policy model.
    if (loaded.cancellationRefundAmount !== null) {
      if (loaded.cancellationRefundAmount <= 0)
        throw new BadRequestException(
          "This booking's cancellation does not refund anything",
        );
      breakdown.netRefundable = loaded.cancellationRefundAmount;
      breakdown.grossRefundable = loaded.cancellationRefundAmount;
      breakdown.notes = [
        ...(breakdown.notes ?? []),
        "Amount fixed by the booking's cancellation decision",
      ];
    }

    let request: any;
    try {
      request = await this.requests.create({
        refundNumber: `RFD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`,
        module: dto.module,
        sourceId: new Types.ObjectId(dto.sourceId),
        sourceReference: loaded.reference,
        customerId: loaded.customerId,
        whatsappCustomerId: loaded.whatsappCustomerId,
        ashramId: loaded.ashramId,
        reason: dto.reason,
        customerNote: dto.customerNote ?? "",
        requestedAmount: breakdown.netRefundable,
        policyId,
        requestedBy: actor.userId,
        requestedByWhatsAppCustomerId: actor.whatsappCustomerId,
        status: "pending",
      });
    } catch (error: any) {
      if (error?.code === 11000)
        throw new ConflictException(
          "A refund request for this purchase is already in progress",
        );
      throw error;
    }

    const calculation = await this.calculations.create({
      requestId: request._id,
      policyId,
      policySnapshot: policy,
      originalAmount: loaded.source.baseAmount,
      amountPaid: loaded.source.amountPaid,
      breakdown: {
        baseAmount: loaded.source.baseAmount,
        addOnsAmount: loaded.source.addOnsAmount,
        donationAmount: loaded.source.donationAmount,
        platformFee: loaded.source.platformFee,
        gstAmount: loaded.source.gstAmount,
      },
      refundableComponents: breakdown.refundableComponents,
      appliedWindow: breakdown.appliedWindow,
      hoursBeforeService: breakdown.hoursBeforeService,
      refundPercent: breakdown.refundPercent,
      grossRefundable: breakdown.grossRefundable,
      processingFee: breakdown.processingFee,
      netRefundable: breakdown.netRefundable,
      nonRefundableAmount: breakdown.nonRefundableAmount,
      notes: breakdown.notes,
    });
    request.calculationId = calculation._id;

    await this.history.create({
      requestId: request._id,
      toStatus: "pending",
      note: "Refund requested",
      ...this.actorFields(requester),
    });
    await this.log("REFUND_REQUESTED", requester, request._id, {
      after: { amount: breakdown.netRefundable, policyId },
    });

    const threshold = Number((policy as any).autoApproveBelow ?? 0);
    if (threshold > 0 && breakdown.netRefundable <= threshold) {
      await this.recordStatus(
        request,
        "approved",
        null,
        `Auto-approved: ₹${breakdown.netRefundable} is within the ₹${threshold} threshold`,
      );
      request.autoApproved = true;
      request.approvedAt = new Date();
      await this.log("REFUND_AUTO_APPROVED", null, request._id);
    }

    await request.save();
    return actor.principal
      ? this.get(actor.principal, String(request._id))
      : this.getOwned(actor, String(request._id));
  }

  async list(
    user: AuthenticatedUser,
    query: { status?: string; module?: string; page?: number; limit?: number },
  ): Promise<any> {
    const scope = await this.scopeFor(user);
    const filter = {
      ...scope,
      ...(query.status ? { status: query.status } : {}),
      ...(query.module ? { module: query.module } : {}),
    };
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const [data, total] = await Promise.all([
      this.requests
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("customerId", "name email")
        .populate("whatsappCustomerId", "wappId name phone")
        .populate("ashramId", "name")
        .populate("calculationId")
        .lean(),
      this.requests.countDocuments(filter),
    ]);
    return { data, total, page };
  }

  async get(user: AuthenticatedUser, id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException("Refund request not found");
    const scope = await this.scopeFor(user);
    return this.loadDetail({ _id: id, ...scope }, id);
  }

  /** One refund request, but only if it belongs to this customer identity. */
  async getOwned(actor: BookingActor, id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException("Refund request not found");
    return this.loadDetail(
      { _id: id, isDeleted: false, ...bookingOwnerFilter(actor) },
      id,
    );
  }

  private async loadDetail(
    filter: Record<string, unknown>,
    id: string,
  ): Promise<any> {
    const request = await this.requests
      .findOne(filter)
      .populate("customerId", "name email")
      .populate("whatsappCustomerId", "wappId name phone")
      .populate("ashramId", "name")
      .populate("calculationId")
      .lean();
    if (!request) throw new NotFoundException("Refund request not found");
    const [history, transactions] = await Promise.all([
      this.history.find({ requestId: id }).sort({ occurredAt: 1 }).lean(),
      this.transactions.find({ requestId: id }).sort({ createdAt: -1 }).lean(),
    ]);
    return { ...request, history, transactions };
  }

  /**
   * The refund state of one booking, for the customer who owns it. This is
   * what a WhatsApp guest asks ("mera refund kahan hai") and what a website
   * user's booking page can show. Ownership is checked against the booking's
   * own identity, so a reference alone reveals nothing.
   *
   * Reports both records honestly: the refund the cancellation recorded on the
   * booking, and any review/payout request opened for it.
   */
  async statusForBooking(actor: BookingActor, bookingId: string): Promise<any> {
    if (!Types.ObjectId.isValid(bookingId))
      throw new NotFoundException("Booking not found");
    const booking = await this.bookings.findById(bookingId).lean();
    if (!booking || !bookingBelongsTo(booking, actor))
      throw new NotFoundException("Booking not found");
    const BookingRefund = this.bookings.db?.models?.BookingRefund as
      | Model<any>
      | undefined;
    const [request, cancellationRefund] = await Promise.all([
      this.requests
        .findOne({
          module: "ashram_booking",
          sourceId: booking._id,
          isDeleted: false,
          ...bookingOwnerFilter(actor),
        })
        .sort({ createdAt: -1 })
        .lean(),
      BookingRefund
        ? BookingRefund.findOne({ bookingId: booking._id })
            .sort({ createdAt: -1 })
            .lean()
        : Promise.resolve(null),
    ]);
    return {
      bookingId: booking.bookingId,
      bookingStatus: booking.status,
      decidedRefundAmount: booking.cancellation?.refundAmount ?? null,
      cancellationRefund: cancellationRefund
        ? {
            reference: (cancellationRefund as any).refundReference,
            amount: (cancellationRefund as any).amount,
            status: (cancellationRefund as any).status,
          }
        : null,
      request: request
        ? {
            refundNumber: (request as any).refundNumber,
            status: (request as any).status,
            amount: (request as any).requestedAmount,
          }
        : null,
    };
  }

  private async notifyCustomer(
    request: any,
    event: string,
    title: string,
    message: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await this.notifications.create({
      // Addressed to whichever identity owns the request. A WhatsApp guest has
      // no `userId`; the notification worker delivers to their WhatsApp number.
      userId: request.customerId ?? undefined,
      whatsappCustomerId: request.whatsappCustomerId ?? undefined,
      bookingId: request.sourceId,
      ashramId: request.ashramId,
      event,
      title,
      message,
      channel: "in_app",
      status: "queued",
      pushEnabled: true,
      data,
      meta: { correlationId: `refund:${String(request._id)}:${event}` },
    });
  }

  async review(user: AuthenticatedUser, id: string, note: string): Promise<any> {
    if (!this.canReview(user))
      throw new ForbiddenException("Not authorized to review refunds");
    const request = await this.requests.findOne({ _id: id, isDeleted: false });
    if (!request) throw new NotFoundException("Refund request not found");
    await this.recordStatus(request, "under_review", user, note);
    request.reviewedBy = user.id;
    request.reviewedAt = new Date();
    await request.save();
    await this.log("REFUND_UNDER_REVIEW", user, request._id);
    return this.get(user, id);
  }

  async approve(user: AuthenticatedUser, id: string, note: string): Promise<any> {
    if (!this.canApprove(user))
      throw new ForbiddenException("Not authorized to approve refunds");
    const request = await this.requests.findOne({ _id: id, isDeleted: false });
    if (!request) throw new NotFoundException("Refund request not found");

    const calculation = await this.calculations.findById(request.calculationId).lean();
    const amount = Number(calculation?.netRefundable ?? 0);
    const policy: any = calculation?.policySnapshot ?? {};

    const dualThreshold = Number(policy.requiresSecondApprovalAbove ?? 0);
    if (dualThreshold > 0 && amount >= dualThreshold) {
      if (!request.approvedBy) {
        request.approvedBy = user.id;
        request.approvedAt = new Date();
        await this.recordStatus(
          request,
          "under_review",
          user,
          `First approval recorded; ₹${amount} requires a second approver`,
        );
        await request.save();
        await this.log("REFUND_FIRST_APPROVAL", user, request._id);
        return this.get(user, id);
      }
      if (String(request.approvedBy) === String(user.id))
        throw new ForbiddenException(
          "A second, different approver is required for this amount",
        );
      request.secondApprovedBy = user.id;
    }

    await this.recordStatus(request, "approved", user, note);
    request.approvedBy = request.approvedBy ?? user.id;
    request.approvedAt = request.approvedAt ?? new Date();
    await request.save();
    await this.log("REFUND_APPROVED", user, request._id, { after: { amount } });
    await this.notifyCustomer(
      request,
      "refund_approved",
      "Refund approved",
      `Your refund of ₹${amount} has been approved and is being processed.`,
      {
        amount: String(amount),
        refundNumber: String(request.refundNumber ?? ""),
        refundStatus: "approved",
      },
    );
    return this.get(user, id);
  }

  async reject(user: AuthenticatedUser, id: string, reason: string): Promise<any> {
    if (!this.canReview(user))
      throw new ForbiddenException("Not authorized to reject refunds");
    if (!reason?.trim())
      throw new BadRequestException("A rejection reason is required");
    const request = await this.requests.findOne({ _id: id, isDeleted: false });
    if (!request) throw new NotFoundException("Refund request not found");
    await this.recordStatus(request, "rejected", user, reason);
    request.rejectedBy = user.id;
    request.rejectedAt = new Date();
    request.rejectionReason = reason;
    await request.save();
    await this.log("REFUND_REJECTED", user, request._id, { after: { reason } });
    return this.get(user, id);
  }

  async cancel(user: AuthenticatedUser, id: string, note: string): Promise<any> {
    const scope = await this.scopeFor(user);
    const request = await this.requests.findOne({ _id: id, ...scope });
    if (!request) throw new NotFoundException("Refund request not found");
    if (
      !this.canReview(user) &&
      String(request.requestedBy) !== String(user.id)
    )
      throw new ForbiddenException("Only the requester may cancel this claim");
    await this.recordStatus(request, "cancelled", user, note);
    await request.save();
    await this.log("REFUND_CANCELLED", user, request._id);
    return this.get(user, id);
  }

  async process(user: AuthenticatedUser, id: string): Promise<any> {
    if (!this.canApprove(user))
      throw new ForbiddenException("Not authorized to process refunds");
    const request = await this.requests.findOne({ _id: id, isDeleted: false });
    if (!request) throw new NotFoundException("Refund request not found");

    const calculation = await this.calculations.findById(request.calculationId).lean();
    const amount = Number(calculation?.netRefundable ?? 0);
    if (amount <= 0)
      throw new BadRequestException("This refund calculates to zero");

    const booking = await this.bookings.findById(request.sourceId).lean();
    const gatewayPaymentId = booking?.paymentSummary?.paymentId ?? booking?.gateway?.paymentId;

    const attempt = (await this.transactions.countDocuments({ requestId: id })) + 1;
    const idempotencyKey = createHash("sha256")
      .update(`${id}:${attempt}:${amount}`)
      .digest("hex");

    await this.recordStatus(request, "processing", user, "Sent to gateway");
    await request.save();

    let transaction: any;
    try {
      transaction = await this.transactions.create({
        requestId: request._id,
        idempotencyKey,
        provider: "razorpay",
        method: booking?.paymentMode ?? "razorpay",
        gatewayPaymentId,
        amount,
        status: "initiated",
        attempt,
        initiatedBy: user.id,
      });
    } catch (error: any) {
      if (error?.code === 11000)
        throw new ConflictException(
          "This refund attempt has already been submitted",
        );
      throw error;
    }

    const keyId = this.config.get<string>("razorpayKeyId");
    const keySecret = this.config.get<string>("razorpayKeySecret");

    if (!keyId || !keySecret) {
      if (this.config.get<string>("nodeEnv") === "production")
        throw new BadRequestException(
          "Payment gateway is not configured; a refund cannot be issued",
        );
      transaction.status = "succeeded";
      transaction.settledAt = new Date();
      transaction.gatewayResponse = { demo: true };
      await transaction.save();
      return this.settle(request, user, "Demo gateway — no money moved");
    }

    if (!gatewayPaymentId) {
      transaction.status = "failed";
      transaction.failureReason =
        "No gateway payment reference on the original purchase";
      await transaction.save();
      await this.recordStatus(request, "failed", user, transaction.failureReason);
      await request.save();
      await this.log("REFUND_FAILED", user, request._id, {
        after: { reason: transaction.failureReason },
      });
      await this.notifyCustomer(
        request,
        "refund_failed",
        "Refund failed",
        "We couldn't process your refund. Our support team has been notified.",
        {
          refundNumber: String(request.refundNumber ?? ""),
          refundStatus: "failed",
        },
      );
      throw new BadRequestException(
        "The original payment has no gateway reference, so it cannot be refunded automatically",
      );
    }

    try {
      const gateway = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const result: any = await gateway.payments.refund(gatewayPaymentId, {
        amount: Math.round(amount * 100),
        speed: "normal",
        notes: { refundNumber: request.refundNumber },
      });
      transaction.gatewayRefundId = result?.id;
      transaction.gatewayResponse = result;
      transaction.status = "processing";
      await transaction.save();
      await this.log("REFUND_GATEWAY_INITIATED", user, request._id, {
        after: { gatewayRefundId: result?.id, amount },
      });
      if (result?.status === "processed")
        return this.settle(request, user, "Gateway reported the refund processed");
      return this.get(user, id);
    } catch (error: any) {
      transaction.status = "failed";
      transaction.failureReason = String(
        error?.error?.description ?? error?.message ?? "Gateway rejected the refund",
      );
      await transaction.save();
      await this.recordStatus(request, "failed", user, transaction.failureReason);
      await request.save();
      await this.log("REFUND_FAILED", user, request._id, {
        after: { reason: transaction.failureReason, attempt },
      });
      await this.notifyCustomer(
        request,
        "refund_failed",
        "Refund failed",
        "We couldn't process your refund. Our support team has been notified.",
        {
          refundNumber: String(request.refundNumber ?? ""),
          refundStatus: "failed",
        },
      );
      throw new BadRequestException(transaction.failureReason);
    }
  }

  private async settle(
    request: any,
    user: AuthenticatedUser | null,
    note: string,
  ): Promise<any> {
    const calculation = await this.calculations.findById(request.calculationId).lean();
    const amount = Number(calculation?.netRefundable ?? 0);

    await this.recordStatus(request, "refunded", user, note);
    request.settledAt = new Date();
    await request.save();

    await this.bookings.updateOne(
      { _id: request.sourceId },
      {
        $set: {
          status: "refunded",
          paymentStatus: "refunded",
          "cancellation.refundAmount": amount,
          "cancellation.date": new Date(),
        },
      },
    );
    await this.log("REFUND_SETTLED", user, request._id, { after: { amount } });
    await this.notifyCustomer(
      request,
      "refund_completed",
      "Refund completed",
      `Your refund of ₹${amount} has been credited.`,
      {
        amount: String(amount),
        refundNumber: String(request.refundNumber ?? ""),
        refundStatus: "completed",
      },
    );
    return this.requests.findById(request._id).lean();
  }

  async summary(user: AuthenticatedUser): Promise<any> {
    const scope = await this.scopeFor(user);
    const [byStatus, totals] = await Promise.all([
      this.requests.aggregate([
        { $match: scope },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      this.requests.aggregate([
        { $match: { ...scope, status: "refunded" } },
        {
          $lookup: {
            from: "refund_calculations",
            localField: "calculationId",
            foreignField: "_id",
            as: "calc",
          },
        },
        { $unwind: { path: "$calc", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            settledCount: { $sum: 1 },
            settledAmount: { $sum: { $ifNull: ["$calc.netRefundable", 0] } },
          },
        },
      ]),
    ]);
    const counts: Record<string, number> = {};
    for (const row of byStatus) counts[String(row._id)] = row.count;
    return {
      counts,
      openCount:
        (counts.pending ?? 0) +
        (counts.under_review ?? 0) +
        (counts.approved ?? 0) +
        (counts.processing ?? 0),
      settledCount: totals[0]?.settledCount ?? 0,
      settledAmount: Math.round((totals[0]?.settledAmount ?? 0) * 100) / 100,
    };
  }
}
