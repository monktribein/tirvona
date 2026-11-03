import { PaymentsWebhookService } from "./payments-webhook.service";

const payload = {
  payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 100 } } },
};

describe("PaymentsWebhookService retries", () => {
  const build = (existingStatus: string) => {
    const row: any = { status: existingStatus, save: jest.fn() };
    const events: any = {
      create: jest.fn().mockRejectedValue({ code: 11000 }),
      findOne: jest.fn().mockResolvedValue(row),
    };
    const bookings: any = { confirmPaymentFromWebhook: jest.fn().mockResolvedValue(true) };
    const none: any = { confirmPaymentFromWebhook: jest.fn().mockResolvedValue(false) };
    const service = new PaymentsWebhookService(
      {} as any, events, bookings, none, none, none, none, none, none,
    );
    return { service, row, bookings };
  };

  it("reprocesses a delivery whose earlier attempt failed", async () => {
    const { service, row, bookings } = build("failed");
    await service.handleEvent("evt_1", "payment.captured", payload);
    expect(bookings.confirmPaymentFromWebhook).toHaveBeenCalled();
    expect(row.status).toBe("processed");
  });

  it("still ignores a duplicate that was already processed", async () => {
    const { service, bookings } = build("processed");
    await service.handleEvent("evt_1", "payment.captured", payload);
    expect(bookings.confirmPaymentFromWebhook).not.toHaveBeenCalled();
  });
});
