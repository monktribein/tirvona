import type { WhatsAppProviderRequest } from "../../types/whatsapp.types";
import { MetaCloudWhatsAppClient } from "./meta-cloud-whatsapp.client";

const request: WhatsAppProviderRequest = {
  to: "+919876543210",
  messageType: "auth_otp",
  message: "not used by the template provider",
  idempotencyKey: "auth-otp:1",
  templateVariables: { otp: "123456" },
};

const config = (overrides: Record<string, unknown> = {}) =>
  ({
    metaCloud: {
      graphBaseUrl: "https://graph.facebook.com",
      apiVersion: "v23.0",
      accessToken: "test-access-token",
      phoneNumberId: "123456789",
      businessAccountId: "987654321",
      timeoutMs: 10_000,
      authTemplate: {
        name: "tirvona_authetication",
        language: "en",
      },
      ...overrides,
    },
  }) as never;

describe("MetaCloudWhatsAppClient", () => {
  afterEach(() => jest.restoreAllMocks());

  it("posts the approved authentication template to the Cloud API", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), {
        status: 200,
      }),
    );

    await expect(
      new MetaCloudWhatsAppClient(config()).sendAuthenticationTemplate(
        request,
        "123456",
      ),
    ).resolves.toMatchObject({
      status: "accepted",
      provider: "meta_cloud",
      providerMessageId: "wamid.1",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://graph.facebook.com/v23.0/123456789/messages",
    );
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-access-token",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "919876543210",
      type: "template",
      template: {
        name: "tirvona_authetication",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: "123456" }],
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: "123456" }],
          },
        ],
      },
    });
  });

  it("rejects incomplete configuration before making a request", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new MetaCloudWhatsAppClient(
        config({ accessToken: "" }),
      ).sendAuthenticationTemplate(request, "123456"),
    ).rejects.toMatchObject({ code: "CONFIGURATION_INVALID" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid recipient before making a request", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new MetaCloudWhatsAppClient(config()).sendAuthenticationTemplate(
        { ...request, to: "12345" },
        "123456",
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
      new MetaCloudWhatsAppClient(config()).sendAuthenticationTemplate(
        request,
        "123456",
      ),
    ).rejects.toMatchObject({ code, retryable });
  });

  it("does not log the access token, OTP, or raw recipient", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), {
        status: 200,
      }),
    );
    const client = new MetaCloudWhatsAppClient(config());
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

    await client.sendAuthenticationTemplate(request, "654321");

    const output = lines.join("\n");
    expect(output).not.toContain("test-access-token");
    expect(output).not.toContain("123456789");
    expect(output).not.toContain("654321");
    expect(output).not.toContain("919876543210");
    expect(output).toContain("********3210");
  });

  it("turns network failures into safe retryable errors", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("socket failure"));
    await expect(
      new MetaCloudWhatsAppClient(config()).sendAuthenticationTemplate(
        request,
        "123456",
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
    });
  });
});
