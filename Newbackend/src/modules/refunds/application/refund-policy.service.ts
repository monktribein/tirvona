import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { RefundPolicyInput } from "../domain/refund-calculator";

/**
 * The policy used when nothing is configured.
 *
 * Deliberately conservative — no fee or tax returned, donations kept — so an
 * unconfigured platform never refunds more than the stay itself. It is a
 * documented default rather than a hidden constant: it is snapshotted onto
 * every calculation that uses it, so a refund settled before any policy was
 * created still shows exactly which rules applied.
 */
export const FALLBACK_POLICY: RefundPolicyInput & { name: string } = {
  name: "Platform default (no policy configured)",
  cancellationWindows: [
    { label: "72 hours or more", hoursBefore: 72, refundPercent: 100 },
    { label: "48 hours or more", hoursBefore: 48, refundPercent: 75 },
    { label: "24 hours or more", hoursBefore: 24, refundPercent: 50 },
  ],
  defaultRefundPercent: 0,
  processingFee: { type: "none", value: 0, maxAmount: 0 },
  refundPlatformFee: false,
  refundGst: false,
  refundAddOns: true,
  refundDonation: false,
  claimWindowHours: 0,
};

@Injectable()
export class RefundPolicyService {
  constructor(
    @InjectModel("RefundPolicy") private readonly policies: Model<any>,
    @InjectModel("RefundAuditLog") private readonly audit: Model<any>,
  ) {}

  /**
   * Resolve the one policy that governs a refund.
   *
   * Most specific wins: a policy scoped to this ashram beats one scoped to the
   * module, which beats a global one. Within the same scope the higher
   * `priority` wins, then the most recently updated. Returning a single policy
   * rather than merging several keeps the applied rules explainable to a
   * customer disputing an amount.
   */
  async resolve(
    module: string,
    ashramId?: string | null,
  ): Promise<{ policy: RefundPolicyInput & { name: string }; policyId: string | null }> {
    const candidates = await this.policies
      .find({
        isActive: true,
        isDeleted: false,
        $or: [
          ...(ashramId ? [{ module, ashramId }] : []),
          { module, ashramId: null },
          { module: "global", ashramId: null },
        ],
      })
      .lean();

    if (!candidates.length)
      return { policy: FALLBACK_POLICY, policyId: null };

    const specificity = (row: any) =>
      row.ashramId ? 3 : row.module !== "global" ? 2 : 1;
    candidates.sort(
      (a: any, b: any) =>
        specificity(b) - specificity(a) ||
        (b.priority ?? 0) - (a.priority ?? 0) ||
        new Date(b.updatedAt ?? 0).getTime() -
          new Date(a.updatedAt ?? 0).getTime(),
    );

    const chosen = candidates[0];
    return { policy: chosen, policyId: String(chosen._id) };
  }

  list(filter: Record<string, unknown> = {}): Promise<any[]> {
    return this.policies
      .find({ isDeleted: false, ...filter })
      .sort({ module: 1, priority: -1 })
      .lean();
  }

  async get(id: string): Promise<any> {
    const policy = await this.policies.findOne({ _id: id, isDeleted: false }).lean();
    if (!policy) throw new NotFoundException("Refund policy not found");
    return policy;
  }

  /** Reject rules that cannot be satisfied before they can misprice a refund. */
  private validate(dto: Record<string, any>): void {
    for (const window of dto.cancellationWindows ?? []) {
      if (window.refundPercent < 0 || window.refundPercent > 100)
        throw new BadRequestException(
          "A cancellation window must refund between 0 and 100 percent",
        );
    }
    const seen = new Set<number>();
    for (const window of dto.cancellationWindows ?? []) {
      if (seen.has(window.hoursBefore))
        throw new BadRequestException(
          `Two windows share the same ${window.hoursBefore}h threshold`,
        );
      seen.add(window.hoursBefore);
    }
    if (dto.processingFee?.type === "percent" && dto.processingFee.value > 100)
      throw new BadRequestException(
        "A percentage processing fee cannot exceed 100 percent",
      );
    // GST is only reclaimable alongside the fee it was charged on.
    if (dto.refundGst === true && dto.refundPlatformFee === false)
      throw new BadRequestException(
        "GST can only be refunded when the platform fee it was charged on is also refunded",
      );
  }

  async create(user: AuthenticatedUser, dto: Record<string, any>): Promise<any> {
    this.validate(dto);
    const policy = await this.policies.create({
      ...dto,
      createdBy: user.id,
      updatedBy: user.id,
    });
    await this.audit.create({
      policyId: policy._id,
      action: "REFUND_POLICY_CREATED",
      actorId: user.id,
      actorRole: user.role,
      after: policy.toObject(),
    });
    return policy;
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: Record<string, any>,
  ): Promise<any> {
    this.validate(dto);
    const before = await this.policies.findOne({ _id: id, isDeleted: false }).lean();
    if (!before) throw new NotFoundException("Refund policy not found");
    const after = await this.policies.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { ...dto, updatedBy: user.id } },
      { new: true },
    );
    await this.audit.create({
      policyId: id,
      action: "REFUND_POLICY_UPDATED",
      actorId: user.id,
      actorRole: user.role,
      before,
      after: after?.toObject(),
    });
    return after;
  }

  /**
   * Soft delete only. Settled refunds reference the policy that produced them,
   * and an operator must still be able to see which rules were applied.
   */
  async remove(user: AuthenticatedUser, id: string): Promise<any> {
    const policy = await this.policies.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), isActive: false } },
      { new: true },
    );
    if (!policy) throw new NotFoundException("Refund policy not found");
    await this.audit.create({
      policyId: id,
      action: "REFUND_POLICY_DELETED",
      actorId: user.id,
      actorRole: user.role,
      before: policy.toObject(),
    });
    return { success: true };
  }

  /**
   * Price a hypothetical refund without creating one, so an operator can see
   * what a policy change would do before saving it.
   */
  preview(dto: Record<string, any>): RefundPolicyInput {
    this.validate(dto);
    return dto as RefundPolicyInput;
  }
}
