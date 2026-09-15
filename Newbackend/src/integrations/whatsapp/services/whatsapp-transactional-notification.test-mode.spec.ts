import type { WhatsAppOutboxNotification } from "../types/whatsapp.types";
import { parseTestRecipients } from "../utils/whatsapp-test-recipients.util";
import { WhatsAppTransactionalNotificationService } from "./whatsapp-transactional-notification.service";

const templatesStub = () => ({
  send: jest
    .fn()
    .mockResolvedValue({ status: "accepted", provider: "meta_cloud" }),
});

const config = (testMode: boolean, recipients: string) =>
  ({ testMode, testRecipients: parseTestRecipients(recipients) }) as never;

const row = (phone: string): WhatsAppOutboxNotification => ({
  domain: "booking",
  notificationId: "notification-1",
  event: "booking_confirmed",
  phone,
  title: "Booking confirmed",
  message: "Your booking TRV-1001 is confirmed.",
  stay: { reference: "TRV-1001", checkInCode: "4829" },
});

describe("WhatsAppTransactionalNotificationService test mode", () => {
  it("sends to an allow-listed recipient", async () => {
    const templates = templatesStub();
    const service = new WhatsAppTransactionalNotificationService(
      templates as never,
      config(true, "919936968762"),
    );
    await expect(
      service.sendOutboxEvent(row("+919936968762")),
    ).resolves.toMatchObject({ status: "accepted" });
    expect(templates.send).toHaveBeenCalledTimes(1);
  });

  it("blocks any other recipient before a provider is reached", async () => {
    const templates = templatesStub();
    const service = new WhatsAppTransactionalNotificationService(
      templates as never,
      config(true, "919936968762"),
    );
    await expect(
      service.sendOutboxEvent(row("+919876543210")),
    ).resolves.toEqual({
      status: "skipped",
      provider: "none",
      reason: "test_mode_recipient_not_allowed",
    });
    expect(templates.send).not.toHaveBeenCalled();
  });

  it("allows any of several allow-listed recipients", async () => {
    const templates = templatesStub();
    const service = new WhatsAppTransactionalNotificationService(
      templates as never,
      config(true, "919811111111, +919936968762"),
    );
    await service.sendOutboxEvent(row("9811111111"));
    await service.sendOutboxEvent(row("919936968762"));
    await service.sendOutboxEvent(row("9822222222"));
    expect(templates.send).toHaveBeenCalledTimes(2);
  });

  it("resumes normal delivery to every customer when test mode is off", async () => {
    const templates = templatesStub();
    const service = new WhatsAppTransactionalNotificationService(
      templates as never,
      config(false, "919936968762"),
    );
    await service.sendOutboxEvent(row("+919876543210"));
    expect(templates.send).toHaveBeenCalledTimes(1);
  });

  it("gates the direct transactional helpers too", async () => {
    const templates = templatesStub();
    const service = new WhatsAppTransactionalNotificationService(
      templates as never,
      config(true, "919936968762"),
    );
    await expect(
      service.sendBookingConfirmation({
        phone: "+919876543210",
        idempotencyKey: "direct:1",
      }),
    ).resolves.toMatchObject({ reason: "test_mode_recipient_not_allowed" });
    expect(templates.send).not.toHaveBeenCalled();
  });

  it("keeps payment_failed suppressed even for an allow-listed recipient", async () => {
    const templates = templatesStub();
    const service = new WhatsAppTransactionalNotificationService(
      templates as never,
      config(true, "919936968762"),
    );
    await expect(
      service.sendOutboxEvent({
        ...row("+919936968762"),
        event: "payment_failed",
      }),
    ).resolves.toMatchObject({ reason: "payment_failure_unverified" });
    expect(templates.send).not.toHaveBeenCalled();
  });
});
