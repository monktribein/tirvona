import {
  META_TRANSACTIONAL_EVENT,
  META_TRANSACTIONAL_TEMPLATE_SPEC,
} from "../../constants/whatsapp-meta-templates.constants";
import {
  WhatsAppDeliveryUnconfirmedError,
  WhatsAppIntegrationError,
} from "../../errors/whatsapp.errors";
import type { WhatsAppProviderRequest } from "../../types/whatsapp.types";
import { MetaCloudWhatsAppClient } from "./meta-cloud-whatsapp.client";
import { MetaCloudWhatsAppProvider } from "./meta-cloud-whatsapp.provider";

const IMAGE_BYTES = Buffer.from("fake-png-bytes-for-upload");
const CAPTION = "Tirvona parking pass PRK-9\nGate code: 1CNC-AKPC";

const clientConfig = () =>
  ({
    metaCloud: {
      graphBaseUrl: "https://graph.facebook.com",
      apiVersion: "v23.0",
      accessToken: "test-access-token",
      phoneNumberId: "123456789",
      businessAccountId: "987654321",
      timeoutMs: 10_000,
    },
  }) as never;

const request: WhatsAppProviderRequest = {
  to: "+919811111111",
  messageType: "booking_confirmation",
  message: "composed body",
  idempotencyKey: "parking:n-1:whatsapp",
  metaEvent: "parking_confirmed",
  templateVariables: { reference: "PRK-9", gate_code: "1CNC-AKPC" },
  followUpImage: {
    data: IMAGE_BYTES,
    mimeType: "image/png",
    filename: "tirvona-parking-pass-PRK-9.png",
    caption: CAPTION,
  },
};

const captureLogs = (client: MetaCloudWhatsAppClient) => {
  const lines: string[] = [];
  const logger = (client as unknown as { logger: Record<string, unknown> }).logger as {
    log: (...a: unknown[]) => void;
    warn: (...a: unknown[]) => void;
    error: (...a: unknown[]) => void;
  };
  for (const level of ["log", "warn", "error"] as const)
    jest.spyOn(logger, level).mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
  return lines;
};

describe("MetaCloudWhatsAppClient media upload and image message", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uploads the image as multipart form data and returns the media id", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "media-1" }), { status: 200 }));

    await expect(
      new MetaCloudWhatsAppClient(clientConfig()).uploadMedia(request, request.followUpImage!),
    ).resolves.toBe("media-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v23.0/123456789/media");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-access-token",
    );
    const form = init?.body as FormData;
    expect(form.get("messaging_product")).toBe("whatsapp");
    expect(form.get("type")).toBe("image/png");
    const file = form.get("file") as File;
    expect(file.name).toBe("tirvona-parking-pass-PRK-9.png");
    expect(Buffer.from(await file.arrayBuffer()).equals(IMAGE_BYTES)).toBe(true);
  });

  it.each([
    [400, "INVALID_REQUEST"],
    [401, "CONFIGURATION_INVALID"],
  ])("rejects an HTTP %s upload as %s", async (status, code) => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status }));
    await expect(
      new MetaCloudWhatsAppClient(clientConfig()).uploadMedia(request, request.followUpImage!),
    ).rejects.toMatchObject({ code });
  });

  it("rejects an upload response that carries no media id", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(
      new MetaCloudWhatsAppClient(clientConfig()).uploadMedia(request, request.followUpImage!),
    ).rejects.toMatchObject({ code: "PROVIDER_REJECTED" });
  });

  it("posts an image message that references the uploaded media", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.image" }] }), { status: 200 }),
    );

    await expect(
      new MetaCloudWhatsAppClient(clientConfig()).sendImageMessage(request, "media-1", CAPTION),
    ).resolves.toMatchObject({ status: "accepted", providerMessageId: "wamid.image" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v23.0/123456789/messages");
    expect(JSON.parse(String(init?.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "919811111111",
      type: "image",
      image: { id: "media-1", caption: CAPTION },
    });
  });

  it("reports an image send left without a response as unconfirmed", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("socket hang up"));
    await expect(
      new MetaCloudWhatsAppClient(clientConfig()).sendImageMessage(request, "media-1", CAPTION),
    ).rejects.toBeInstanceOf(WhatsAppDeliveryUnconfirmedError);
  });

  it("never logs the token, raw number, caption, media id or image bytes", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "media-secret-id" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ messages: [{ id: "wamid.image" }] }), { status: 200 }),
      );
    const client = new MetaCloudWhatsAppClient(clientConfig());
    const lines = captureLogs(client);

    const mediaId = await client.uploadMedia(request, request.followUpImage!);
    await client.sendImageMessage(request, mediaId, CAPTION);

    const output = lines.join("\n");
    expect(output).not.toContain("test-access-token");
    expect(output).not.toContain("919811111111");
    expect(output).not.toContain("1CNC-AKPC");
    expect(output).not.toContain("media-secret-id");
    expect(output).not.toContain("fake-png-bytes");
    expect(output).toContain("********1111");
  });
});

