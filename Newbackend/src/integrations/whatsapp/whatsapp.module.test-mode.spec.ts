import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { WhatsAppOtpService } from "./services/whatsapp-otp.service";
import { WhatsAppTransactionalNotificationService } from "./services/whatsapp-transactional-notification.service";
import type { WhatsAppOutboxNotification } from "./types/whatsapp.types";
import { WhatsAppModule } from "./whatsapp.module";

/**
 * WhatsApp test mode through the real module graph. `fetch` is mocked, so no
 * message leaves the machine; the assertions are on what WOULD reach Meta.
 */

const TEST_RECIPIENT = "919936968762";
const CUSTOMER = "919876543210";
const ACCESS_TOKEN = "test-meta-token-do-not-log";

const ENV = {
  WHATSAPP_ENABLED: "true",
  WHATSAPP_DRY_RUN: "false",
  WHATSAPP_ACCESS_TOKEN: ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: "123456789",
  WHATSAPP_BUSINESS_ACCOUNT_ID: "987654321",
  WHATSAPP_API_VERSION: "v23.0",
  WHATSAPP_META_TEMPLATE_STAY_CONFIRMED: "tirvona_stay_confirmed",
  WHATSAPP_META_TEMPLATE_PARKING_CONFIRMED: "tirvona_parking_confirmed",
} as const;

const UNSET = [
  "AK_NEXUS_API_BASE_URL",
  "AK_NEXUS_API_TOKEN",
  "AK_NEXUS_ACCOUNT_ID",
  "MSG91_WHATSAPP_ENABLED",
  "WHATSAPP_TEST_MODE",
  "WHATSAPP_TEST_RECIPIENTS",
] as const;

const touched = [...Object.keys(ENV), ...UNSET];
const originalEnv = Object.fromEntries(
  touched.map((key) => [key, process.env[key]]),
);

const stayConfirmed = (phone: string): WhatsAppOutboxNotification => ({
  domain: "booking",
  notificationId: "notification-1",
  event: "booking_confirmed",
  phone,
  title: "Booking confirmed",
  message: "Your booking TRV-1001 is confirmed.",
  stay: {
    guestName: "Asha Verma",
    reference: "TRV-1001",
    ashramName: "Kashi Ashram",
    checkInDate: "2026-01-10T04:30:00.000Z",
    checkOutDate: "2026-01-12T05:30:00.000Z",
    guestsCount: 2,
    checkInCode: "4829",
    amountPaid: 2400,
    totalAmount: 2400,
    currency: "INR",
  },
});

