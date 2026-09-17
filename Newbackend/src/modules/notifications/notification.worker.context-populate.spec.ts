import type { Schema } from "mongoose";
import { BookingSchema } from "../bookings/infrastructure/persistence/booking.schemas";
import { ParkingBookingSchema } from "../parking/infrastructure/persistence/parking-operation.schemas";
import { AartiBookingSchema } from "../aarti/infrastructure/persistence/aarti-operation.schemas";
import { EventRegistrationSchema } from "../events/infrastructure/persistence/event.schemas";
import { NotificationWorker, type NotificationJob } from "./notification.worker";

/**
 * The other worker specs mock every lookup, so a populate path that does not
 * exist on the real schema slipped through and failed every stay notification
 * in a live run ("Cannot populate path `roomId`..."). These tests capture the
 * exact select/populate calls the worker makes and check each one against the
 * real Mongoose schema, with no database needed.
 */

interface Captured {
  selects: string[];
  populates: string[];
}

const capturingChain = (captured: Captured, row: unknown) => {
  const chain: any = {
    select: jest.fn((fields: string) => {
      captured.selects.push(String(fields));
      return chain;
    }),
    sort: jest.fn(() => chain),
    populate: jest.fn((path: string) => {
      captured.populates.push(String(path));
      return chain;
    }),
    lean: jest.fn().mockResolvedValue(row),
  };
  return chain;
};

const plainChain = (row: unknown) => capturingChain({ selects: [], populates: [] }, row);

const notificationModel = (row: Record<string, unknown>) => ({
  findById: jest.fn(() =>
    plainChain({ recipientPhone: "919876543210", meta: {}, ...row }),
  ),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
});

/** A path is valid when the schema knows it, including document-array sub-paths. */
const schemaHasPath = (schema: Schema, path: string): boolean =>
  Boolean(schema.path(path)) || schema.pathType(path) !== "adhocOrUndefined";

const runDomain = async (
  domain: NotificationJob["domain"],
): Promise<Captured> => {
  const captured: Captured = { selects: [], populates: [] };
  const booking = {
    _id: "booking-1",
    bookingId: "TRV-1",
    bookingReference: "REF-1",
    registrationReference: "EVT-1",
  };
  const contextModel = { findById: jest.fn(() => capturingChain(captured, booking)) };
  const emptyById = { findById: jest.fn(() => plainChain(null)) };
  const qr = { findOne: jest.fn(() => plainChain({ displayCode: "CODE-1" })) };
  const row = notificationModel({
    bookingId: "booking-1",
    registrationId: "booking-1",
  });

  const worker = new NotificationWorker(
    row as never, // booking notifications
    row as never, // parking notifications
    row as never, // community notifications
    { findById: jest.fn(() => plainChain({ name: "Pilgrim", phone: "9876543210" })) } as never,
    (domain === "booking" ? contextModel : emptyById) as never,
    (domain === "parking" ? contextModel : emptyById) as never,
    qr as never,
    row as never, // aarti notifications
    (domain === "aarti" ? contextModel : emptyById) as never,
    qr as never,
    row as never, // event notifications
    (domain === "event" ? contextModel : emptyById) as never,
    qr as never,
    { send: jest.fn() } as never,
    { sendToUser: jest.fn() } as never,
    { get: jest.fn() } as never,
    {
      sendOutboxEvent: jest
        .fn()
        .mockResolvedValue({ status: "accepted", provider: "meta_cloud" }),
    } as never,
  );

  await worker.process({
    data: {
      domain,
      notificationId: "notification-1",
      userId: "customer-1",
      bookingId: "booking-1",
      event: domain === "event" ? "registration_confirmed" : "booking_confirmed",
      title: "Confirmed",
      message: "Confirmed",
      channel: "in_app",
      phone: "919876543210",
    },
    id: "job-1",
  } as never);
  return captured;
};

describe("NotificationWorker booking context lookups match the real schemas", () => {
  it.each([
    ["booking", BookingSchema],
    ["parking", ParkingBookingSchema],
    ["aarti", AartiBookingSchema],
    ["event", EventRegistrationSchema],
  ] as const)(
    "%s: every populated path exists on the schema",
    async (domain, schema) => {
      const captured = await runDomain(domain);
      expect(captured.populates.length).toBeGreaterThan(0);
      // Mongoose adds populated paths to an inclusive projection itself
      // (selectPopulatedFields), so only the path's existence is checked.

      for (const path of captured.populates) {
        expect({ path, onSchema: schemaHasPath(schema, path) }).toEqual({
          path,
          onSchema: true,
        });
      }
    },
  );

  it("stay lookups populate the room inside `rooms`, never a top-level roomId", async () => {
    const captured = await runDomain("booking");
    expect(captured.populates).toContain("rooms.roomId");
    expect(captured.populates).not.toContain("roomId");
    expect(schemaHasPath(BookingSchema, "roomId")).toBe(false);
  });
});
