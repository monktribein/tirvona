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
import { canManageAllAshrams, isAshramOwner } from "../../../common/auth/ashram-access";
import { calculateRefund } from "../domain/refund-calculator";
import {
  REFUND_TRANSITIONS,
  type RefundStatus,
} from "../infrastructure/persistence/refund.schemas";
import { RefundPolicyService } from "./refund-policy.service";

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
      const ids =
        isAshramOwner(user)
          ? (await this.ashrams.find({ ownerId: user.id }).distinct("_id"))
          : [
            ...new Set(
              [
                ...(user.scopedAshramIds ?? []),
                ...(user.employerAshramId ? [user.employerAshramId] : []),
              ].filter(Boolean),
            ),
          ];
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

  private log(
    action: string,
    user: AuthenticatedUser | null,
    requestId: unknown,
    extra: Record<string, unknown> = {},
  ): Promise<any> {
    return this.audit.create({
      requestId,
      action,
      actorId: user?.id ?? null,
      actorRole: user?.role ?? "system",
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
      customerId: String(booking.customerId),
      ashramId: booking.ashramId ? String(booking.ashramId) : null,
      reference: booking.bookingId ?? "",
      status: booking.status,
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
    const loaded = await this.loadSource(dto.module, dto.sourceId);

    const onBehalf = this.canReview(user);
    if (!onBehalf && loaded.customerId !== String(user.id))
      throw new ForbiddenException("This purchase belongs to another account");

    if (loaded.source.amountPaid <= 0)
      throw new BadRequestException(
        "Nothing has been collected against this booking, so there is nothing to refund",
      );

    const { policy, policyId } = await this.policies.resolve(
      dto.module,
      loaded.ashramId,
    );
    const breakdown = calculateRefund(policy, loaded.source, new Date());

    let request: any;
    try {
      request = await this.requests.create({
        refundNumber: `RFD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`,
        module: dto.module,
        sourceId: new Types.ObjectId(dto.sourceId),
        sourceReference: loaded.reference,
        customerId: loaded.customerId,
        ashramId: loaded.ashramId,
        reason: dto.reason,
        customerNote: dto.customerNote ?? "",
        requestedAmount: breakdown.netRefundable,
        policyId,
        requestedBy: user.id,
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
      actorId: user.id,
      actorRole: user.role,
    });
    await this.log("REFUND_REQUESTED", user, request._id, {
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
    return this.get(user, String(request._id));
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
    const request = await this.requests
      .findOne({ _id: id, ...scope })
      .populate("customerId", "name email")
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
