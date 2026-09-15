import { Test, type TestingModule } from "@nestjs/testing";
import { META_AUTH_OTP_TEMPLATE } from "./constants/whatsapp.constants";
import { WhatsAppOtpService } from "./services/whatsapp-otp.service";
import { WhatsAppTransactionalNotificationService } from "./services/whatsapp-transactional-notification.service";
import type { WhatsAppOutboxNotification } from "./types/whatsapp.types";
import { formatDate, formatDateTime } from "./utils/whatsapp-message.builder";
import { WhatsAppModule } from "./whatsapp.module";

/**
 * Builds real Meta Cloud API request payloads for the ten templates approved in
 * WhatsApp Manager and checks each one against its approved body: template
 * name, language, parameter count, order, values and recipient. `fetch` is
 * mocked throughout, so no WhatsApp message is ever sent.
 */

const APPROVED_TEMPLATE_ENV = {
  WHATSAPP_META_TEMPLATE_RESERVATION_HELD: "tirvona_reservation_held",
  WHATSAPP_META_TEMPLATE_STAY_CONFIRMED: "tirvona_stay_confirmed",
  WHATSAPP_META_TEMPLATE_PARKING_CONFIRMED: "tirvona_parking_confirmed",
  WHATSAPP_META_TEMPLATE_AARTI_CONFIRMED: "tirvona_aarti_confirmed",
  WHATSAPP_META_TEMPLATE_EVENT_REGISTERED: "tirvona_event_registered",
  WHATSAPP_META_TEMPLATE_RESERVATION_CANCELLED: "tirvona_reservation_cancelled",
  WHATSAPP_META_TEMPLATE_REFUND_UPDATE: "tirvona_refund_update",
  WHATSAPP_META_TEMPLATE_RESERVATION_EXPIRED: "tirvona_reservation_expired",
  WHATSAPP_META_TEMPLATE_SERVICE_CHECKED_IN: "tirvona_service_checked_in",
  WHATSAPP_META_TEMPLATE_SERVICE_CHECKED_OUT: "tirvona_service_checked_out",
} as const;

const BASE_ENV = {
  WHATSAPP_ENABLED: "true",
  WHATSAPP_DRY_RUN: "false",
  WHATSAPP_ACCESS_TOKEN: "test-meta-token",
  WHATSAPP_PHONE_NUMBER_ID: "123456789",
  WHATSAPP_BUSINESS_ACCOUNT_ID: "987654321",
  WHATSAPP_API_VERSION: "v23.0",
} as const;

const UNSET_ENV = [
  "WHATSAPP_META_TEMPLATE_PAYMENT_FAILED",
  "WHATSAPP_META_TEMPLATE_STAY_REMINDER",
  "WHATSAPP_META_TEMPLATE_PARKING_REMINDER",
  "WHATSAPP_META_TEMPLATE_AARTI_REMINDER",
  "WHATSAPP_META_TEMPLATE_EVENT_REMINDER",
  "WHATSAPP_META_TEMPLATE_PARAMETER_FORMAT",
  "AK_NEXUS_API_BASE_URL",
  "AK_NEXUS_API_TOKEN",
  "AK_NEXUS_ACCOUNT_ID",
  "MSG91_WHATSAPP_ENABLED",
  "WHATSAPP_TEST_MODE",
  "WHATSAPP_TEST_RECIPIENTS",
] as const;

const touchedKeys = [
  ...Object.keys(APPROVED_TEMPLATE_ENV),
  ...Object.keys(BASE_ENV),
  ...UNSET_ENV,
];
const originalEnv = Object.fromEntries(
  touchedKeys.map((key) => [key, process.env[key]]),
);

const CHECK_IN = "2026-01-10T04:30:00.000Z";
const CHECK_OUT = "2026-01-12T05:30:00.000Z";
const HOLD_EXPIRES = "2026-01-05T10:00:00.000Z";
const OCCURRED = "2026-01-05T10:01:00.000Z";
const PARKING_ENTRY = "2026-01-10T04:30:00.000Z";
const PARKING_EXIT = "2026-01-10T08:30:00.000Z";
const AARTI_AT = "2026-01-10T13:00:00.000Z";
const EVENT_AT = "2026-01-10T12:30:00.000Z";
const CHECKED_IN_AT = "2026-01-10T06:35:00.000Z";
const CHECKED_OUT_AT = "2026-01-10T08:50:00.000Z";

const stay = {
  guestName: "Asha Verma",
  reference: "TRV-1001",
  ashramName: "Kashi Ashram",
  checkInDate: CHECK_IN,
  checkOutDate: CHECK_OUT,
  guestsCount: 2,
  checkInCode: "482913",
  amountPaid: 2400,
  totalAmount: 2400,
  currency: "INR",
};

