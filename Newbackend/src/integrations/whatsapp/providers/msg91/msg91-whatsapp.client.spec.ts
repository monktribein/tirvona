import type { WhatsAppProviderRequest } from "../../types/whatsapp.types";
import { Msg91WhatsAppClient } from "./msg91-whatsapp.client";

const request: WhatsAppProviderRequest = {
  to: "9876543210",
  messageType: "auth_otp",
  message: "Your Tirvona verification code is 123456.",
  idempotencyKey: "auth-otp:1",
  templateVariables: { otp: "123456" },
};

const template = {
  name: "tirvona_otp",
  components: { body_1: { type: "text" as const, value: "123456" } },
};

const config = (overrides: Record<string, unknown> = {}) =>
  ({
    msg91: {
      apiBaseUrl: "https://control.msg91.com/api/v5",
      sendPath: "whatsapp/whatsapp-outbound-message/bulk/",
      authKey: "auth-key",
      integratedNumber: "919000000000",
      namespace: "",
      templateLanguage: "en_GB",
      timeoutMs: 10_000,
      ...overrides,
    },
  }) as never;

describe("Msg91WhatsAppClient", () => {
  afterEach(() => jest.restoreAllMocks());

  it("posts the documented template payload over HTTPS", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "success", request_id: "r-1" }), {
          status: 200,
        }),
      );

    await expect(
      new Msg91WhatsAppClient(config()).sendTemplate(request, template),
    ).resolves.toMatchObject({
      status: "accepted",
      provider: "msg91",
      providerMessageId: "r-1",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
    );
    expect(String(url).startsWith("https://")).toBe(true);
    expect(
      (init?.headers as Record<string, string>).authkey,
    ).toBe("auth-key");
    expect(JSON.parse(String(init?.body))).toEqual({
      integrated_number: "919000000000",
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "tirvona_otp",
          language: { code: "en_GB", policy: "deterministic" },
          namespace: null,
          to_and_components: [
            {
              to: ["919876543210"],
              components: { body_1: { type: "text", value: "123456" } },
            },
          ],
        },
      },
    });
  });

  it("refuses to call MSG91 when credentials are missing", async () => {
    const fetchMock = jest.spyOn(global, "fetch");

    await expect(
      new Msg91WhatsAppClient(config({ authKey: "" })).sendTemplate(
        request,
        template,
      ),
    ).rejects.toMatchObject({ code: "CONFIGURATION_INVALID" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid recipient before any network call", async () => {
    const fetchMock = jest.spyOn(global, "fetch");

    await expect(
      new Msg91WhatsAppClient(config()).sendTemplate(
        { ...request, to: "12345" },
        template,
      ),
    ).rejects.toMatchObject({ code: "INVALID_RECIPIENT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, "CONFIGURATION_INVALID", false],
    [429, "PROVIDER_RATE_LIMITED", true],
    [408, "PROVIDER_TIMEOUT", true],
    [503, "PROVIDER_UNAVAILABLE", true],
    [400, "INVALID_REQUEST", false],
  ])("classifies HTTP %s as %s", async (status, code, retryable) => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: status as number }));

    await expect(
      new Msg91WhatsAppClient(config()).sendTemplate(request, template),
    ).rejects.toMatchObject({ code, retryable });
  });

  it("treats a 200 error body as a provider rejection", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "error", message: "bad" }), {
          status: 200,
        }),
      );

    await expect(
      new Msg91WhatsAppClient(config()).sendTemplate(request, template),
    ).rejects.toMatchObject({ code: "PROVIDER_REJECTED", retryable: false });
  });

  it("reports a network failure as a retryable provider outage", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("socket hang up"));

    await expect(
      new Msg91WhatsAppClient(config()).sendTemplate(request, template),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", retryable: true });
  });

  it("reports an aborted request as a timeout", async () => {
    jest.spyOn(global, "fetch").mockImplementation((_url, init) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    });

    await expect(
      new Msg91WhatsAppClient(config({ timeoutMs: 5 })).sendTemplate(
        request,
        template,
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT", retryable: true });
  });

  it("never writes the auth key or the raw number to the logs", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ status: "success" })));
    const client = new Msg91WhatsAppClient(config());
    const logger = (
      client as unknown as {
        logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
      }
    ).logger;
    const lines: string[] = [];
    for (const level of ["log", "warn", "error"] as const)
      jest.spyOn(logger, level).mockImplementation((line: unknown) => {
        lines.push(String(line));
      });

    await client.sendTemplate(request, template);

    const output = lines.join("\n");
    expect(output).not.toContain("auth-key");
    expect(output).not.toContain("123456");
    expect(output).not.toContain("919876543210");
    expect(output).toContain("*******3210");
  });
});
