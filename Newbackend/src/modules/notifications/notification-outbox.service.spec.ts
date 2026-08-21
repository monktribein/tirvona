import { NotificationOutboxService } from "./notification-outbox.service";

const model = (rows: unknown[], recoveryRows: unknown[] = []) => ({
  find: jest.fn().mockImplementation((filter: { status?: string }) => ({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue(filter.status === "sent" ? recoveryRows : rows),
      }),
    }),
  })),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  collection: { collectionName: "test_notifications" },
});

const schedulerRegistry = {
  doesExist: jest.fn().mockReturnValue(true),
};

describe("NotificationOutboxService", () => {
  it("enqueues the persisted booking event with phone and correlation payload", async () => {
    const booking = model([
      {
        _id: "notification-1",
        userId: "customer-1",
        bookingId: "booking-1",
        event: "booking_confirmed",
        title: "Booking confirmed",
        message: "Your booking TIR-1001 is confirmed.",
        channel: "in_app",
        recipientPhone: "919936968762",
        meta: { correlationId: "booking:booking-1:confirmed" },
      },
    ]);
    const empty = model([]);
    const queue = {
      getJob: jest.fn().mockResolvedValue(null),
      add: jest.fn().mockResolvedValue({ id: "job" }),
    };
    const service = new NotificationOutboxService(
      queue as never,
      booking as never,
      empty as never,
      empty as never,
      schedulerRegistry as never,
    );

    await service.dispatch();

    expect(queue.add).toHaveBeenCalledWith(
      "deliver",
      expect.objectContaining({
        domain: "booking",
        event: "booking_confirmed",
        bookingId: "booking-1",
        phone: "919936968762",
        correlationId: "booking:booking-1:confirmed",
      }),
      expect.objectContaining({ jobId: "booking-notification-1" }),
    );
    expect(booking.updateOne).toHaveBeenCalledWith(
      { _id: "notification-1", status: "queued" },
      { $set: { "meta.queueJobId": "booking-notification-1" } },
    );
  });

  it("does not duplicate an existing deterministic BullMQ job", async () => {
    const booking = model([
      {
        _id: "notification-1",
        userId: "customer-1",
        event: "booking_confirmed",
        title: "Booking confirmed",
        message: "Confirmed",
        channel: "in_app",
        meta: { queueJobId: "booking-notification-1" },
      },
    ]);
    const empty = model([]);
    const queue = {
      getJob: jest.fn().mockResolvedValue({ id: "booking-notification-1" }),
      add: jest.fn(),
    };
    const service = new NotificationOutboxService(
      queue as never,
      booking as never,
      empty as never,
      empty as never,
      schedulerRegistry as never,
    );

    await service.dispatch();

    expect(queue.getJob).toHaveBeenCalledWith("booking-notification-1");
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("re-enqueues a recent sent booking as WhatsApp-only recovery", async () => {
    const booking = model([], [
      {
        _id: "notification-1",
        userId: "customer-1",
        bookingId: "booking-1",
        event: "booking_confirmed",
        title: "Booking confirmed",
        message: "Your booking is confirmed.",
        channel: "in_app",
        recipientPhone: "919936968762",
        meta: { correlationId: "booking:booking-1:confirmed" },
      },
    ]);
    const empty = model([]);
    const queue = {
      getJob: jest.fn().mockResolvedValue(null),
      add: jest.fn().mockResolvedValue({ id: "job" }),
    };
    const service = new NotificationOutboxService(
      queue as never,
      booking as never,
      empty as never,
      empty as never,
      schedulerRegistry as never,
    );

    await service.dispatch();

    expect(queue.add).toHaveBeenCalledWith(
      "deliver",
      expect.objectContaining({
        domain: "booking",
        event: "booking_confirmed",
        deliveryScope: "whatsapp_only",
      }),
      expect.objectContaining({
        jobId: "booking-notification-1-whatsapp-recovery-v1",
      }),
    );
  });
});
