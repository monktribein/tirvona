import { createHmac } from "node:crypto";
import { RazorpayXPayoutProvider } from "./razorpayx-payout.provider";

describe("RazorpayXPayoutProvider", () => {
  const config = {
    enabled: true,
    baseUrl: "https://api.razorpay.com/v1",
    keyId: "rzp_test_id",
    keySecret: "secret-value",
    sourceAccountNumber: "source-account",
    webhookSecret: "webhook-secret",
    encryptionKey: "",
    timeoutMs: 1000,
    maxAttempts: 1,
  } as never;
  const provider = new RazorpayXPayoutProvider(config);

  afterEach(() => jest.restoreAllMocks());

  it("reports readiness without exposing provider credentials", () => {
    expect(provider.isConfigured()).toBe(true);
    expect(
      new RazorpayXPayoutProvider({
        enabled: false,
        baseUrl: "https://api.razorpay.com/v1",
        keyId: "rzp_test_id",
        keySecret: "secret-value",
        sourceAccountNumber: "source-account",
        webhookSecret: "webhook-secret",
        encryptionKey: "",
        timeoutMs: 1000,
        maxAttempts: 1,
      } as never).isConfigured(),
    ).toBe(false);
  });

  it("uses RazorpayX payout idempotency and the documented payout payload", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "pout_1", status: "initiated" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await provider.createPayout({
      fundAccountId: "fa_1",
      amountPaise: 12500,
      mode: "IMPS",
      referenceId: "PO-TEST",
      idempotencyKey: "5c64042d-e4f2-44d8-9412-278f1e7899ee",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/payouts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-payout-idempotency": "5c64042d-e4f2-44d8-9412-278f1e7899ee",
        }),
      }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual(
      expect.objectContaining({
        account_number: "source-account",
        fund_account_id: "fa_1",
        amount: 12500,
        currency: "INR",
        mode: "IMPS",
        purpose: "payout",
      }),
    );
  });

  it("validates webhook signatures over the raw request body", () => {
    const raw = Buffer.from('{"event":"payout.processed"}');
    const signature = createHmac("sha256", "webhook-secret").update(raw).digest("hex");
    expect(provider.verifyWebhook(raw, signature)).toBe(true);
    expect(provider.verifyWebhook(raw, "0".repeat(64))).toBe(false);
  });
});
