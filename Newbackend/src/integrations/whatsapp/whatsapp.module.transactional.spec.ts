import { Test } from "@nestjs/testing";
import type { WhatsAppOutboxNotification } from "./types/whatsapp.types";
import { WhatsAppTransactionalNotificationService } from "./services/whatsapp-transactional-notification.service";
import { WhatsAppModule } from "./whatsapp.module";

const envKeys = [
  "WHATSAPP_ENABLED",
  "WHATSAPP_DRY_RUN",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_BUSINESS_ACCOUNT_ID",
  "WHATSAPP_API_VERSION",
  "WHATSAPP_META_TEMPLATE_STAY_CONFIRMED",
  "AK_NEXUS_API_BASE_URL",
  "AK_NEXUS_API_TOKEN",
  "AK_NEXUS_ACCOUNT_ID",
  "MSG91_WHATSAPP_ENABLED",
] as const;
const originalEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
);

const stayConfirmed: WhatsAppOutboxNotification = {
  domain: "booking",
  notificationId: "notification-1",
  event: "booking_confirmed",
  phone: "+919876543210",
  recipientName: "Asha Verma",
  title: "Booking confirmed",
  message: "Your booking TRV-1001 is confirmed.",
  stay: {
    guestName: "Asha Verma",
    reference: "TRV-1001",
    ashramName: "Kashi Ashram",
    checkInDate: "2026-01-10T04:30:00.000Z",
    checkOutDate: "2026-01-12T05:30:00.000Z",
    guestsCount: 2,
    checkInCode: "482913",
    amountPaid: 2400,
    totalAmount: 2400,
    currency: "INR",
  },
};

describe("WhatsAppModule transactional delivery (no real messages sent)", () => {
  beforeEach(() => {
    process.env.WHATSAPP_ENABLED = "true";
    process.env.WHATSAPP_DRY_RUN = "false";
    process.env.WHATSAPP_ACCESS_TOKEN = "test-meta-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "987654321";
    process.env.WHATSAPP_API_VERSION = "v23.0";
    process.env.AK_NEXUS_API_BASE_URL = "https://app.aknexus.in/api";
    process.env.AK_NEXUS_API_TOKEN = "integration-access-token";
    process.env.AK_NEXUS_ACCOUNT_ID = "integration-instance";
    delete process.env.MSG91_WHATSAPP_ENABLED;
    delete process.env.WHATSAPP_META_TEMPLATE_STAY_CONFIRMED;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("sends a configured, approved template through Meta with the stored check-in code", async () => {
    process.env.WHATSAPP_META_TEMPLATE_STAY_CONFIRMED = "tirvona_stay_confirmed";
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.stay" }] }), {
        status: 200,
      }),
    );
    const module = await Test.createTestingModule({
      imports: [WhatsAppModule],
    }).compile();

    await expect(
      module
        .get(WhatsAppTransactionalNotificationService)
        .sendOutboxEvent(stayConfirmed),
    ).resolves.toMatchObject({ status: "accepted", provider: "meta_cloud" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v23.0/123456789/messages");
    const body = JSON.parse(String(init?.body));
    expect(body.template.name).toBe("tirvona_stay_confirmed");
    const parameters = body.template.components[0].parameters.map(
      (parameter: { text: string }) => parameter.text,
    );
    expect(parameters).toHaveLength(8);
    expect(parameters[0]).toBe("Asha Verma");
    expect(parameters[2]).toBe("TRV-1001");
    expect(parameters[7]).toBe("482913");
    await module.close();
  });

  it("keeps an unapproved template off Meta and delivers through the existing provider", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const module = await Test.createTestingModule({
      imports: [WhatsAppModule],
    }).compile();

    await expect(
      module
        .get(WhatsAppTransactionalNotificationService)
        .sendOutboxEvent(stayConfirmed),
    ).resolves.toMatchObject({ status: "accepted", provider: "ak_nexus" });

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.includes("graph.facebook.com"))).toBe(false);
    expect(urls[0]).toBe("https://app.aknexus.in/api/send");
    await module.close();
  });
});
