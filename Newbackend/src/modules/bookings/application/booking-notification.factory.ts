import { normalizeWhatsAppNumber } from "../../../integrations/whatsapp/utils/whatsapp-phone.util";

interface BookingConfirmedNotificationInput {
  /**
   * The website account the confirmation belongs to, when there is one. A
   * WhatsApp guest has no account, so this is null for them and
   * `whatsappCustomerId` identifies the recipient instead. Exactly one of the
   * two is set, matching the booking.
   */
  userId: string | null;
  whatsappCustomerId?: string | null;
  customerPhone?: string;
  booking: {
    _id: unknown;
    ashramId: unknown;
    bookingId: string;
    status: string;
    paymentStatus: string;
    gatewayStatus: string;
  };
  payment: { _id: unknown; status: string };
}

export const bookingConfirmedOutboxEvent = (
  input: BookingConfirmedNotificationInput,
) => {
  if (
    input.booking.status !== "confirmed" ||
    input.booking.paymentStatus !== "fully_paid" ||
    input.booking.gatewayStatus !== "success" ||
    input.payment.status !== "success"
  )
    throw new Error(
      "booking_confirmed cannot be emitted before successful confirmation",
    );

  if (!input.userId && !input.whatsappCustomerId)
    throw new Error(
      "booking_confirmed needs a customer identity to be delivered to",
    );

  const correlationId = `booking:${String(input.booking._id)}:confirmed`;
  return {
    userId: input.userId,
    // Only carried for a WhatsApp guest, so a website booking's outbox row is
    // byte-for-byte what it has always been.
    ...(input.whatsappCustomerId
      ? { whatsappCustomerId: input.whatsappCustomerId }
      : {}),
    bookingId: input.booking._id,
    ashramId: input.booking.ashramId,
    event: "booking_confirmed",
    title: "Booking confirmed",
    message: `Your booking ${input.booking.bookingId} is confirmed.`,
    recipientPhone: input.customerPhone
      ? normalizeWhatsAppNumber(input.customerPhone)
      : undefined,
    pushEnabled: true,
    data: { ashramId: String(input.booking.ashramId) },
    meta: {
      correlationId,
      paymentId: String(input.payment._id),
      paymentStatus: "success",
    },
  } as const;
};
