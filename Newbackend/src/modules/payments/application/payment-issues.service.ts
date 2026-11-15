import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { UNAPPLIED_PAYMENT_PREFIX } from "../../../common/payments/unapplied-payment";
import { AARTI_MODEL } from "../../aarti/domain/aarti.constants";
import { PARKING_MODEL } from "../../parking/domain/parking.constants";

/** Matches a payment row stamped as "money that could not be used". */
const UNAPPLIED_FILTER = {
  failureReason: { $regex: `^${UNAPPLIED_PAYMENT_PREFIX}` },
};

/** The two Razorpay events that mean money actually moved. */
const MONEY_EVENTS = ["payment.captured", "order.paid"];

export type UnappliedRefundState =
  | "refunded_to_wallet"
  | "gateway_refund_owed"
  | "gateway_refunded";

/**
 * One place for finance to see money that came in but did not become a
 * booking: payments refunded (or still owed a refund) because the booking
 * could not use them, and Razorpay deliveries that failed or that no booking
 * claimed. Nothing here is hidden in logs or the database any more.
 */
@Injectable()
export class PaymentIssuesService {
  constructor(
    @InjectModel("PaymentWebhookEvent") private readonly events: Model<any>,
    @InjectModel("BookingPayment") private readonly stayPayments: Model<any>,
    @InjectModel("Booking") private readonly stays: Model<any>,
    @InjectModel(AARTI_MODEL.Payment) private readonly aartiPayments: Model<any>,
    @InjectModel(AARTI_MODEL.Booking) private readonly aartiBookings: Model<any>,
    @InjectModel(PARKING_MODEL.Payment)
    private readonly parkingPayments: Model<any>,
    @InjectModel(PARKING_MODEL.Booking)
    private readonly parkingBookings: Model<any>,
  ) {}

  async list(limitInput?: number): Promise<any> {
    const limit = Math.min(Math.max(Number(limitInput) || 100, 1), 300);
    const recent = (model: Model<any>) =>
      model.find(UNAPPLIED_FILTER).sort({ updatedAt: -1 }).limit(limit).lean();
    const [stayRows, aartiRows, parkingRows, eventRows] = await Promise.all([
      recent(this.stayPayments),
      recent(this.aartiPayments),
      recent(this.parkingPayments),
      this.events
        .find({
          $or: [
            { status: "failed" },
            { status: "ignored", eventType: { $in: MONEY_EVENTS } },
          ],
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);
    const [stayRefs, aartiRefs, parkingRefs] = await Promise.all([
      this.references(this.stays, stayRows, "bookingId"),
      this.references(this.aartiBookings, aartiRows, "bookingReference"),
      this.references(this.parkingBookings, parkingRows, "bookingReference"),
    ]);

    const unapplied = [
      ...(stayRows as any[]).map((row) => this.unappliedRow("stay", row, stayRefs)),
      ...(aartiRows as any[]).map((row) => this.unappliedRow("aarti", row, aartiRefs)),
      ...(parkingRows as any[]).map((row) =>
        this.unappliedRow("parking", row, parkingRefs),
      ),
    ].sort((a, b) => +new Date(b.updatedAt ?? 0) - +new Date(a.updatedAt ?? 0));

    // Razorpay sends both payment.captured and order.paid for one payment:
    // show each payment once.
    const seen = new Set<string>();
    const webhooks = (eventRows as any[])
      .filter((row) => {
        const key = `${row.paymentId || row.eventId}:${row.status}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((row) => ({
        id: String(row._id),
        eventId: row.eventId,
        eventType: row.eventType,
        orderId: row.orderId ?? null,
        paymentId: row.paymentId ?? null,
        status: row.status,
        kind: row.status === "failed" ? "processing_failed" : "unmatched",
        matchedModule: row.matchedModule ?? null,
        processingError: row.processingError ?? null,
        receivedAt: row.createdAt ?? null,
      }));

    const owed = unapplied.filter((row) => row.refundState === "gateway_refund_owed");
    return {
      summary: {
        refundOwedCount: owed.length,
        refundOwedAmount: owed.reduce((sum, row) => sum + row.amount, 0),
        refundedToWalletCount: unapplied.filter(
          (row) => row.refundState === "refunded_to_wallet",
        ).length,
        webhookFailureCount: webhooks.filter((row) => row.kind === "processing_failed")
          .length,
        unmatchedPaymentCount: webhooks.filter((row) => row.kind === "unmatched").length,
      },
      unapplied,
      webhooks,
    };
  }

  /**
   * Records that finance refunded a WhatsApp guest's unusable parking payment
   * on the Razorpay dashboard. (Stay refunds owed go through the stay finance
   * refund queue; aarti and website customers are refunded to the wallet.)
   */
  async markParkingRefunded(
    user: AuthenticatedUser,
    paymentId: string,
    gatewayRefundId?: string,
  ): Promise<any> {
    if (!/^[0-9a-f]{24}$/i.test(String(paymentId)))
      throw new NotFoundException("No refund is owed on this payment.");
    const row = await this.parkingPayments.findOneAndUpdate(
      { _id: paymentId, status: "failed", ...UNAPPLIED_FILTER },
      {
        $set: {
          status: "refunded",
          "refund.at": new Date(),
          "refund.by": user.id,
          ...(gatewayRefundId ? { "refund.reference": gatewayRefundId.trim() } : {}),
        },
      },
      { new: true },
    );
    if (!row) throw new NotFoundException("No refund is owed on this payment.");
    return { id: String(row._id), status: row.status };
  }

  private async references(
    model: Model<any>,
    rows: any[],
    field: string,
  ): Promise<Map<string, string>> {
    const ids = [...new Set(rows.map((row) => String(row.bookingId)).filter(Boolean))];
    if (!ids.length) return new Map();
    const bookings: any[] = await model
      .find({ _id: { $in: ids } })
      .select(field)
      .lean();
    return new Map(bookings.map((b) => [String(b._id), String(b[field] ?? "")]));
  }

  private unappliedRow(
    module: "stay" | "aarti" | "parking",
    row: any,
    refs: Map<string, string>,
  ): any {
    const isGuest = !row.userId && Boolean(row.whatsappCustomerId);
    const refundState: UnappliedRefundState =
      row.status === "failed"
        ? "gateway_refund_owed"
        : isGuest
          ? "gateway_refunded"
          : "refunded_to_wallet";
    return {
      id: String(row._id),
      module,
      bookingId: row.bookingId ? String(row.bookingId) : null,
      bookingReference: refs.get(String(row.bookingId)) || null,
      amount: Number(row.amount ?? 0),
      reason: String(row.failureReason ?? "").slice(UNAPPLIED_PAYMENT_PREFIX.length),
      refundState,
      customer: isGuest ? "whatsapp" : "website",
      razorpayOrderId: row.gateway?.orderId ?? null,
      razorpayPaymentId: row.gateway?.paymentId ?? row.transactionId ?? null,
      updatedAt: row.updatedAt ?? row.createdAt ?? null,
    };
  }
}
