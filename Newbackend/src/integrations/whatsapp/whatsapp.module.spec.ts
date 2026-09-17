import { Test } from "@nestjs/testing";
import { WhatsAppOtpService } from "./services/whatsapp-otp.service";
import { WhatsAppModule } from "./whatsapp.module";

const whatsappEnvKeys = [
  "WHATSAPP_ENABLED",
  "WHATSAPP_DRY_RUN",
  "AK_NEXUS_API_BASE_URL",
  "AK_NEXUS_API_TOKEN",
  "AK_NEXUS_ACCOUNT_ID",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_BUSINESS_ACCOUNT_ID",
  "WHATSAPP_API_VERSION",
] as const;
const originalEnv = Object.fromEntries(
  whatsappEnvKeys.map((key) => [key, process.env[key]]),
);

describe("WhatsAppModule integration", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of whatsappEnvKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("resolves the provider graph and remains non-sending by default", async () => {
    delete process.env.WHATSAPP_ENABLED;
    delete process.env.WHATSAPP_DRY_RUN;
    const module = await Test.createTestingModule({
      imports: [WhatsAppModule],
    }).compile();
    const otp = module.get(WhatsAppOtpService);
    await expect(
      otp.sendAuthenticationOtp({
        phone: "+919876543210",
        code: "123456",
        expiresInMinutes: 5,
        idempotencyKey: "integration:otp:1",
      }),
    ).resolves.toMatchObject({
      status: "skipped",
      reason: "integration_disabled",
    });
    await module.close();
  });

  it("sends OTP through the documented AK NEXUS text endpoint", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    delete process.env.WHATSAPP_API_VERSION;
    process.env.WHATSAPP_ENABLED = "true";
    process.env.WHATSAPP_DRY_RUN = "false";
    process.env.AK_NEXUS_API_BASE_URL = "https://app.aknexus.in/api";
    process.env.AK_NEXUS_API_TOKEN = "integration-access-token";
    process.env.AK_NEXUS_ACCOUNT_ID = "integration-instance";
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const module = await Test.createTestingModule({
      imports: [WhatsAppModule],
    }).compile();

    const otp = module.get(WhatsAppOtpService);
    await expect(
      otp.sendAuthenticationOtp({
        phone: "9936968762",
        code: "123456",
        expiresInMinutes: 5,
        idempotencyKey: "integration:otp:real-client",
      }),
    ).resolves.toMatchObject({ status: "accepted", provider: "ak_nexus" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://app.aknexus.in/api/send");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      number: "919936968762",
      type: "text",
      instance_id: "integration-instance",
      access_token: "integration-access-token",
    });
    expect(body.message).toContain("123456");
    expect(body.message).toContain("5 minutes");
    await module.close();
  });

  it("sends OTP through Meta's approved authentication template", async () => {
    process.env.WHATSAPP_ENABLED = "true";
    process.env.WHATSAPP_DRY_RUN = "false";
    process.env.WHATSAPP_ACCESS_TOKEN = "test-meta-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "987654321";
    process.env.WHATSAPP_API_VERSION = "v23.0";
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), {
        status: 200,
      }),
    );
    const module = await Test.createTestingModule({
      imports: [WhatsAppModule],
    }).compile();

    const otp = module.get(WhatsAppOtpService);
    await expect(
      otp.sendAuthenticationOtp({
        phone: "+919876543210",
        code: "123456",
        expiresInMinutes: 5,
        idempotencyKey: "integration:otp:meta-cloud",
      }),
    ).resolves.toMatchObject({
      status: "accepted",
      provider: "meta_cloud",
      providerMessageId: "wamid.test",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://graph.facebook.com/v23.0/123456789/messages",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-meta-token",
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      messaging_product: "whatsapp",
      to: "919876543210",
      type: "template",
      template: {
        name: "tirvona_authetication",
        language: { code: "en" },
      },
    });
    await module.close();
  });
});
