import { bookingConfirmedOutboxEvent } from "./booking-notification.factory";

describe("bookingConfirmedOutboxEvent", () => {
  const input = {
    userId: "customer-1",
    customerPhone: "+91 99369 68762",
    booking: {
      _id: "booking-1",
      ashramId: "ashram-1",
      bookingId: "TIR-1001",
      status: "confirmed",
      paymentStatus: "fully_paid",
      gatewayStatus: "success",
    },
    payment: { _id: "payment-1", status: "success" },
  };

  it("creates the persisted booking_confirmed payload with normalized phone", () => {
    expect(bookingConfirmedOutboxEvent(input)).toEqual({
      userId: "customer-1",
      bookingId: "booking-1",
      ashramId: "ashram-1",
      event: "booking_confirmed",
      title: "Booking confirmed",
      message: "Your booking TIR-1001 is confirmed.",
      recipientPhone: "919936968762",
      meta: {
        correlationId: "booking:booking-1:confirmed",
        paymentId: "payment-1",
        paymentStatus: "success",
      },
    });
  });

  it.each([
    ["pending", "fully_paid", "success", "success"],
    ["confirmed", "pending", "success", "success"],
    ["confirmed", "fully_paid", "pending", "success"],
    ["confirmed", "fully_paid", "success", "failed"],
  ])(
    "refuses emission before booking/payment success",
    (status, paymentStatus, gatewayStatus, providerPaymentStatus) => {
      expect(() =>
        bookingConfirmedOutboxEvent({
          ...input,
          booking: {
            ...input.booking,
            status,
            paymentStatus,
            gatewayStatus,
          },
          payment: { ...input.payment, status: providerPaymentStatus },
        }),
      ).toThrow(/cannot be emitted/i);
    },
  );
});
