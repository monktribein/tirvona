import { NotificationWorker, type NotificationJob } from "./notification.worker";

const lookupChain = (row: unknown) => {
  const chain: any = {
    select: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    populate: jest.fn(() => chain),
    lean: jest.fn().mockResolvedValue(row),
  };
  return chain;
};

const notificationModel = () => ({
  findById: jest.fn(() =>
    lookupChain({
      bookingId: "booking-1",
      recipientPhone: "919876543210",
      meta: {},
    }),
  ),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
});

const emptyById = () => ({ findById: jest.fn(() => lookupChain(null)) });
const emptyOne = () => ({ findOne: jest.fn(() => lookupChain(null)) });

const jobData: NotificationJob = {
  domain: "booking",
  notificationId: "notification-1",
  userId: "customer-1",
  bookingId: "booking-1",
  event: "booking_confirmed",
  title: "Booking confirmed",
  message: "Your booking TIR-1001 is confirmed.",
  channel: "in_app",
  phone: "919876543210",
  correlationId: "booking:booking-1:confirmed",
};

describe("NotificationWorker with a WhatsApp test-mode block", () => {
  it("records the block and still delivers the other channels", async () => {
    const booking = notificationModel();
    const gateway = { send: jest.fn() };
    const whatsapp = {
      sendOutboxEvent: jest.fn().mockResolvedValue({
        status: "skipped",
        provider: "none",
        reason: "test_mode_recipient_not_allowed",
      }),
    };
    const worker = new NotificationWorker(
      booking as never,
      notificationModel() as never,
      notificationModel() as never,
      {
        findById: jest.fn(() =>
          lookupChain({ name: "Pilgrim", phone: "9876543210" }),
        ),
      } as never,
      emptyById() as never,
      emptyById() as never,
      emptyOne() as never,
      notificationModel() as never,
      emptyById() as never,
      emptyOne() as never,
      notificationModel() as never,
      emptyById() as never,
      emptyOne() as never,
      gateway as never,
      { sendToUser: jest.fn() } as never,
      { get: jest.fn() } as never,
      whatsapp as never,
    );

    await expect(
      worker.process({ data: jobData, id: "job-1" } as never),
    ).resolves.toBeUndefined();

    // In-app socket delivery is unaffected by WhatsApp test mode.
    expect(gateway.send).toHaveBeenCalledTimes(1);
    expect(booking.updateOne).toHaveBeenCalledWith(
      { _id: "notification-1" },
      expect.objectContaining({
        $set: expect.objectContaining({
          "meta.whatsappStatus": "skipped",
          "meta.whatsappReason": "test_mode_recipient_not_allowed",
        }),
      }),
    );
    // The row completes normally; a block is not a failure and is not retried.
    expect(booking.updateOne).toHaveBeenCalledWith(
      { _id: "notification-1" },
      expect.objectContaining({
        $set: expect.objectContaining({ status: "sent" }),
      }),
    );
  });
});
