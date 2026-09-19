import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
// @ts-expect-error jsqr does not ship TS declarations
import jsQR from "jsqr";
import { WhatsAppTransactionalNotificationService } from "../../integrations/whatsapp/services/whatsapp-transactional-notification.service";
import { WhatsAppModule } from "../../integrations/whatsapp/whatsapp.module";
import { ParkingScanService } from "../parking/application/parking-scan.service";
import {
  hashParkingQr,
  openParkingQr,
  sealParkingQr,
} from "../parking/domain/parking.utils";
import { NotificationWorker, type NotificationJob } from "./notification.worker";

/**
 * End to end for the parking confirmation QR: real worker, real WhatsApp module
 * and a real sealed parking credential. The uploaded PNG is decoded with jsQR
 * and handed to the real gate scanner resolver. `fetch` is mocked throughout,
 * so no WhatsApp message is sent.
 */

jest.setTimeout(60_000);

const { PNG } = jest.requireActual<{
  PNG: { sync: { read(data: Buffer): { width: number; height: number; data: Buffer } } };
}>("pngjs");

const decodeQr = (png: Buffer): string | undefined => {
  const image = PNG.sync.read(png);
  return jsQR(new Uint8ClampedArray(image.data), image.width, image.height)?.data;
};

const ENV = {
  WHATSAPP_ENABLED: "true",
  WHATSAPP_DRY_RUN: "false",
  WHATSAPP_ACCESS_TOKEN: "test-meta-token",
  WHATSAPP_PHONE_NUMBER_ID: "123456789",
  WHATSAPP_BUSINESS_ACCOUNT_ID: "987654321",
  WHATSAPP_API_VERSION: "v23.0",
  WHATSAPP_META_TEMPLATE_PARKING_CONFIRMED: "tirvona_parking_confirmed",
  PARKING_QR_SECRET: "test-parking-qr-secret-for-automated-tests-only",
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

const BOOKING_ID = "parking-booking-1";
const LOCATION_ID = "loc-1";
const REFERENCE = "TVN-PKG-H7EQE3VJ";
const GATE_CODE = "1CNC-AKPC";
const MEDIA_ID = "media-parking-qr-1";

const lookupChain = (row: unknown) => {
  const chain: any = {
    select: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    populate: jest.fn(() => chain),
    session: jest.fn(() => chain),
    lean: jest.fn().mockResolvedValue(row),
    then: undefined,
  };
  return chain;
};

describe("Parking confirmation WhatsApp QR (fetch mocked, nothing sent)", () => {
  let module: TestingModule;
  let fetchMock: jest.SpyInstance;
  let logLines: string[];
  let token: string;
  let storedQr: Record<string, any>;

  beforeEach(async () => {
    Object.assign(process.env, ENV);
    for (const key of UNSET) delete process.env[key];

    const now = Date.now();
    token = sealParkingQr({
      v: 1,
      b: BOOKING_ID,
      r: REFERENCE,
      l: LOCATION_ID,
      u: "user-1",
      n: "UP32AB1234",
      e: new Date(now + 60_000),
      x: new Date(now + 4 * 3_600_000),
      vf: new Date(now - 3_600_000),
      vu: new Date(now + 5 * 3_600_000),
      d: GATE_CODE,
      ver: 1,
    });
    storedQr = {
      _id: "qr-1",
      bookingId: BOOKING_ID,
      locationId: LOCATION_ID,
      tokenHash: hashParkingQr(token),
      token,
      displayCode: GATE_CODE,
      version: 1,
      status: "active",
      validFrom: new Date(now - 3_600_000),
      validUntil: new Date(now + 5 * 3_600_000),
    };

    let messageCount = 0;
    fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (url) =>
      String(url).endsWith("/media")
        ? new Response(JSON.stringify({ id: MEDIA_ID }), { status: 200 })
        : new Response(
            JSON.stringify({ messages: [{ id: `wamid.${++messageCount}` }] }),
            { status: 200 },
          ),
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

  const qrModel = () => ({
    findOne: jest.fn(() => lookupChain(storedQr)),
    create: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
  });

  /** Runs one parking booking_confirmed job through the real worker. */
  const deliver = async (
    rowMeta: Record<string, unknown> = {},
    qrCodes = qrModel(),
  ) => {
    const parkingRows = {
      findById: jest.fn(() =>
        lookupChain({ bookingId: BOOKING_ID, recipientPhone: "919811111111", meta: rowMeta }),
      ),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const empty = {
      findById: jest.fn(() => lookupChain(null)),
      findOne: jest.fn(() => lookupChain(null)),
      updateOne: jest.fn(),
    };
    const parkingBookings = {
      findById: jest.fn(() =>
        lookupChain({
          _id: BOOKING_ID,
          bookingReference: REFERENCE,
          vehicleNumber: "UP32AB1234",
          entryAt: new Date("2026-09-15T04:30:00.000Z"),
          exitAt: new Date("2026-09-15T08:30:00.000Z"),
          pricing: { amountPaid: 50, currency: "INR" },
          locationId: { name: "North Gate", address: { city: "Haridwar" } },
          driverPhone: "9811111111",
        }),
      ),
    };
    const worker = new NotificationWorker(
      empty as never,
      parkingRows as never,
      empty as never,
      { findById: jest.fn(() => lookupChain({ name: "Driver", phone: "9876543210" })) } as never,
      empty as never,
      parkingBookings as never,
      qrCodes as never,
      empty as never,
      empty as never,
      empty as never,
      empty as never,
      empty as never,
      empty as never,
      { send: jest.fn() } as never,
      { sendToUser: jest.fn() } as never,
      { get: jest.fn() } as never,
      module.get(WhatsAppTransactionalNotificationService) as never,
    );
    const job: NotificationJob = {
      domain: "parking",
      notificationId: "notification-1",
      userId: "user-1",
      bookingId: BOOKING_ID,
      event: "booking_confirmed",
      title: "Parking Confirmed",
      message: `Your parking booking ${REFERENCE} is confirmed.`,
      channel: "in_app",
      correlationId: `parking:${BOOKING_ID}:confirmed`,
    };
    await worker.process({ data: job, id: "job-1" } as never);
    return { parkingRows, qrCodes };
  };

  const graphCalls = () =>
    fetchMock.mock.calls.filter(([url]) => String(url).includes("graph.facebook.com"));

  const uploadedPng = async (): Promise<Buffer> => {
    const upload = graphCalls().find(([url]) => String(url).endsWith("/media"));
    const file = (upload?.[1]?.body as FormData).get("file") as File;
    return Buffer.from(await file.arrayBuffer());
  };

  it("A-C: sends the approved template, then the QR as a follow-up image", async () => {
    const { parkingRows } = await deliver();
    const calls = graphCalls();
    expect(calls.map(([url]) => String(url).split("/").pop())).toEqual([
      "messages",
      "media",
      "messages",
    ]);

    const template = JSON.parse(String(calls[0][1]?.body));
    expect(template.to).toBe("919811111111");
    expect(template.template.name).toBe("tirvona_parking_confirmed");
    expect(template.template.language).toEqual({ code: "en" });

    const image = JSON.parse(String(calls[2][1]?.body));
    expect(image).toMatchObject({
      to: "919811111111",
      type: "image",
      image: { id: MEDIA_ID },
    });
    expect(image.image.caption).toContain(REFERENCE);

    expect(parkingRows.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "notification-1" }),
      expect.objectContaining({
        $set: expect.objectContaining({
          "meta.whatsappStatus": "sent",
          "meta.whatsappQrStatus": "accepted",
        }),
      }),
    );
  });

  it("D: the delivered QR image decodes to exactly the stored parking credential", async () => {
    await deliver();
    const decoded = decodeQr(await uploadedPng());
    expect(decoded).toBe(token);
    expect(decoded).toBe(storedQr.token);
    expect(hashParkingQr(decoded!)).toBe(storedQr.tokenHash);
    expect(openParkingQr(decoded!)).toMatchObject({ b: BOOKING_ID, d: GATE_CODE, ver: 1 });
  });

  it("E-F: the decoded QR is accepted by the gate resolver used for entry and exit", async () => {
    await deliver();
    const decoded = decodeQr(await uploadedPng())!;

    const qrCodes = { findOne: jest.fn(() => lookupChain(storedQr)) };
    const booking = { _id: BOOKING_ID, bookingReference: REFERENCE, status: "upcoming" };
    const bookings = { findById: jest.fn(() => ({ session: jest.fn().mockResolvedValue(booking) })) };
    // The chain's session() resolves the stored QR document, as Mongoose would.
    qrCodes.findOne.mockImplementation(() => {
      const chain: any = { sort: jest.fn(() => chain), session: jest.fn().mockResolvedValue(storedQr) };
      return chain;
    });
    const scanner = new ParkingScanService(
      {} as never, {} as never, {} as never, {} as never,
      qrCodes as never, bookings as never,
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    );

    // checkIn and checkOut both authenticate a scanned token through this.
    const resolved = await (scanner as any).resolveToken(decoded, LOCATION_ID);
    expect(qrCodes.findOne).toHaveBeenCalledWith({ tokenHash: storedQr.tokenHash });
    expect(resolved.qr).toBe(storedQr);
    expect(resolved.booking).toBe(booking);
  });

  it("G: the gate code in the template and caption is the stored one, unchanged", async () => {
    await deliver();
    const calls = graphCalls();
    const params = JSON.parse(String(calls[0][1]?.body)).template.components[0].parameters;
    expect(params[6].text).toBe(GATE_CODE);
    expect(JSON.parse(String(calls[2][1]?.body)).image.caption).toContain(`Gate code: ${GATE_CODE}`);
    expect(storedQr.displayCode).toBe(GATE_CODE);
  });

  it("H: a retry sends nothing again and no path re-issues the credential", async () => {
    const qrCodes = qrModel();
    await deliver({}, qrCodes);
    const firstDecoded = decodeQr(await uploadedPng());
    const callsAfterFirst = graphCalls().length;

    // BullMQ retry of the same row after WhatsApp was recorded as sent.
    await deliver({ whatsappStatus: "sent" }, qrCodes);
    expect(graphCalls()).toHaveLength(callsAfterFirst);

    // A second, separate notification row renders the very same credential.
    fetchMock.mockClear();
    await deliver({}, qrCodes);
    expect(decodeQr(await uploadedPng())).toBe(firstDecoded);

    expect(qrCodes.create).not.toHaveBeenCalled();
    expect(qrCodes.updateOne).not.toHaveBeenCalled();
    expect(qrCodes.updateMany).not.toHaveBeenCalled();
    expect(storedQr.token).toBe(token);
  });

  it("sends the template but no QR image for a revoked pass", async () => {
    storedQr.status = "revoked";
    await deliver();
    expect(graphCalls().map(([url]) => String(url).split("/").pop())).toEqual(["messages"]);
  });

  it("never logs the parking credential or the media id", async () => {
    await deliver();
    const output = logLines.join("\n");
    expect(output).not.toContain(token);
    expect(output).not.toContain(MEDIA_ID);
    expect(output).not.toContain("test-meta-token");
  });
});
