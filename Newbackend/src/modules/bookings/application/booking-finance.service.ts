import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { TransactionService } from "../../../common/database/transaction.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { canManageAllAshrams, isAshramOwner } from "../../../common/auth/ashram-access";
import { financialReference } from "../domain/booking.utils";
import type {
  CompleteSettlementDto,
  CreateSettlementDto,
  ProcessRefundDto,
} from "../presentation/dtos/booking-finance.dto";

@Injectable()
export class BookingFinanceService {
  constructor(
    private readonly transactions: TransactionService,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("BookingCommission") private readonly commissions: Model<any>,
    @InjectModel("BookingSettlement") private readonly settlements: Model<any>,
    @InjectModel("BookingRefund") private readonly refunds: Model<any>,
    @InjectModel("BookingPayment") private readonly payments: Model<any>,
    @InjectModel("BookingTransaction")
    private readonly financialTransactions: Model<any>,
    @InjectModel("BookingLedger") private readonly ledger: Model<any>,
  ) {}
  private async owner(
    user: AuthenticatedUser,
    requested?: string,
  ): Promise<string | null> {
    if (isAshramOwner(user)) return user.id;
    if (canManageAllAshrams(user))
      return requested ?? null;
    if (["finance_manager", "super_admin"].includes(user.role) && requested)
      return requested;
    throw new ForbiddenException("An owner scope is required");
  }
  private async ashramScope(
    user: AuthenticatedUser,
    requested?: string,
  ): Promise<string[] | null> {
    if (user.role === "finance_manager" || canManageAllAshrams(user))
      return requested ? [requested] : null;
    if (!isAshramOwner(user))
      throw new ForbiddenException("An owner scope is required");
    const owned = (await this.ashrams.distinct("_id", { ownerId: user.id })).map(
      String,
    );
    if (requested && !owned.includes(requested))
      throw new ForbiddenException("You do not manage that ashram");
    return requested ? [requested] : owned;
  }
  async summary(
    user: AuthenticatedUser,
    requested?: string,
    ashramId?: string,
  ): Promise<any> {
    const ownerId = await this.owner(user, requested);
    const scope = await this.ashramScope(user, ashramId);
    const [row] = await this.commissions.aggregate([
      {
        $match: {
          ...(ownerId
            ? {
                ownerId:
                  this.commissions.db.base.Types.ObjectId.createFromHexString(
                    ownerId,
                  ),
              }
            : {}),
          ...(scope === null
            ? {}
            : {
                ashramId: {
                  $in: scope.map((id) =>
                    this.commissions.db.base.Types.ObjectId.createFromHexString(
                      id,
                    ),
                  ),
                },
              }),
        },
      },
      {
        $group: {
          _id: null,
          grossAmount: { $sum: "$grossAmount" },
          commissionAmount: { $sum: "$commissionAmount" },
          ownerEarning: { $sum: "$ownerEarning" },
          pendingEarning: {
            $sum: {
              $cond: [
                { $eq: ["$settlementStatus", "pending"] },
                "$ownerEarning",
                0,
              ],
            },
          },
          settledEarning: {
            $sum: {
              $cond: [
                { $eq: ["$settlementStatus", "settled"] },
                "$ownerEarning",
                0,
              ],
            },
          },
        },
      },
    ]);
    return (
      row ?? {
        grossAmount: 0,
        commissionAmount: 0,
        ownerEarning: 0,
        pendingEarning: 0,
        settledEarning: 0,
      }
    );
  }
  async paymentList(
    user: AuthenticatedUser,
    ashramId?: string,
  ): Promise<any[]> {
    const scope = await this.ashramScope(user, ashramId);
    const rows = await this.payments
      .find(scope === null ? {} : { ashramId: { $in: scope } })
      .populate({
        path: "bookingId",
        select:
          "bookingId reservationNumber customerId status paymentStatus checkInDate checkOutDate pricing",
        populate: { path: "customerId", select: "name email phone" },
      })
      .populate("userId", "name email phone")
      .populate("ashramId", "name ashramCode")
      .select("-gateway.signature -idempotencyKey")
      .sort({ createdAt: -1 })
      .lean();
    return rows.map((payment: any) => ({
      ...payment,
      bookedBy: payment.bookingId?.customerId ?? payment.userId ?? null,
      paidBy: payment.userId ?? payment.bookingId?.customerId ?? null,
    }));
  }
  async list(
    user: AuthenticatedUser,
    requested?: string,
    ashramId?: string,
  ): Promise<any[]> {
    const ownerId = await this.owner(user, requested);
    const scope = await this.ashramScope(user, ashramId);
    return this.settlements
      .find({
        ...(ownerId ? { ownerId } : {}),
        ...(scope === null ? {} : { ashramIds: { $in: scope } }),
      })
      .populate("ashramIds", "name ashramCode")
      .sort({ createdAt: -1 })
      .lean();
  }
  async create(
    user: AuthenticatedUser,
    dto: CreateSettlementDto,
  ): Promise<any> {
    const ownerId = await this.owner(user, dto.ownerId);
    if (!ownerId)
      throw new BadRequestException(
        "Select an ashram owner before creating a settlement",
      );
    return this.transactions.run(async (session) => {
      const filter: any = {
        ownerId,
        settlementStatus: "pending",
        ...(dto.ashramIds?.length ? { ashramId: { $in: dto.ashramIds } } : {}),
      };
      const rows = await this.commissions.find(filter).session(session);
      if (!rows.length)
        throw new BadRequestException(
          "No pending earnings are available for settlement",
        );
      const grossAmount = rows.reduce((n, r) => n + Number(r.grossAmount), 0);
      const commissionAmount = rows.reduce(
        (n, r) => n + Number(r.commissionAmount),
        0,
      );
      const taxAmount = rows.reduce(
        (n, r) => n + Number(r.taxWithheld ?? 0),
        0,
      );
      const [settlement] = await this.settlements.create(
        [
          {
            settlementReference: financialReference("SET"),
            ownerId,
            ashramIds: [...new Set(rows.map((r) => String(r.ashramId)))],
            commissionIds: rows.map((r) => r._id),
            grossAmount,
            commissionAmount,
            taxAmount,
            payoutAmount: grossAmount - commissionAmount - taxAmount,
            status: "processing",
            initiatedBy: user.id,
          },
        ],
        { session },
      );
      await this.commissions.updateMany(
        { _id: { $in: rows.map((r) => r._id) }, settlementStatus: "pending" },
        {
          $set: {
            settlementStatus: "processing",
            settlementId: settlement._id,
          },
        },
        { session },
      );
      return settlement;
    });
  }
  async complete(
    user: AuthenticatedUser,
    id: string,
    dto: CompleteSettlementDto,
  ): Promise<any> {
    if (user.role !== "super_admin")
      throw new ForbiddenException("Only Super Admin can complete settlements");
    return this.transactions.run(async (session) => {
      const row = await this.settlements
        .findOne({ _id: id, status: "processing" })
        .session(session);
      if (!row) throw new NotFoundException("Processing settlement not found");
      row.status = "paid";
      row.payoutReference = dto.payoutReference;
      row.paidAt = new Date();
      await row.save({ session });
      await this.commissions.updateMany(
        { settlementId: row._id, settlementStatus: "processing" },
        { $set: { settlementStatus: "settled" } },
        { session },
      );
      const [transaction] = await this.financialTransactions.create(
        [
          {
            ownerId: row.ownerId,
            type: "settlement",
            direction: "debit",
            amount: row.payoutAmount,
            reference: financialReference("BKTXN"),
            description: `Owner payout ${row.settlementReference}`,
            recordedBy: user.id,
          },
        ],
        { session },
      );
      await this.ledger.create(
        [
          {
            account: `owner:${row.ownerId}`,
            ownerId: row.ownerId,
            transactionId: transaction._id,
            debit: row.payoutAmount,
            credit: 0,
            reference: transaction.reference,
          },
        ],
        { session },
      );
      return row;
    });
  }
  async refundQueue(
    user: AuthenticatedUser,
    ashramId?: string,
  ): Promise<any[]> {
    const filter: any = {};
    if (isAshramOwner(user)) {
      const ids = await this.ashramScope(user, ashramId);
      const bookings = await this.payments
        .find({ ashramId: { $in: ids ?? [] } })
        .select("bookingId")
        .lean();
      filter.bookingId = { $in: bookings.map((x: any) => x.bookingId) };
    } else if (
      !canManageAllAshrams(user) &&
      !["finance_manager", "super_admin", "support"].includes(user.role)
    )
      throw new ForbiddenException("Not authorized for refunds");
    else if (ashramId) {
      const bookings = await this.payments
        .find({ ashramId })
        .select("bookingId")
        .lean();
      filter.bookingId = { $in: bookings.map((x: any) => x.bookingId) };
    }
    return this.refunds
      .find(filter)
      .populate("bookingId paymentId requestedBy")
      .sort({ createdAt: -1 })
      .lean();
  }
  async processRefund(
    user: AuthenticatedUser,
    id: string,
    dto: ProcessRefundDto,
  ): Promise<any> {
    if (!["finance_manager", "super_admin"].includes(user.role))
      throw new ForbiddenException("Not authorized to process refunds");
    return this.transactions.run(async (session) => {
      const refund = await this.refunds
        .findOne({ _id: id, status: { $in: ["pending", "processing"] } })
        .session(session);
      if (!refund) throw new NotFoundException("Pending refund not found");
      refund.status = dto.failureReason ? "failed" : "success";
      refund.failureReason = dto.failureReason;
      refund.gatewayRefundId =
        dto.gatewayRefundId ??
        (dto.failureReason ? undefined : financialReference("GWREF"));
      refund.processedAt = new Date();
      await refund.save({ session });
      if (refund.status === "success") {
        await this.payments.updateOne(
          { _id: refund.paymentId },
          { $set: { status: "refunded" } },
          { session },
        );
        const [transaction] = await this.financialTransactions.create(
          [
            {
              bookingId: refund.bookingId,
              paymentId: refund.paymentId,
              type: "refund",
              direction: "debit",
              amount: refund.amount,
              reference: financialReference("BKTXN"),
              description: `Refund ${refund.refundReference}`,
              recordedBy: user.id,
            },
          ],
          { session },
        );
        await this.ledger.create(
          [
            {
              account: "booking_clearing",
              bookingId: refund.bookingId,
              transactionId: transaction._id,
              debit: refund.amount,
              credit: 0,
              reference: transaction.reference,
            },
          ],
          { session },
        );
      }
      return refund;
    });
  }
}
