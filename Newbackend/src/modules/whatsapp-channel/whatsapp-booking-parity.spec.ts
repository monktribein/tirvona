import { BookingSchema } from "../bookings/infrastructure/persistence/booking.schemas";
import {
  BookingNotificationSchema,
  BookingOfferRedemptionSchema,
} from "../bookings/infrastructure/persistence/booking-support.schemas";
import {
  BookingInvoiceSchema,
  BookingPaymentSchema,
  BookingRefundSchema,
} from "../bookings/infrastructure/persistence/booking-finance.schemas";
import { BookingInventorySchema } from "../ashrams/infrastructure/persistence/ashram.schemas";
import {
  BOOKING_CHANNELS,
  BOOKING_SOURCES,
  DEFAULT_BOOKING_CHANNEL,
} from "../bookings/domain/booking.utils";
import { WhatsAppCustomerSchema } from "./infrastructure/persistence/whatsapp-customer.schema";
import { WhatsAppInboundEventSchema } from "./infrastructure/persistence/whatsapp-inbound-event.schema";
import { WHATSAPP_CUSTOMER_CODE_PATTERN } from "./domain/whatsapp-customer.code";

const indexesOf = (schema: any): string[] =>
  schema.indexes().map(([fields]: any) => Object.keys(fields).join(","));

describe("a WhatsApp booking is an ordinary Tirvona booking", () => {
  it("uses the same collection as a website booking", () => {
    // There is no whatsapp_bookings collection; both channels write here.
    expect((BookingSchema as any).options.collection).toBe("booking_bookings");
  });

  it("does not change what bookingSource means", () => {
    // The owner Booking Centre filters on these two values. Adding a third
    // for WhatsApp would remove those bookings from the owner's default view.
    const source = BookingSchema.path("bookingSource") as any;
    expect(source.options.enum).toEqual([...BOOKING_SOURCES]);
    expect(source.options.default).toBe("tirvona");
    expect(source.options.enum).not.toContain("whatsapp");
  });

  it("records the channel on a separate field that defaults to website", () => {
    const channel = BookingSchema.path("channel") as any;
    expect(channel).toBeDefined();
    expect(channel.options.enum).toEqual([...BOOKING_CHANNELS]);
    expect(channel.options.default).toBe(DEFAULT_BOOKING_CHANNEL);
  });

  it("leaves every existing booking reading as the default channel", () => {
    // No backfill is needed, so deploying this cannot rewrite history.
    expect((BookingSchema.path("channel") as any).options.default).toBe(
      "website",
    );
  });

  it("uses the one shared availability collection", () => {
    // If WhatsApp had its own inventory the two channels could sell the same
    // room twice. There is exactly one.
    expect((BookingInventorySchema as any).options.collection).toBe(
      "booking_daily_availability",
    );
    expect(indexesOf(BookingInventorySchema)).toContain("roomId,date");
  });
});

describe("customer identity on a booking", () => {
  const validate = async (doc: Record<string, unknown>) => {
    const Model = { schema: BookingSchema };
    void Model;
    const instance: any = Object.create(null);
    Object.assign(instance, doc);
    // Exercise the hook directly: it is the rule under test, and building a
    // full mongoose document here would need a live connection.
    const hooks = (BookingSchema as any).s.hooks._pres.get("validate") ?? [];
    for (const hook of hooks) await hook.fn.call(instance);
  };

  it("accepts a booking made by a website account", async () => {
    await expect(
      validate({ customerId: "user-1", whatsappCustomerId: null }),
    ).resolves.toBeUndefined();
  });

  it("accepts a booking made by a WhatsApp customer", async () => {
    await expect(
      validate({ customerId: null, whatsappCustomerId: "wa-1" }),
    ).resolves.toBeUndefined();
  });

  it("refuses a booking with no customer at all", async () => {
    // Relaxing customerId must not let an ownerless booking through — this
    // rule is stricter than the `required` it replaced.
    await expect(
      validate({ customerId: null, whatsappCustomerId: null }),
    ).rejects.toThrow(/must belong to either/);
  });

  it("refuses a booking claiming both identities", async () => {
    await expect(
      validate({ customerId: "user-1", whatsappCustomerId: "wa-1" }),
    ).rejects.toThrow(/cannot belong to both/);
  });

  it("indexes a WhatsApp customer's bookings for My Bookings", () => {
    expect(indexesOf(BookingSchema)).toContain("whatsappCustomerId,createdAt");
  });

  it("indexes the channel per ashram so owner reporting stays cheap", () => {
    expect(indexesOf(BookingSchema)).toContain("ashramId,channel,createdAt");
  });
});