const row = (
  overrides: Partial<WhatsAppOutboxNotification>,
): WhatsAppOutboxNotification => ({
  domain: "booking",
  notificationId: "notification-1",
  event: "booking_confirmed",
  phone: "+919876543210",
  recipientName: "Account Holder",
  title: "Update",
  message: "Update",
  ...overrides,
});

interface Case {
  label: string;
  template: string;
  recipient: string;
  notification: WhatsAppOutboxNotification;
  parameters: string[];
}

const CASES: Case[] = [
  {
    label: "Reservation held",
    template: "tirvona_reservation_held",
    recipient: "919876543210",
    notification: row({
      event: "booking_held",
      stay: { ...stay, amountPaid: 0, reservationExpiresAt: HOLD_EXPIRES },
    }),
    parameters: [
      "Asha Verma",
      "Ashram stay",
      "TRV-1001",
      "₹2,400",
      formatDateTime(HOLD_EXPIRES),
    ],
  },
  {
    label: "Stay confirmed",
    template: "tirvona_stay_confirmed",
    recipient: "919876543210",
    notification: row({ event: "booking_confirmed", stay }),
    parameters: [
      "Asha Verma",
      "Kashi Ashram",
      "TRV-1001",
      formatDate(CHECK_IN),
      formatDate(CHECK_OUT),
      "2",
      "₹2,400",
      "482913",
    ],
  },
  {
    label: "Parking confirmed (driver phone)",
    template: "tirvona_parking_confirmed",
    recipient: "919811111111",
    notification: row({
      domain: "parking",
      event: "booking_confirmed",
      phone: "9811111111",
      parking: {
        reference: "PRK-9",
        locationName: "North Gate",
        locationCity: "Haridwar",
        vehicleNumber: "UP32AB1234",
        entryAt: PARKING_ENTRY,
        exitAt: PARKING_EXIT,
        displayCode: "GATE-77",
        amountPaid: 50,
        currency: "INR",
        driverPhone: "9811111111",
      },
    }),
    parameters: [
      "North Gate, Haridwar",
      "PRK-9",
      "UP32AB1234",
      formatDateTime(PARKING_ENTRY),
      formatDateTime(PARKING_EXIT),
      "₹50",
      "GATE-77",
    ],
  },
  {
    label: "Aarti confirmed (contact phone)",
    template: "tirvona_aarti_confirmed",
    recipient: "919822222222",
    notification: row({
      domain: "aarti",
      event: "booking_confirmed",
      phone: "9822222222",
      aarti: {
        guestName: "Ravi",
        reference: "AAR-5",
        sessionName: "Ganga Aarti",
        scheduledAt: AARTI_AT,
        passCount: 3,
        amountPaid: 300,
        currency: "INR",
        displayCode: "AA-31",
      },
    }),
    parameters: [
      "Ravi",
      "Ganga Aarti",
      "AAR-5",
      formatDateTime(AARTI_AT),
      "3",
      "₹300",
      "AA-31",
    ],
  },
  {
    label: "Event registered (registration phone)",
    template: "tirvona_event_registered",
    recipient: "919833333333",
    notification: row({
      domain: "event",
      event: "registration_confirmed",
      phone: "9833333333",
      eventPass: {
        guestName: "Meera",
        reference: "EVT-3",
        eventName: "Deepotsav",
        startsAt: EVENT_AT,
        venue: "Main Hall",
        seats: 2,
        displayCode: "EV-12",
      },
    }),
    parameters: [
      "Meera",
      "Deepotsav",
      "EVT-3",
      formatDateTime(EVENT_AT),
      "Main Hall",
      "2",
      "EV-12",
    ],
  },
  {
    label: "Cancellation",
    template: "tirvona_reservation_cancelled",
    recipient: "919876543210",
    notification: row({
      event: "booking_cancelled",
      stay,
      data: { refundAmount: "1200" },
    }),
    parameters: [
      "Asha Verma",
      "Ashram stay",
      "TRV-1001",
      "Refund initiated",
      "₹1,200",
    ],
  },
  {
    label: "Refund update",
    template: "tirvona_refund_update",
    recipient: "919876543210",
    notification: row({
      event: "refund_completed",
      stay,
      data: {
        amount: "1200",
        refundNumber: "RFD-2026-0001",
        refundStatus: "completed",
      },
    }),
    parameters: ["TRV-1001", "Completed", "₹1,200", "RFD-2026-0001"],
  },
  {
    label: "Reservation expired (unpaid hold)",
    template: "tirvona_reservation_expired",
    recipient: "919876543210",
    notification: row({
      event: "booking_expired",
      stay: { ...stay, amountPaid: 0 },
      occurredAt: OCCURRED,
    }),
    parameters: ["Ashram stay", "TRV-1001", formatDateTime(OCCURRED)],
  },
  {
    label: "Service checked in",
    template: "tirvona_service_checked_in",
    recipient: "919876543210",
    notification: row({
      event: "checked_in",
      stay: { ...stay, checkedInAt: CHECKED_IN_AT, roomNumbers: ["101"] },
    }),
    parameters: [
      "Ashram stay",
      "TRV-1001",
      formatDateTime(CHECKED_IN_AT),
      "Room 101",
    ],
  },
  {
    label: "Service checked out",
    template: "tirvona_service_checked_out",
    recipient: "919811111111",
    notification: row({
      domain: "parking",
      event: "checked_out",
      phone: "9811111111",
      parking: {
        reference: "PRK-9",
        checkedOutAt: CHECKED_OUT_AT,
        overstayAmount: 40,
        currency: "INR",
      },
    }),
    parameters: [
      "Parking",
      "PRK-9",
      formatDateTime(CHECKED_OUT_AT),
      "Overstay charge ₹40",
    ],
  },
];

