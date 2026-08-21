import { Logger } from "@nestjs/common";
import type { WhatsAppIntegrationError } from "../../errors/whatsapp.errors";
import { AkNexusWhatsAppClient } from "./ak-nexus-whatsapp.client";

const providerRequest = {
  to: "+919876543210",
  messageType: "auth_otp" as const,
  message: "Your Tirvona verification code is 123456.",
  idempotencyKey: "otp:request:1",
  correlationId: "http-request-123",
};

const config = (overrides: Record<string, unknown> = {}) =>
  ({
    akNexus: {
      apiBaseUrl: "https://app.aknexus.in/api",
      sendPath: "send",
      apiToken: "secret-access-token",
      accountId: "instance-123",
      timeoutMs: 10_000,
      ...overrides,
    },
  }) as never;

describe("AkNexusWhatsAppClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("uses only the documented POST /api/send text contract", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation();
    const client = new AkNexusWhatsAppClient(config());

    await expect(client.sendMessage(providerRequest)).resolves.toEqual({
      status: "accepted",
      provider: "ak_nexus",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://app.aknexus.in/api/send");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      number: "919876543210",
      type: "text",
      message: providerRequest.message,
      instance_id: "instance-123",
      access_token: "secret-access-token",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-access-token");
    expect(JSON.stringify(log.mock.calls)).not.toContain("+919876543210");
    expect(JSON.stringify(log.mock.calls)).not.toContain("919876543210");
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"requestId":"http-request-123"'),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"maskedNumber":"********3210"'),
    );
  });

  it.each([
    [429, true, "PROVIDER_UNAVAILABLE"],
    [503, true, "PROVIDER_UNAVAILABLE"],
    [400, false, "PROVIDER_REJECTED"],
  ])(
    "maps HTTP %s to a structured provider error",
    async (status, retryable, code) => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(new Response("rejected", { status }));
      const client = new AkNexusWhatsAppClient(config());
      const promise = client.sendMessage(providerRequest);
      await expect(promise).rejects.toMatchObject({
        code: code as WhatsAppIntegrationError["code"],
        retryable,
        providerStatus: status,
      });
    },
  );

  it("rejects missing credentials before making an HTTP request", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const client = new AkNexusWhatsAppClient(config({ apiToken: "" }));
    await expect(client.sendMessage(providerRequest)).rejects.toMatchObject({
      code: "CONFIGURATION_INVALID",
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts timed-out requests and marks them retryable", async () => {
    jest.useFakeTimers();
    jest.spyOn(global, "fetch").mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
    );
    const client = new AkNexusWhatsAppClient(config({ timeoutMs: 25 }));
    const result = expect(client.sendMessage(providerRequest)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
      message: "AK NEXUS request timed out",
    });
    await jest.advanceTimersByTimeAsync(25);
    await result;
  });
});
