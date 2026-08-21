import { NotificationWorker, type NotificationJob } from "./notification.worker";

const notificationModel = (meta: Record<string, unknown> = {}) => ({
  findById: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        bookingId: "booking-1",
        recipientPhone: "919936968762",
        meta,
      }),
    }),
  }),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
});

const userModel = () => ({
  findById: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        name: "Pilgrim",
        email: "pilgrim@example.com",
        phone: "9936968762",
      }),
    }),
  }),
});

const jobData: NotificationJob = {
  domain: "booking",
  notificationId: "notification-1",
  userId: "customer-1",
  bookingId: "booking-1",
  event: "booking_confirmed",
  title: "Booking confirmed",
  message: "Your booking TIR-1001 is confirmed.",
  channel: "in_app",
  phone: "919936968762",
  correlationId: "booking:booking-1:confirmed",
};

const worker = (
  booking: ReturnType<typeof notificationModel>,
  whatsapp: { sendOutboxEvent: jest.Mock },
  gateway: { send: jest.Mock } = { send: jest.fn() },
) =>
  new NotificationWorker(
    booking as never,
    notificationModel() as never,
    notificationModel() as never,
    userModel() as never,
    gateway as never,
    { get: jest.fn() } as never,
    whatsapp as never,
  );

describe("NotificationWorker WhatsApp booking delivery", () => {
  it("dispatches booking_confirmed and durably marks WhatsApp sent", async () => {
    const booking = notificationModel();
    const whatsapp = {
      sendOutboxEvent: jest
        .fn()
        .mockResolvedValue({ status: "accepted", provider: "ak_nexus" }),
    };

    await worker(booking, whatsapp).process({ data: jobData, id: "job-1" } as never);

    expect(whatsapp.sendOutboxEvent).toHaveBeenCalledWith({
      domain: "booking",
      notificationId: "notification-1",
      event: "booking_confirmed",
      phone: "919936968762",
      recipientName: "Pilgrim",
      title: "Booking confirmed",
      message: "Your booking TIR-1001 is confirmed.",
      correlationId: "booking:booking-1:confirmed",
    });
    expect(booking.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "notification-1",
        "meta.whatsappStatus": { $ne: "sent" },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          "meta.whatsappStatus": "sent",
          "meta.whatsappIdempotencyKey":
            "booking:notification-1:whatsapp",
        }),
      }),
    );
  });

  it("does not send a duplicate after an accepted delivery was persisted", async () => {
    const booking = notificationModel({ whatsappStatus: "sent" });
    const whatsapp = { sendOutboxEvent: jest.fn() };

    await worker(booking, whatsapp).process({ data: jobData, id: "job-1" } as never);

    expect(whatsapp.sendOutboxEvent).not.toHaveBeenCalled();
  });

  it("runs a recovery job through WhatsApp without repeating the socket channel", async () => {
    const booking = notificationModel();
    const whatsapp = {
      sendOutboxEvent: jest
        .fn()
        .mockResolvedValue({ status: "accepted", provider: "ak_nexus" }),
    };
    const gateway = { send: jest.fn() };

    await worker(booking, whatsapp, gateway).process({
      data: { ...jobData, deliveryScope: "whatsapp_only" },
      id: "booking-notification-1-whatsapp-recovery-v1",
    } as never);

    expect(gateway.send).not.toHaveBeenCalled();
    expect(whatsapp.sendOutboxEvent).toHaveBeenCalledTimes(1);
  });

  it("records provider failure for retry without touching booking state", async () => {
    const booking = notificationModel();
    const whatsapp = {
      sendOutboxEvent: jest.fn().mockRejectedValue(new Error("provider failed")),
    };

    await expect(
      worker(booking, whatsapp).process({ data: jobData, id: "job-1" } as never),
    ).rejects.toThrow("provider failed");
    expect(booking.updateOne).toHaveBeenCalledWith(
      { _id: "notification-1" },
      expect.objectContaining({
        $set: expect.objectContaining({ "meta.whatsappStatus": "failed" }),
      }),
    );
  });

  it("still dispatches WhatsApp when an earlier socket channel fails", async () => {
    const booking = notificationModel();
    const whatsapp = {
      sendOutboxEvent: jest
        .fn()
        .mockResolvedValue({ status: "accepted", provider: "ak_nexus" }),
    };
    const gateway = {
      send: jest.fn(() => {
        throw new Error("socket failed");
      }),
    };

    await expect(
      worker(booking, whatsapp, gateway).process({
        data: jobData,
        id: "job-1",
      } as never),
    ).rejects.toThrow("socket failed");
    expect(whatsapp.sendOutboxEvent).toHaveBeenCalledTimes(1);
    expect(booking.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "notification-1",
        "meta.whatsappStatus": { $ne: "sent" },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ "meta.whatsappStatus": "sent" }),
      }),
    );
    expect(booking.updateOne).not.toHaveBeenCalledWith(
      { _id: "notification-1" },
      expect.objectContaining({
        $set: expect.objectContaining({ "meta.whatsappStatus": "failed" }),
      }),
    );
  });
});
