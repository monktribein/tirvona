import {
  WhatsAppDeliveryUnconfirmedError,
  WhatsAppIntegrationError,
} from "../../integrations/whatsapp/errors/whatsapp.errors";
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

const notificationModel = (row: Record<string, unknown> = {}) => ({
  findById: jest.fn(() =>
    lookupChain({
      bookingId: "booking-1",
      recipientPhone: "919936968762",
      meta: {},
      ...row,
    }),
  ),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
});

const userModel = (
  user: Record<string, unknown> = {
    name: "Pilgrim",
    email: "pilgrim@example.com",
    phone: "9936968762",
  },
) => ({ findById: jest.fn(() => lookupChain(user)) });

const emptyById = () => ({ findById: jest.fn(() => lookupChain(null)) });
const emptyOne = () => ({ findOne: jest.fn(() => lookupChain(null)) });

const worker = (harness: {
  whatsapp: { sendOutboxEvent: jest.Mock };
  booking?: ReturnType<typeof notificationModel>;
  parking?: ReturnType<typeof notificationModel>;
  users?: ReturnType<typeof userModel>;
  parkingBookings?: unknown;
  parkingQrCodes?: unknown;
}) =>
  new NotificationWorker(
    (harness.booking ?? notificationModel()) as never,
    (harness.parking ?? notificationModel()) as never,
    notificationModel() as never,
    (harness.users ?? userModel()) as never,
    emptyById() as never,
    (harness.parkingBookings ?? emptyById()) as never,
    (harness.parkingQrCodes ?? emptyOne()) as never,
    notificationModel() as never,
    emptyById() as never,
    emptyOne() as never,
    notificationModel() as never,
    emptyById() as never,
    emptyOne() as never,
    { send: jest.fn() } as never,
    { sendToUser: jest.fn() } as never,
    { get: jest.fn() } as never,
    harness.whatsapp as never,
  );

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

describe("NotificationWorker transactional WhatsApp delivery", () => {
  it("records an unconfirmed Meta send without failing or retrying the job", async () => {
    const booking = notificationModel();
    const whatsapp = {
      sendOutboxEvent: jest
        .fn()
        .mockRejectedValue(new WhatsAppDeliveryUnconfirmedError("meta_cloud")),
    };

    await expect(
      worker({ booking, whatsapp }).process({
        data: jobData,
        id: "job-1",
      } as never),
    ).resolves.toBeUndefined();

    expect(booking.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "notification-1",
        "meta.whatsappStatus": { $ne: "sent" },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          "meta.whatsappStatus": "unconfirmed",
          "meta.whatsappReason": "provider_response_unconfirmed",
        }),
      }),
    );
    expect(booking.updateOne).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ status: "failed" }),
      }),
    );
    expect(booking.updateOne).toHaveBeenCalledWith(
      { _id: "notification-1" },
      expect.objectContaining({
        $set: expect.objectContaining({ status: "sent" }),
      }),
    );
  });

  it("never resends a row whose earlier send is unconfirmed", async () => {
    const booking = notificationModel({
      meta: { whatsappStatus: "unconfirmed" },
    });
    const whatsapp = { sendOutboxEvent: jest.fn() };

    await worker({ booking, whatsapp }).process({
      data: jobData,
      id: "job-1",
    } as never);

    expect(whatsapp.sendOutboxEvent).not.toHaveBeenCalled();
  });

  it("rethrows a definite provider failure so BullMQ retries the job", async () => {
    const booking = notificationModel();
    const whatsapp = {
      sendOutboxEvent: jest
        .fn()
        .mockRejectedValue(
          new WhatsAppIntegrationError(
            "Meta WhatsApp is temporarily unavailable",
            "PROVIDER_UNAVAILABLE",
            true,
            503,
          ),
        ),
    };

    await expect(
      worker({ booking, whatsapp }).process({
        data: jobData,
        id: "job-1",
      } as never),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(booking.updateOne).toHaveBeenCalledWith(
      { _id: "notification-1" },
      expect.objectContaining({
        $set: expect.objectContaining({ "meta.whatsappStatus": "failed" }),
      }),
    );
  });

  it("skips WhatsApp and records why when no recipient phone exists", async () => {
    const booking = notificationModel({ recipientPhone: "" });
    const whatsapp = { sendOutboxEvent: jest.fn() };
    const { phone: _omit, ...withoutPhone } = jobData;
    void _omit;

    await worker({
      booking,
      whatsapp,
      users: userModel({ name: "Pilgrim", phone: "" }),
    }).process({ data: withoutPhone, id: "job-1" } as never);

    expect(whatsapp.sendOutboxEvent).not.toHaveBeenCalled();
    expect(booking.updateOne).toHaveBeenCalledWith(
      { _id: "notification-1" },
      expect.objectContaining({
        $set: expect.objectContaining({
          "meta.whatsappStatus": "skipped",
          "meta.whatsappReason": "recipient_phone_missing",
        }),
      }),
    );
  });

  it("addresses parking to the driver's phone rather than the account phone", async () => {
    const parking = notificationModel({
      bookingId: "parking-booking-1",
      recipientPhone: "",
    });
    const whatsapp = {
      sendOutboxEvent: jest
        .fn()
        .mockResolvedValue({ status: "accepted", provider: "meta_cloud" }),
    };
    const parkingBookings = {
      findById: jest.fn(() =>
        lookupChain({
          _id: "parking-booking-1",
          bookingReference: "PRK-1",
          driverPhone: "9811111111",
          vehicleNumber: "UP32AB1234",
          pricing: { amountPaid: 50, currency: "INR" },
          locationId: { name: "North Gate" },
        }),
      ),
    };
    const parkingQrCodes = {
      findOne: jest.fn(() => lookupChain({ displayCode: "GATE-7" })),
    };
    const { phone: _omit, ...parkingJob } = {
      ...jobData,
      domain: "parking" as const,
      bookingId: "parking-booking-1",
    };
    void _omit;

    await worker({
      parking,
      whatsapp,
      parkingBookings,
      parkingQrCodes,
    }).process({ data: parkingJob, id: "job-1" } as never);

    expect(whatsapp.sendOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "9811111111",
        parking: expect.objectContaining({
          driverPhone: "9811111111",
          displayCode: "GATE-7",
        }),
      }),
    );
  });

  it("passes the row's stored data and the time the transition happened", async () => {
    const createdAt = new Date("2026-01-05T10:01:00.000Z");
    const booking = notificationModel({ createdAt });
    const whatsapp = {
      sendOutboxEvent: jest
        .fn()
        .mockResolvedValue({ status: "accepted", provider: "meta_cloud" }),
    };

    await worker({ booking, whatsapp }).process({
      data: {
        ...jobData,
        event: "booking_cancelled",
        data: { refundAmount: "1200" },
      },
      id: "job-1",
    } as never);

    expect(whatsapp.sendOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "booking_cancelled",
        data: { refundAmount: "1200" },
        occurredAt: createdAt,
      }),
    );
  });
});
