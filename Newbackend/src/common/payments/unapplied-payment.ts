import { ConflictException } from "@nestjs/common";

/**
 * Money that reached Tirvona for a booking that could not use it — the hold
 * ran out and the room or seat went to someone else, the booking was
 * cancelled, or it had already been paid another way.
 *
 * Such a payment is never left captured and forgotten: the booking module
 * hands it back (to the pilgrim's Tirvona wallet, or into the finance refund
 * queue for a guest without a wallet) and stamps the payment row's
 * `failureReason` with this prefix. A retried checkout callback or webhook
 * then recognises the payment as already handled instead of refunding twice.
 */
export const UNAPPLIED_PAYMENT_PREFIX = "UNAPPLIED_PAYMENT: ";

export const unappliedReason = (reason: string): string =>
  `${UNAPPLIED_PAYMENT_PREFIX}${reason}`;

export const isUnappliedPayment = (
  payment: { failureReason?: unknown } | null | undefined,
): boolean =>
  typeof payment?.failureReason === "string" &&
  payment.failureReason.startsWith(UNAPPLIED_PAYMENT_PREFIX);

/** Why a verified payment could not be applied, in words a pilgrim understands. */
export const UNAPPLIED_REASONS = {
  cancelled: "This booking was cancelled before your payment reached us",
  alreadyPaid: "This booking was already paid",
  superseded: "This payment was for an older checkout of this booking",
  roomTaken:
    "Your hold ran out before the payment finished and the room was booked by someone else",
  seatsTaken:
    "Your hold ran out before the payment finished and the passes were booked by someone else",
  bayTaken:
    "Your hold ran out before the payment finished and the parking space was booked by someone else",
  over: "The time for this booking has already passed",
  closed: "This booking can no longer take a payment",
} as const;

/**
 * Thrown to the caller once a verified payment has been refunded instead of
 * applied. It is a ConflictException on purpose: every Razorpay webhook
 * handler already treats a conflict as a finished outcome, so Razorpay stops
 * retrying an event whose money has been dealt with.
 */
export class PaymentRefundedException extends ConflictException {
  constructor(message: string) {
    super({ success: false, message, code: "PAYMENT_REFUNDED" });
  }
}

/**
 * Raised inside a confirmation transaction when the payment turns out to be
 * unusable. Throwing it rolls back everything the attempt touched (inventory,
 * wallet spend); the module then records the refund in a fresh transaction.
 * It never reaches an HTTP response — the module always converts it.
 */
export class UnusablePaymentSignal extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "UnusablePaymentSignal";
  }
}
