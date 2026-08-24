import { BookingSchema } from "../infrastructure/persistence/booking.schemas";
import {
  BookingPaymentSchema,
  BookingTransactionSchema,
} from "../infrastructure/persistence/booking-finance.schemas";
import { BookingInventorySchema } from "../../ashrams/infrastructure/persistence/ashram.schemas";
import { BOOKING_SOURCES } from "../domain/booking.utils";

describe("Tirvona and self bookings stay separable", () => {
  it("defaults every existing booking to the Tirvona source", () => {
    const path = BookingSchema.path("bookingSource") as any;
    expect(path).toBeDefined();
    expect(path.options.default).toBe("tirvona");
    expect(path.options.enum).toEqual([...BOOKING_SOURCES]);
  });

  it("indexes the source alongside the ashram so reports stay cheap", () => {
    const indexed = BookingSchema.indexes().map(([fields]: any) =>
      Object.keys(fields).join(","),
    );
    expect(indexed).toContain("ashramId,bookingSource,createdAt");
  });

  it("tags payments with their source and who collected them", () => {
    expect(BookingPaymentSchema.path("bookingSource")).toBeDefined();
    expect(BookingPaymentSchema.path("collectedBy")).toBeDefined();
    expect(
      (BookingPaymentSchema.path("bookingSource") as any).options.default,
    ).toBe("tirvona");
  });

  it("tags finance transactions with their source", () => {
    expect(BookingTransactionSchema.path("bookingSource")).toBeDefined();
  });

  it("keeps a separate offline tally on daily inventory", () => {
    expect(BookingInventorySchema.path("offlineBookedCount")).toBeDefined();
    expect(BookingInventorySchema.path("onlineBookedCount")).toBeDefined();
  });

  it("records walk-in guest identity on the booking itself", () => {
    expect(BookingSchema.path("walkInGuest.name")).toBeDefined();
    expect(BookingSchema.path("walkInGuest.phone")).toBeDefined();
    expect(BookingSchema.path("walkInGuest.idNumber")).toBeDefined();
    expect(BookingSchema.path("bookedBy")).toBeDefined();
  });

  it("still allows the offline payment mode used by walk-ins", () => {
    const mode = BookingSchema.path("paymentMode") as any;
    expect(mode.options.enum).toContain("offline");
  });
});
