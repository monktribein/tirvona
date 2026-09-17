import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { model, models, Types, type Model } from "mongoose";
import { BookingSchema } from "../bookings/infrastructure/persistence/booking.schemas";
import { checkInQrPayload } from "../bookings/domain/booking.utils";
import { WhatsAppTransactionalNotificationService } from "../../integrations/whatsapp/services/whatsapp-transactional-notification.service";
import { WhatsAppModule } from "../../integrations/whatsapp/whatsapp.module";
import { NotificationWorker, type NotificationJob } from "./notification.worker";

/**
 * Stay confirmation {{8}} must carry the check-in code already stored on the
 * booking (`booking_bookings.checkInCode`), the same value the check-in QR
 * encodes and the counter verifies.
 *
 * The worker's booking lookup is emulated with Mongoose's real projection
 * rules applied to the worker's exact `select()` string, so a projection that
 * silently drops the field fails here. No database is needed and `fetch` is
 * mocked, so no WhatsApp message is sent.
 */

const ProjectionProbe: Model<any> =
  (models.CheckInCodeProjectionProbe as Model<any>) ??
  model("CheckInCodeProjectionProbe", BookingSchema);

/** The projection Mongoose would send to MongoDB for this select string. */
const projectionFor = (select: string): Record<string, unknown> => {
  const query: any = ProjectionProbe.findById(new Types.ObjectId()).select(select);
  query._applyPaths();
  return { ...(query._fields ?? {}) };
};

/** Returns the stored document the way MongoDB would, given that projection. */
const applyProjection = (
  doc: Record<string, any>,
  projection: Record<string, unknown>,
  populatedRoots: string[],
): Record<string, any> => {
  const keys = Object.keys(projection);
  const inclusive = keys.some((key) => projection[key] === 1 || projection[key] === true);
  if (!inclusive) return { ...doc };
  const out: Record<string, any> = { _id: doc._id };
  // Mongoose adds populated paths to an inclusive projection itself.
  for (const key of [...keys, ...populatedRoots]) {
    const root = key.split(".")[0];
    if (root in doc) out[root] = doc[root];
  }
  return out;
};

const STORED_CODE = "4060";
const BOOKING_REFERENCE = "TRV-MU2HJWUJ-6A320";

const storedBooking = (overrides: Record<string, any> = {}) => ({
  _id: "booking-1",
  bookingId: BOOKING_REFERENCE,
  checkInCode: STORED_CODE,
  checkInDate: new Date("2026-09-15T06:30:00.000Z"),
  checkOutDate: new Date("2026-09-16T05:30:00.000Z"),
  guestsCount: 1,
  roomsBookedCount: 1,
  pricing: { amountPaid: 1, totalAmount: 1, currency: "INR" },
  ashramId: { name: "Prem Mandir Dharamshala", address: { city: "Vrindavan" } },
  customerId: { name: "Satyam Pandey" },
  rooms: [{ roomId: { name: "Standard Room" }, units: 1 }],
  status: "confirmed",
  ...overrides,
});

const lookupChain = (row: unknown) => {
  const chain: any = {
    select: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    populate: jest.fn(() => chain),
    lean: jest.fn().mockResolvedValue(row),
  };
  return chain;
};

/** A Booking model whose lean() honours the worker's real projection. */
const projectingBookings = (doc: Record<string, any>, captured: { select?: string }) => ({
  findById: jest.fn(() => {
    const populated: string[] = [];
    const chain: any = {
      select: jest.fn((fields: string) => {
        captured.select = String(fields);
        return chain;
      }),
      populate: jest.fn((path: string) => {
        populated.push(String(path));
        return chain;
      }),
      sort: jest.fn(() => chain),
      lean: jest.fn(async () =>
        applyProjection(doc, projectionFor(captured.select ?? ""), populated),
      ),
    };
    return chain;
  }),
});

const ENV = {
  WHATSAPP_ENABLED: "true",
  WHATSAPP_DRY_RUN: "false",
  WHATSAPP_ACCESS_TOKEN: "test-meta-token",
  WHATSAPP_PHONE_NUMBER_ID: "123456789",
  WHATSAPP_BUSINESS_ACCOUNT_ID: "987654321",
  WHATSAPP_API_VERSION: "v23.0",
  WHATSAPP_META_TEMPLATE_STAY_CONFIRMED: "tirvona_stay_confirmed",
} as const;
const UNSET = [
  "WHATSAPP_TEST_MODE",
  "WHATSAPP_TEST_RECIPIENTS",
  "AK_NEXUS_API_BASE_URL",
  "AK_NEXUS_API_TOKEN",
  "AK_NEXUS_ACCOUNT_ID",
  "MSG91_WHATSAPP_ENABLED",
] as const;
const touched = [...Object.keys(ENV), ...UNSET];
const originalEnv = Object.fromEntries(touched.map((key) => [key, process.env[key]]));

