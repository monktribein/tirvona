import { WhatsAppTransactionalNotificationService } from "./whatsapp-transactional-notification.service";

describe("WhatsAppTransactionalNotificationService", () => {
  it("maps existing booking outbox events without provider-specific fields", async () => {
    const templates = {
      send: jest.fn().mockResolvedValue({ status: "accepted" }),
    };
    const service = new WhatsAppTransactionalNotificationService(
      templates as never,
    );

    await service.sendOutboxEvent({
      domain: "booking",
      notificationId: "notification-1",
      event: "booking_confirmed",
      phone: "+919876543210",
      recipientName: "Pilgrim",
      title: "Booking confirmed",
      message: "Your booking is confirmed.",
    });

    expect(templates.send).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "booking_confirmation",
        idempotencyKey: "booking:notification-1:whatsapp",
      }),
    );
  });

  it("delivers outbox events that have no dedicated template", async () => {
    const templates = { send: jest.fn().mockResolvedValue({ status: "accepted" }) };
    const service = new WhatsAppTransactionalNotificationService(
      templates as never,
    );
    await service.sendOutboxEvent({
      domain: "community",
      notificationId: "notification-2",
      event: "article_liked",
      phone: "+919876543210",
      title: "Article liked",
      message: "Someone liked your article.",
    });
    expect(templates.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+919876543210",
        templateKey: "general_notification",
        idempotencyKey: "community:notification-2:whatsapp",
      }),
    );
  });

  it("exposes all requested transactional message methods", async () => {
    const templates = {
      send: jest.fn().mockResolvedValue({ status: "accepted" }),
    };
    const service = new WhatsAppTransactionalNotificationService(
      templates as never,
    );
    const input = {
      phone: "+919876543210",
      idempotencyKey: "transaction:1",
    };
    await service.sendBookingConfirmation(input);
    await service.sendPaymentSuccess(input);
    await service.sendPaymentFailure(input);
    await service.sendCancellation(input);
    await service.sendRefund(input);
    await service.sendCheckinReminder(input);
    expect(templates.send).toHaveBeenCalledTimes(6);
  });
});

