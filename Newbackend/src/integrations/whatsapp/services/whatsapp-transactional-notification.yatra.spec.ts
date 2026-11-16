import { parseTestRecipients } from "../utils/whatsapp-test-recipients.util";
import { WhatsAppTransactionalNotificationService } from "./whatsapp-transactional-notification.service";

const templatesStub = () => ({
  send: jest.fn().mockResolvedValue({ status: "accepted", provider: "ak_nexus" }),
});

const config = (testMode: boolean, recipients: string) =>
  ({ testMode, testRecipients: parseTestRecipients(recipients) }) as never;

const context = {
  guestName: "Asha Verma",
  reference: "YTR-1001",
  ticketCode: "K7M2QX",
  tourTitle: "Char Dham Yatra",
  departAt: "2026-12-01T01:30:00.000Z",
  seats: ["12", "13"],
  boardingName: "Kashmere Gate",
  amountPaid: 3015,
  currency: "INR",
  appUrl: "https://play.google.com/store/apps/details?id=com.tirvona.app",
};

describe("WhatsAppTransactionalNotificationService Yatra ticket", () => {
  it("sends the full ticket text, and the fields an approved Meta template fills", async () => {
    const templates = templatesStub();
    const service = new WhatsAppTransactionalNotificationService(templates as never);

    await expect(
      service.sendYatraTicket({ phone: "+919876543210", bookingId: "b1", context }),
    ).resolves.toMatchObject({ status: "accepted" });

    expect(templates.send).toHaveBeenCalledTimes(1);
    const sent = templates.send.mock.calls[0][0];
    expect(sent).toMatchObject({
      to: "+919876543210",
      templateKey: "booking_confirmation",
      metaEvent: "yatra_confirmed",
      idempotencyKey: "yatra:b1:confirmed:whatsapp",
      correlationId: "yatra:b1:confirmed",
    });
    expect(sent.variables).toMatchObject({
      customer_name: "Asha Verma",
      service_name: "Char Dham Yatra",
      reference: "YTR-1001",
      seats: "12, 13",
      boarding_point: "Kashmere Gate",
      amount_paid: "₹3,015",
      entry_code: "K7M2QX",
      booking_type: "Yatra ticket",
    });
    // The text providers send this body as it is.
    expect(sent.variables.message).toContain("*Seat no.:* 12, 13");
    expect(sent.variables.message).toContain("com.tirvona.app");
  });

  it("passes the rules and the refund policy to a template as one line each, never with a line break", async () => {
    const templates = templatesStub();
    const service = new WhatsAppTransactionalNotificationService(templates as never);
    await service.sendYatraTicket({
      phone: "+919876543210",
      bookingId: "b4",
      context: {
        ...context,
        ruleLines: ["Alcohol policy: Not allowed.\nThe organiser may ask you to leave.", "Luggage policy: Reasonable luggage is free."],
        refundLines: ["3 days or more before departure: 90% of the fare refunded", "Refunds are credited to your Tirvona Wallet."],
      },
    });
    const { variables } = templates.send.mock.calls[0][0];
    expect(variables.rules_summary).toBe(
      "Alcohol policy: Not allowed. The organiser may ask you to leave. • Luggage policy: Reasonable luggage is free.",
    );
    expect(variables.refund_summary).toBe(
      "3 days or more before departure: 90% of the fare refunded • Refunds are credited to your Tirvona Wallet.",
    );
    for (const value of [variables.rules_summary, variables.refund_summary]) expect(value).not.toMatch(/[\n\t]/);
  });

  it("shortens a very long policy so a template value stays within bounds", async () => {
    const templates = templatesStub();
    const service = new WhatsAppTransactionalNotificationService(templates as never);
    await service.sendYatraTicket({
      phone: "+919876543210",
      bookingId: "b5",
      context: { ...context, ruleLines: ["x".repeat(900)], refundLines: ["y".repeat(900)] },
    });
    const { variables } = templates.send.mock.calls[0][0];
    expect(variables.rules_summary).toHaveLength(500);
    expect(variables.rules_summary.endsWith("…")).toBe(true);
    expect(variables.refund_summary).toHaveLength(600);
    expect(variables.refund_summary.endsWith("…")).toBe(true);
  });

  it("uses a different idempotency key for every booking, so two tickets never collide", async () => {
    const templates = templatesStub();
    const service = new WhatsAppTransactionalNotificationService(templates as never);
    await service.sendYatraTicket({ phone: "+919876543210", bookingId: "b1", context });
    await service.sendYatraTicket({ phone: "+919876543210", bookingId: "b2", context });
    expect(templates.send.mock.calls.map((call) => call[0].idempotencyKey)).toEqual([
      "yatra:b1:confirmed:whatsapp",
      "yatra:b2:confirmed:whatsapp",
    ]);
  });

  it("leaves out fields it does not have instead of sending blanks", async () => {
    const templates = templatesStub();
    const service = new WhatsAppTransactionalNotificationService(templates as never);
    await service.sendYatraTicket({ phone: "+919876543210", bookingId: "b3", context: { reference: "YTR-2" } });
    const { variables } = templates.send.mock.calls[0][0];
    expect(variables).toMatchObject({ reference: "YTR-2" });
    expect(variables).not.toHaveProperty("seats");
    expect(variables).not.toHaveProperty("amount_paid");
    expect(variables.message).not.toContain("undefined");
  });

  describe("in WhatsApp test mode", () => {
    it("reaches an allow-listed number", async () => {
      const templates = templatesStub();
      const service = new WhatsAppTransactionalNotificationService(templates as never, config(true, "919936968762"));
      await expect(
        service.sendYatraTicket({ phone: "+919936968762", bookingId: "b1", context }),
      ).resolves.toMatchObject({ status: "accepted" });
      expect(templates.send).toHaveBeenCalledTimes(1);
    });

    it("never reaches a real customer who is not on the list", async () => {
      const templates = templatesStub();
      const service = new WhatsAppTransactionalNotificationService(templates as never, config(true, "919936968762"));
      await expect(
        service.sendYatraTicket({ phone: "+919876543210", bookingId: "b1", context }),
      ).resolves.toEqual({ status: "skipped", provider: "none", reason: "test_mode_recipient_not_allowed" });
      expect(templates.send).not.toHaveBeenCalled();
    });
  });
});