const job: NotificationJob = {
  domain: "booking",
  notificationId: "notification-1",
  userId: "customer-1",
  bookingId: "booking-1",
  event: "booking_confirmed",
  title: "Booking confirmed",
  message: `Your booking ${BOOKING_REFERENCE} is confirmed.`,
  channel: "in_app",
  phone: "919876543210",
  correlationId: "booking:booking-1:confirmed",
};

describe("Stay confirmation WhatsApp {{8}} carries the stored check-in code", () => {
  let module: TestingModule;
  let fetchMock: jest.SpyInstance;
  let logLines: string[];

  beforeEach(async () => {
    Object.assign(process.env, ENV);
    for (const key of UNSET) delete process.env[key];
    fetchMock = jest.spyOn(global, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), {
          status: 200,
        }),
    );
    logLines = [];
    for (const level of ["log", "warn", "error", "debug", "verbose"] as const)
      jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        logLines.push(args.map(String).join(" "));
      });
    module = await Test.createTestingModule({ imports: [WhatsAppModule] }).compile();
  });

  afterEach(async () => {
    await module.close();
    jest.restoreAllMocks();
    for (const key of touched) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  /** Runs one outbox job through the real worker and returns the Meta body. */
  const deliver = async (doc: Record<string, any>) => {
    const captured: { select?: string } = {};
    const outboxRow = {
      findById: jest.fn(() =>
        lookupChain({ bookingId: "booking-1", recipientPhone: "919876543210", meta: {} }),
      ),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const empty = { findById: jest.fn(() => lookupChain(null)), findOne: jest.fn(() => lookupChain(null)) };
    const worker = new NotificationWorker(
      outboxRow as never,
      outboxRow as never,
      outboxRow as never,
      { findById: jest.fn(() => lookupChain({ name: "Satyam Pandey", phone: "9876543210" })) } as never,
      projectingBookings(doc, captured) as never,
      empty as never,
      empty as never,
      outboxRow as never,
      empty as never,
      empty as never,
      outboxRow as never,
      empty as never,
      empty as never,
      { send: jest.fn() } as never,
      { sendToUser: jest.fn() } as never,
      { get: jest.fn() } as never,
      module.get(WhatsAppTransactionalNotificationService) as never,
    );
    await worker.process({ data: job, id: "job-1" } as never);
    const metaCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("graph.facebook.com"),
    );
    const body = metaCalls.length ? JSON.parse(String(metaCalls[0][1]?.body)) : null;
    return { body, select: captured.select ?? "", outboxRow };
  };

  const params = (body: any): string[] =>
    body.template.components[0].parameters.map((p: { text: string }) => p.text);

  it("A: a confirmed stay sends its exact stored check-in code as {{8}}", async () => {
    const { body } = await deliver(storedBooking());
    expect(body.template.name).toBe("tirvona_stay_confirmed");
    expect(params(body)).toHaveLength(8);
    expect(params(body)[7]).toBe(STORED_CODE);
    expect(params(body)[2]).toBe(BOOKING_REFERENCE);
  });

  it("B: {{8}} is the same code the check-in QR encodes and the counter verifies", async () => {
    const doc = storedBooking();
    const { body } = await deliver(doc);
    // SelfBookingService.checkInQr renders checkInQrPayload(bookingId, checkInCode).
    const qrPayload = checkInQrPayload(doc.bookingId, doc.checkInCode);
    expect(checkInQrPayload(params(body)[2], params(body)[7])).toBe(qrPayload);
    expect(qrPayload).toBe(`TIRVONA:${BOOKING_REFERENCE}:${STORED_CODE}`);
  });

  it("C: a legacy booking with no stored code falls back to a safe dash", async () => {
    const { checkInCode: _omit, ...legacy } = storedBooking();
    void _omit;
    const { body } = await deliver(legacy);
    expect(params(body)[7]).toBe("-");
  });

  it("D: the worker's booking projection keeps the canonical checkInCode field", async () => {
    const { select } = await deliver(storedBooking());
    expect(projectionFor(select)).toHaveProperty("checkInCode");
    // A "+checkInCode" prefix is dropped by Mongoose for a field that is not
    // select:false, which is exactly how {{8}} became "-".
    expect(projectionFor("+checkInCode bookingId")).not.toHaveProperty("checkInCode");
  });

  it("never writes the check-in code to the logs", async () => {
    await deliver(storedBooking());
    expect(logLines.join("\n")).not.toContain(STORED_CODE);
  });
});