const providerConfig = (dryRun = false) =>
  ({
    dryRun,
    metaCloud: {
      apiVersion: "v23.0",
      accessToken: "test-access-token",
      phoneNumberId: "123456789",
      businessAccountId: "987654321",
      parameterFormat: "positional",
      transactionalTemplates: Object.fromEntries(
        Object.values(META_TRANSACTIONAL_EVENT).map((event) => [
          event,
          {
            name: event === "parking_confirmed" ? "tirvona_parking_confirmed" : "",
            language: "en",
            bodyVariables: META_TRANSACTIONAL_TEMPLATE_SPEC[event].bodyVariables,
          },
        ]),
      ),
    },
  }) as never;

const clientStub = (overrides: Record<string, jest.Mock> = {}) => {
  const calls: string[] = [];
  const track = (name: string, impl: jest.Mock) =>
    jest.fn((...args: unknown[]) => {
      calls.push(name);
      return impl(...args);
    });
  return {
    calls,
    sendTransactionalTemplate: track(
      "template",
      overrides.sendTransactionalTemplate ??
        jest.fn().mockResolvedValue({ status: "accepted", provider: "meta_cloud", providerMessageId: "wamid.template" }),
    ),
    uploadMedia: track("upload", overrides.uploadMedia ?? jest.fn().mockResolvedValue("media-1")),
    sendImageMessage: track(
      "image",
      overrides.sendImageMessage ??
        jest.fn().mockResolvedValue({ status: "accepted", provider: "meta_cloud", providerMessageId: "wamid.image" }),
    ),
  };
};

describe("MetaCloudWhatsAppProvider follow-up image", () => {
  it("sends the template first, then uploads and sends the image", async () => {
    const client = clientStub();
    const result = await new MetaCloudWhatsAppProvider(client as never, providerConfig()).sendMessage(request);

    expect(client.calls).toEqual(["template", "upload", "image"]);
    expect(client.sendImageMessage).toHaveBeenCalledWith(request, "media-1", CAPTION);
    expect(result).toMatchObject({
      status: "accepted",
      providerMessageId: "wamid.template",
      followUp: { status: "accepted", providerMessageId: "wamid.image" },
    });
  });

  it("keeps the delivered template when the upload fails, and never throws", async () => {
    const client = clientStub({
      uploadMedia: jest
        .fn()
        .mockRejectedValue(new WhatsAppIntegrationError("bad", "INVALID_REQUEST", false, 400)),
    });
    const result = await new MetaCloudWhatsAppProvider(client as never, providerConfig()).sendMessage(request);

    expect(result).toMatchObject({
      status: "accepted",
      followUp: { status: "failed", reason: "INVALID_REQUEST" },
    });
    expect(client.sendImageMessage).not.toHaveBeenCalled();
  });

  it("records an image send without a response as unconfirmed", async () => {
    const client = clientStub({
      sendImageMessage: jest.fn().mockRejectedValue(new WhatsAppDeliveryUnconfirmedError("meta_cloud")),
    });
    const result = await new MetaCloudWhatsAppProvider(client as never, providerConfig()).sendMessage(request);
    expect(result.followUp).toEqual({ status: "unconfirmed", reason: "image_response_unconfirmed" });
  });

  it("sends no image when the template itself is not accepted", async () => {
    const client = clientStub({
      sendTransactionalTemplate: jest
        .fn()
        .mockRejectedValue(new WhatsAppIntegrationError("bad", "INVALID_REQUEST", false, 400)),
    });
    await expect(
      new MetaCloudWhatsAppProvider(client as never, providerConfig()).sendMessage(request),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(client.uploadMedia).not.toHaveBeenCalled();
  });

  it("uploads nothing for a message without a follow-up image", async () => {
    const client = clientStub();
    const { followUpImage: _omit, ...plain } = request;
    void _omit;
    const result = await new MetaCloudWhatsAppProvider(client as never, providerConfig()).sendMessage(plain);
    expect(client.calls).toEqual(["template"]);
    expect(result.followUp).toBeUndefined();
  });

  it("calls Meta for neither the template nor the image during a dry run", async () => {
    const client = clientStub();
    await new MetaCloudWhatsAppProvider(client as never, providerConfig(true)).sendMessage(request);
    expect(client.calls).toEqual([]);
  });
});
