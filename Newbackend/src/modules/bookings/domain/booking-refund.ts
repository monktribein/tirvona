/**
 * The one place a stay cancellation's refund is decided.
 *
 * `BookingsService.cancel` applies this decision, and everything that only
 * needs to *tell* someone what a cancellation would refund — the WhatsApp
 * preview, a future website preview — calls the same function. Two copies of
 * this arithmetic is how a quoted refund and a paid refund drift apart, so
 * there is deliberately only one.
 *
 * Pure: it reads nothing and writes nothing. The caller loads the policy and
 * the booking.
 */

export interface CancellationPolicyRules {
  cancellationFreeHours?: number | null;
  refundBeforeWindowPercent?: number | null;
  refundInsideWindowPercent?: number | null;
}

/** What applies when no policy record exists for the ashram or the platform. */
export const DEFAULT_CANCELLATION_POLICY: Required<CancellationPolicyRules> = {
  cancellationFreeHours: 24,
  refundBeforeWindowPercent: 100,
  refundInsideWindowPercent: 0,
};

export interface CancellationRefundDecision {
  /** Percentage of `amountPaid` returned. */
  refundPercent: number;
  /** Rupees returned. Zero unless the booking is fully paid. */
  refundAmount: number;
  /** Hours from now until check-in; negative once check-in has passed. */
  hoursBefore: number;
  freeCancellationHours: number;
  /** True when a host or admin cancels, which always refunds in full. */
  hostOrAdminCancel: boolean;
  /** The rules that produced this decision, kept on the refund row. */
  policySnapshot: Record<string, unknown>;
}

export const computeCancellationRefund = (input: {
  policy?: (CancellationPolicyRules & Record<string, unknown>) | null;
  booking: {
    checkInDate: Date | string;
    paymentStatus?: string;
    pricing?: { amountPaid?: number };
  };
  /** True when the guest's own booking is being cancelled by someone else. */
  hostOrAdminCancel: boolean;
  now?: Date;
}): CancellationRefundDecision => {
  const { policy, booking, hostOrAdminCancel } = input;
  const now = input.now ?? new Date();
  const freeCancellationHours = Number(
    policy?.cancellationFreeHours ??
      DEFAULT_CANCELLATION_POLICY.cancellationFreeHours,
  );
  const hoursBefore =
    (new Date(booking.checkInDate).getTime() - now.getTime()) / 3_600_000;
  const refundPercent = hostOrAdminCancel
    ? 100
    : hoursBefore >= freeCancellationHours
      ? Number(
          policy?.refundBeforeWindowPercent ??
            DEFAULT_CANCELLATION_POLICY.refundBeforeWindowPercent,
        )
      : Number(
          policy?.refundInsideWindowPercent ??
            DEFAULT_CANCELLATION_POLICY.refundInsideWindowPercent,
        );
  const refundAmount =
    booking.paymentStatus === "fully_paid"
      ? Math.round(Number(booking.pricing?.amountPaid ?? 0) * refundPercent) /
        100
      : 0;
  return {
    refundPercent,
    refundAmount,
    hoursBefore,
    freeCancellationHours,
    hostOrAdminCancel,
    policySnapshot: (policy as Record<string, unknown> | null | undefined) ?? {
      ...DEFAULT_CANCELLATION_POLICY,
    },
  };
};