describe("WhatsApp test mode (fetch mocked, nothing sent)", () => {
  let module: TestingModule;
  let fetchMock: jest.SpyInstance;
  let logLines: string[];

  const compile = async (testEnv: Record<string, string>) => {
    Object.assign(process.env, ENV, testEnv);
    module = await Test.createTestingModule({
      imports: [WhatsAppModule],
    }).compile();
    await module.init();
  };

  const metaBodies = () =>
    fetchMock.mock.calls
      .filter(([url]) => String(url).includes("graph.facebook.com"))
      .map(([, init]) => JSON.parse(String(init?.body)));

  beforeEach(() => {
    for (const key of UNSET) delete process.env[key];
    fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), {
            status: 200,
          }),
      );
    logLines = [];
    for (const level of ["log", "warn", "error", "debug", "verbose"] as const)
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((...args: unknown[]) => {
          logLines.push(args.map(String).join(" "));
        });
  });

  afterEach(async () => {
    await module?.close();
    jest.restoreAllMocks();
    for (const key of touched) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("delivers to the allow-listed test recipient through Meta", async () => {
    await compile({
      WHATSAPP_TEST_MODE: "true",
      WHATSAPP_TEST_RECIPIENTS: `+${TEST_RECIPIENT}`,
    });
    await expect(
      module
        .get(WhatsAppTransactionalNotificationService)
        // Stored in 10-digit form on the booking; still the same number.
        .sendOutboxEvent(stayConfirmed(TEST_RECIPIENT.slice(2))),
    ).resolves.toMatchObject({ status: "accepted", provider: "meta_cloud" });

    const [body] = metaBodies();
    expect(metaBodies()).toHaveLength(1);
    expect(body.to).toBe(TEST_RECIPIENT);
    expect(body.template.name).toBe("tirvona_stay_confirmed");
    expect(body.template.language).toEqual({ code: "en" });
  });

  it("blocks every other customer before any provider, Meta included", async () => {
    await compile({
      WHATSAPP_TEST_MODE: "true",
      WHATSAPP_TEST_RECIPIENTS: TEST_RECIPIENT,
    });
    await expect(
      module
        .get(WhatsAppTransactionalNotificationService)
        .sendOutboxEvent(stayConfirmed(`+${CUSTOMER}`)),
    ).resolves.toMatchObject({
      status: "skipped",
      reason: "test_mode_recipient_not_allowed",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("delivers to each of several allow-listed recipients", async () => {
    await compile({
      WHATSAPP_TEST_MODE: "true",
      WHATSAPP_TEST_RECIPIENTS: `919811111111, +${TEST_RECIPIENT}`,
    });
    const service = module.get(WhatsAppTransactionalNotificationService);
    await service.sendOutboxEvent(stayConfirmed(TEST_RECIPIENT));
    await service.sendOutboxEvent({
      ...stayConfirmed("9811111111"),
      domain: "parking",
      stay: undefined,
      parking: { reference: "PRK-9", displayCode: "GATE-77" },
    });
    await service.sendOutboxEvent(stayConfirmed(CUSTOMER));
    expect(metaBodies().map((body) => body.to)).toEqual([
      TEST_RECIPIENT,
      "919811111111",
    ]);
  });

  it("fails closed when test mode is on with no valid recipients", async () => {
    await compile({ WHATSAPP_TEST_MODE: "true", WHATSAPP_TEST_RECIPIENTS: "" });
    await module
      .get(WhatsAppTransactionalNotificationService)
      .sendOutboxEvent(stayConfirmed(TEST_RECIPIENT));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not restrict customers when test mode is off, even with a list set", async () => {
    await compile({
      WHATSAPP_TEST_MODE: "false",
      WHATSAPP_TEST_RECIPIENTS: TEST_RECIPIENT,
    });
    await module
      .get(WhatsAppTransactionalNotificationService)
      .sendOutboxEvent(stayConfirmed(CUSTOMER));
    expect(metaBodies().map((body) => body.to)).toEqual([CUSTOMER]);
  });

  it("OTP regression: test mode leaves OTP on tirvona_authetication, unrestricted", async () => {
    await compile({
      WHATSAPP_TEST_MODE: "true",
      WHATSAPP_TEST_RECIPIENTS: TEST_RECIPIENT,
    });
    await expect(
      module.get(WhatsAppOtpService).sendAuthenticationOtp({
        phone: `+${CUSTOMER}`,
        code: "123456",
        expiresInMinutes: 5,
        idempotencyKey: "test-mode:otp",
      }),
    ).resolves.toMatchObject({ status: "accepted", provider: "meta_cloud" });
    const [body] = metaBodies();
    expect(body.template.name).toBe("tirvona_authetication");
    expect(body.template.components[0].parameters).toEqual([
      { type: "text", text: "123456" },
    ]);
  });

  it("never logs the access token, the allow-listed numbers or a customer number", async () => {
    await compile({
      WHATSAPP_TEST_MODE: "true",
      WHATSAPP_TEST_RECIPIENTS: TEST_RECIPIENT,
    });
    const service = module.get(WhatsAppTransactionalNotificationService);
    await service.sendOutboxEvent(stayConfirmed(TEST_RECIPIENT));
    await service.sendOutboxEvent(stayConfirmed(CUSTOMER));

    const output = logLines.join("\n");
    expect(output).toContain("whatsapp.test_mode_enabled");
    expect(output).not.toContain(ACCESS_TOKEN);
    expect(output).not.toContain(TEST_RECIPIENT);
    expect(output).not.toContain(CUSTOMER);
  });
});
