import { normalizeWhatsAppNumber } from "../../../integrations/whatsapp/utils/whatsapp-phone.util";

interface BookingConfirmedNotificationInput {
  userId: string;
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

  const correlationId = `booking:${String(input.booking._id)}:confirmed`;
  return {
    userId: input.userId,
    bookingId: input.booking._id,
    ashramId: input.booking.ashramId,
    event: "booking_confirmed",
    title: "Booking confirmed",
    message: `Your booking ${input.booking.bookingId} is confirmed.`,
    recipientPhone: input.customerPhone
      ? normalizeWhatsAppNumber(input.customerPhone)
      : undefined,
    meta: {
      correlationId,
      paymentId: String(input.payment._id),
      paymentStatus: "success",
    },
  } as const;
};
