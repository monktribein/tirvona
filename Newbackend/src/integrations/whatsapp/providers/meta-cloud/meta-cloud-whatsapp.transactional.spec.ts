import type { WhatsAppProviderRequest } from "../../types/whatsapp.types";
import {
  MetaCloudWhatsAppClient,
  type MetaTransactionalTemplate,
} from "./meta-cloud-whatsapp.client";

const request: WhatsAppProviderRequest = {
  to: "+919876543210",
  messageType: "booking_confirmation",
  message: "not used by the template provider",
  idempotencyKey: "booking:n-1:whatsapp",
  metaEvent: "stay_confirmed",
};

const template = (
  overrides: Partial<MetaTransactionalTemplate> = {},
): MetaTransactionalTemplate => ({
  name: "tirvona_stay_confirmed",
  language: "en",
  parameterFormat: "positional",
  parameters: [
    { name: "customer_name", text: "Asha Verma" },
    { name: "reference", text: "TRV-1001" },
  ],
  ...overrides,
});

const config = (overrides: Record<string, unknown> = {}) =>
  ({
    metaCloud: {
      graphBaseUrl: "https://graph.facebook.com",
      apiVersion: "v23.0",
      accessToken: "test-access-token",
      phoneNumberId: "123456789",
      businessAccountId: "987654321",
      timeoutMs: 10_000,
      authTemplate: { name: "tirvona_authetication", language: "en" },
      ...overrides,
    },
  }) as never;

describe("MetaCloudWhatsAppClient transactional templates", () => {
  afterEach(() => jest.restoreAllMocks());

  it("posts the approved template with positional body parameters", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.tx" }] }), {
        status: 200,
      }),
    );

    await expect(
      new MetaCloudWhatsAppClient(config()).sendTransactionalTemplate(
        request,
        template(),
      ),
    ).resolves.toMatchObject({
      status: "accepted",
      provider: "meta_cloud",
      providerMessageId: "wamid.tx",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v23.0/123456789/messages");
    expect(JSON.parse(String(init?.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "919876543210",
      type: "template",
      template: {
        name: "tirvona_stay_confirmed",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Asha Verma" },
              { type: "text", text: "TRV-1001" },
            ],
          },
        ],
      },
    });
  });

  it("names each parameter when templates use named placeholders", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.named" }] }), {
        status: 200,
      }),
    );
    await new MetaCloudWhatsAppClient(config()).sendTransactionalTemplate(
      request,
      template({ parameterFormat: "named" }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.template.components[0].parameters[0]).toEqual({
      type: "text",
      text: "Asha Verma",
      parameter_name: "customer_name",
    });
  });

  it.each([
    [400, "INVALID_REQUEST", false],
    [401, "CONFIGURATION_INVALID", false],
    [429, "PROVIDER_RATE_LIMITED", true],
    [503, "PROVIDER_UNAVAILABLE", true],
  ])(
    "classifies a definite HTTP %s response as %s",
    async (status, code, retryable) => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(new Response("{}", { status: status as number }));
      await expect(
        new MetaCloudWhatsAppClient(config()).sendTransactionalTemplate(
          request,
          template(),
        ),
      ).rejects.toMatchObject({ code, retryable });
    },
  );

  it("reports a timeout as unconfirmed, never as retryable", async () => {
    jest.spyOn(global, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("The operation was aborted")),
          );
        }),
    );
    await expect(
      new MetaCloudWhatsAppClient(
        config({ timeoutMs: 5 }),
      ).sendTransactionalTemplate(request, template()),
    ).rejects.toMatchObject({
      name: "WhatsAppDeliveryUnconfirmedError",
      code: "DELIVERY_UNCONFIRMED",
      retryable: false,
    });
  });

  it("reports a dropped connection without a response as unconfirmed", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("socket hang up"));
    await expect(
      new MetaCloudWhatsAppClient(config()).sendTransactionalTemplate(
        request,
        template(),
      ),
    ).rejects.toMatchObject({ code: "DELIVERY_UNCONFIRMED", retryable: false });
  });

  it("keeps a connection refused before sending retryable", async () => {
    const refused = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "ECONNREFUSED" },
    });
    jest.spyOn(global, "fetch").mockRejectedValue(refused);
    await expect(
      new MetaCloudWhatsAppClient(config()).sendTransactionalTemplate(
        request,
        template(),
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", retryable: true });
  });

  it("rejects an unconfigured template before making a request", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new MetaCloudWhatsAppClient(config()).sendTransactionalTemplate(
        request,
        template({ name: "" }),
      ),
    ).rejects.toMatchObject({ code: "TEMPLATE_UNCONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not log the access token, raw recipient or guest details", async () => {
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

    await client.sendTransactionalTemplate(request, template());

    const output = lines.join("\n");
    expect(output).not.toContain("test-access-token");
    expect(output).not.toContain("919876543210");
    expect(output).not.toContain("Asha Verma");
    expect(output).toContain("********3210");
  });
});