describe("Approved Meta templates: request payloads (fetch mocked, nothing sent)", () => {
  let module: TestingModule;
  let fetchMock: jest.SpyInstance;

  beforeEach(async () => {
    Object.assign(process.env, BASE_ENV, APPROVED_TEMPLATE_ENV);
    for (const key of UNSET_ENV) delete process.env[key];
    fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), {
            status: 200,
          }),
      );
    module = await Test.createTestingModule({
      imports: [WhatsAppModule],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
    jest.restoreAllMocks();
    for (const key of touchedKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const metaCalls = () =>
    fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("graph.facebook.com"),
    );

  it.each(CASES.map((c) => [c.label, c] as const))(
    "%s → exact approved template payload",
    async (_label, testCase) => {
      await expect(
        module
          .get(WhatsAppTransactionalNotificationService)
          .sendOutboxEvent(testCase.notification),
      ).resolves.toMatchObject({ status: "accepted", provider: "meta_cloud" });

      expect(metaCalls()).toHaveLength(1);
      const [url, init] = metaCalls()[0];
      expect(url).toBe("https://graph.facebook.com/v23.0/123456789/messages");
      const body = JSON.parse(String(init?.body));

      expect(body.to).toBe(testCase.recipient);
      expect(body.type).toBe("template");
      expect(body.template.name).toBe(testCase.template);
      expect(body.template.name).not.toBe(META_AUTH_OTP_TEMPLATE);
      expect(body.template.language).toEqual({ code: "en" });
      expect(body.template.components).toHaveLength(1);
      expect(body.template.components[0].type).toBe("body");

      const parameters = body.template.components[0].parameters;
      expect(parameters).toHaveLength(testCase.parameters.length);
      // Positional templates: no parameter names, only order.
      for (const parameter of parameters) {
        expect(parameter.type).toBe("text");
        expect(parameter).not.toHaveProperty("parameter_name");
      }
      expect(parameters.map((p: { text: string }) => p.text)).toEqual(
        testCase.parameters,
      );
    },
  );

  it("never sends payment_failed or a paid parking no-show to Meta", async () => {
    const service = module.get(WhatsAppTransactionalNotificationService);
    await expect(
      service.sendOutboxEvent(row({ event: "payment_failed", stay })),
    ).resolves.toMatchObject({ status: "skipped" });
    await expect(
      service.sendOutboxEvent(
        row({
          domain: "parking",
          event: "no_show",
          parking: { reference: "PRK-9", amountPaid: 50 },
        }),
      ),
    ).resolves.toMatchObject({
      status: "skipped",
      reason: "paid_no_show_has_no_template",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps templates that are not configured off Meta (stay reminder)", async () => {
    await module
      .get(WhatsAppTransactionalNotificationService)
      .sendOutboxEvent(row({ event: "checkin_reminder", stay }))
      .catch(() => undefined);
    expect(metaCalls()).toHaveLength(0);
  });

  it("leaves OTP on the approved authentication template", async () => {
    await module.get(WhatsAppOtpService).sendAuthenticationOtp({
      phone: "+919876543210",
      code: "123456",
      expiresInMinutes: 5,
      idempotencyKey: "approved-templates:otp",
    });
    const body = JSON.parse(String(metaCalls()[0][1]?.body));
    expect(body.template.name).toBe(META_AUTH_OTP_TEMPLATE);
    expect(body.template.name).toBe("tirvona_authetication");
    expect(body.template.components[0].parameters).toEqual([
      { type: "text", text: "123456" },
    ]);
  });
});