describe("downstream records carry the WhatsApp identity", () => {
  const carriesBoth = (schema: any, accountField: string) => {
    expect(schema.path(accountField)).toBeDefined();
    expect(schema.path(accountField).options.required).toBeFalsy();
    expect(schema.path("whatsappCustomerId")).toBeDefined();
  };

  it("lets the outbox address a guest with no account", () => {
    // Without this the confirmation notification could not be written at all,
    // and a WhatsApp booking would confirm silently.
    carriesBoth(BookingNotificationSchema, "userId");
  });

  it("records the payment against the paying identity", () => {
    carriesBoth(BookingPaymentSchema, "userId");
  });

  it("records the invoice against the booking's identity", () => {
    carriesBoth(BookingInvoiceSchema, "customerId");
  });

  it("records who asked for a refund", () => {
    expect(BookingRefundSchema.path("requestedBy").options.required).toBeFalsy();
    expect(
      BookingRefundSchema.path("requestedByWhatsAppCustomerId"),
    ).toBeDefined();
  });

  it("applies the coupon cap per identity", () => {
    carriesBoth(BookingOfferRedemptionSchema, "userId");
  });
});

describe("the WhatsApp identity itself", () => {
  it("lives in its own collection, not in users", () => {
    expect((WhatsAppCustomerSchema as any).options.collection).toBe(
      "whatsapp_customers",
    );
  });

  it("makes one phone number resolve to one customer, always", () => {
    // The unique index is what enforces this under concurrency: two
    // simultaneous first messages race on it and exactly one wins.
    const phone = WhatsAppCustomerSchema.path("phone") as any;
    expect(phone.options.unique).toBe(true);
    expect(phone.options.required).toBe(true);
    expect(phone.options.immutable).toBe(true);
  });

  it("makes the public code unique and immutable", () => {
    const wappId = WhatsAppCustomerSchema.path("wappId") as any;
    expect(wappId.options.unique).toBe(true);
    expect(wappId.options.immutable).toBe(true);
  });

  it("enforces the human-readable WAPP-YYYYMMDD-XXXXXX shape at the schema level", () => {
    // Asserted through the schema's own validator rather than by comparing
    // regex identity: Mongoose clones the pattern, so the two objects are
    // never the same reference even though they are the same expression.
    const schemaPattern = (WhatsAppCustomerSchema.path("wappId") as any).options
      .match as RegExp;
    expect(schemaPattern.source).toBe(WHATSAPP_CUSTOMER_CODE_PATTERN.source);
    expect("WAPP-20260916-AB12CD").toMatch(schemaPattern);
    // The superseded sequential format must no longer be accepted.
    expect("WAPP1000000").not.toMatch(schemaPattern);
  });

  it("does not link a website account by default", () => {
    // Identities are never merged automatically on phone or name alone.
    expect(
      (WhatsAppCustomerSchema.path("linkedUserId") as any).options.default,
    ).toBeNull();
  });

  it("treats the sender as verified because Meta attests the number", () => {
    expect(
      (WhatsAppCustomerSchema.path("whatsappVerified") as any).options.default,
    ).toBe(true);
  });
});

describe("inbound webhook idempotency", () => {
  it("makes Meta's message id unique", () => {
    // This is what stops a redelivery creating a second booking.
    const messageId = WhatsAppInboundEventSchema.path("messageId") as any;
    expect(messageId.options.unique).toBe(true);
    expect(messageId.options.required).toBe(true);
  });

  it("expires stored chatter rather than keeping it forever", () => {
    const ttl = (WhatsAppInboundEventSchema as any)
      .indexes()
      .find(([, options]: any) => options?.expireAfterSeconds !== undefined);
    expect(ttl).toBeDefined();
  });
});
