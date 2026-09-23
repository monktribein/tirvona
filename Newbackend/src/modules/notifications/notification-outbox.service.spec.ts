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
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  // The claim a poller takes on a row before queueing it. A truthy document
  // means this poller won it; the "another backend got there first" case is
  // exercised by overriding this to resolve null.
  findOneAndUpdate: jest.fn().mockResolvedValue({ _id: "claimed" }),
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
    // The row is claimed in the database, not just in the queue, so a second
    // backend sharing this database cannot enqueue it as well.
    expect(booking.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "notification-1", status: "queued" }),
      expect.objectContaining({
        $set: expect.objectContaining({
          "meta.queueJobId": "booking-notification-1",
        }),
      }),
    );
  });

  it("leaves the row alone when another backend has already claimed it", async () => {
    // Two deployments share this database but have their own queue prefixes,
    // so the BullMQ job id cannot deduplicate across them — losing the claim
    // is the only thing that stops the guest being messaged twice.
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
        meta: {},
      },
    ]);
    booking.findOneAndUpdate.mockResolvedValue(null);
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
      empty as never,
      empty as never,
      schedulerRegistry as never,
    );

    await service.dispatch();

    expect(queue.add).not.toHaveBeenCalled();
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

  it("retires the aarti and event backlog before dispatching either domain", async () => {
    const empty = model([]);
    const aarti = model([]);
    const event = model([]);
    const queue = {
      getJob: jest.fn().mockResolvedValue(null),
      add: jest.fn().mockResolvedValue({ id: "job" }),
    };
    const service = new NotificationOutboxService(
      queue as never,
      empty as never,
      empty as never,
      empty as never,
      aarti as never,
      event as never,
      schedulerRegistry as never,
    );

    await service.dispatch();

    // Booking, parking and community have always been dispatched, so their
    // queue is never retired; only the newly activated domains are.
    expect(empty.updateMany).not.toHaveBeenCalled();
    for (const model_ of [aarti, event]) {
      expect(model_.updateMany).toHaveBeenCalledTimes(1);
      const [filter, update] = model_.updateMany.mock.calls[0];
      expect(filter.status).toBe("queued");
      expect(filter.createdAt.$lt).toBeInstanceOf(Date);
      expect(update.$set.status).toBe("skipped");
      expect(update.$set["meta.whatsappReason"]).toBe(
        "outside_activation_window",
      );
    }
  });

  it("enqueues a recent aarti row for delivery", async () => {
    const empty = model([]);
    const aarti = model([
      {
        _id: "aarti-notification-1",
        userId: "customer-9",
        bookingId: "aarti-booking-1",
        event: "booking_confirmed",
        title: "Aarti Pass Confirmed",
        message: "Your aarti booking AAR-1 is confirmed.",
        channel: "in_app",
        recipientPhone: "919936968762",
        meta: {},
      },
    ]);
    const queue = {
      getJob: jest.fn().mockResolvedValue(null),
      add: jest.fn().mockResolvedValue({ id: "job" }),
    };
    const service = new NotificationOutboxService(
      queue as never,
      empty as never,
      empty as never,
      empty as never,
      aarti as never,
      empty as never,
      schedulerRegistry as never,
    );

    await service.dispatch();

    expect(queue.add).toHaveBeenCalledWith(
      "deliver",
      expect.objectContaining({
        domain: "aarti",
        event: "booking_confirmed",
        phone: "919936968762",
        bookingId: "aarti-booking-1",
      }),
      expect.objectContaining({ jobId: "aarti-aarti-notification-1" }),
    );
  });

  it("enqueues an event registration row using its registration id", async () => {
    const empty = model([]);
    const event = model([
      {
        _id: "event-notification-1",
        userId: "customer-4",
        registrationId: "registration-1",
        event: "registration_confirmed",
        title: "Event Pass Confirmed",
        message: "Your place at Deepotsav is confirmed.",
        channel: "in_app",
        recipientPhone: "919936968762",
        meta: {},
      },
    ]);
    const queue = {
      getJob: jest.fn().mockResolvedValue(null),
      add: jest.fn().mockResolvedValue({ id: "job" }),
    };
    const service = new NotificationOutboxService(
      queue as never,
      empty as never,
      empty as never,
      empty as never,
      empty as never,
      event as never,
      schedulerRegistry as never,
    );

    await service.dispatch();

    expect(queue.add).toHaveBeenCalledWith(
      "deliver",
      expect.objectContaining({
        domain: "event",
        event: "registration_confirmed",
        bookingId: "registration-1",
      }),
      expect.anything(),
    );
  });
});
