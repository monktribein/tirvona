import { ConflictException, ForbiddenException } from "@nestjs/common";
import { model, Types } from "mongoose";
import type { ConfigService } from "@nestjs/config";
import type { BookingActor } from "../../bookings/domain/booking-customer";
import { actorFromUser } from "../../bookings/domain/booking-customer";
import { RefundRequestSchema } from "../infrastructure/persistence/refund.schemas";
import { RefundsService } from "./refunds.service";

const oid = () => new Types.ObjectId().toString();
const SOURCE_ID = oid();
const USER_ID = oid();
const WA_ID = oid();

const guest: BookingActor = {
  userId: null,
  whatsappCustomerId: WA_ID,
  role: "whatsapp_customer",
  channel: "whatsapp" as any,
};
const staff: BookingActor = actorFromUser({
  id: oid(),
  role: "support",
} as any);

const lean = (value: unknown) => ({ lean: async () => value });

const bookingRow = (extra: Record<string, unknown> = {}) => ({
  _id: SOURCE_ID,
  bookingId: "TRV-9",
  customerId: USER_ID,
  ashramId: oid(),
  status: "cancelled",
  checkInDate: new Date(Date.now() + 72 * 3_600_000),
  pricing: {
    amountPaid: 2000,
    basePrice: 1500,
    servicesPrice: 200,
    platformFee: 250,
    gstAmount: 50,
  },
  cancellation: { refundAmount: 1600 },
  ...extra,
});

const build = (
  opts: { booking?: any; bookingRefund?: any; policy?: any } = {},
) => {
  const created: any[] = [];
  const requests = {
    create: jest.fn(async (doc: any) => {
      const saved = { ...doc, _id: oid(), save: jest.fn() };
      created.push(saved);
      return saved;
    }),
    findOne: jest.fn(() => {
      const q: any = {
        populate: () => q,
        sort: () => q,
        lean: async () =>
          created[0] ?? null,
      };
      return q;
    }),
  };
  const calculations = {
    create: jest.fn(async (doc: any) => ({ ...doc, _id: oid() })),
  };
  const history = {
    create: jest.fn(),
    find: jest.fn(() => ({ sort: () => ({ lean: async () => [] }) })),
  };
  const audit = { create: jest.fn() };
  const notifications = { create: jest.fn() };
  const bookings: any = {
    findById: jest.fn(() => lean("booking" in opts ? opts.booking : bookingRow())),
    db: {
      models: {
        BookingRefund: {
          findOne: jest.fn(() => lean(opts.bookingRefund ?? null)),
        },
      },
    },
  };
  const policies = {
    resolve: jest.fn(async () => ({
      policy: opts.policy ?? {
        cancellationWindows: [{ hoursBefore: 24, refundPercent: 100 }],
        defaultRefundPercent: 0,
        refundPlatformFee: true,
        refundGst: true,
      },
      policyId: oid(),
    })),
  };
  const service = new RefundsService(
    requests as never,
    calculations as never,
    { find: () => ({ sort: () => ({ lean: async () => [] }) }) } as never,
    history as never,
    audit as never,
    bookings as never,
    {} as never,
    notifications as never,
    policies as never,
    { get: jest.fn() } as unknown as ConfigService,
  );
  // `get`/`getOwned` reload through populate chains the mocks do not model;
  // the tests below assert on what was written, not on the reload.
  jest.spyOn(service, "get").mockResolvedValue({} as any);
  jest.spyOn(service, "getOwned").mockResolvedValue({} as any);
  return { service, requests, calculations, history, audit, created, bookings };
};

const dto = {
  module: "ashram_booking",
  sourceId: SOURCE_ID,
  reason: "Cancelled stay",
};

describe("RefundsService for a website user (regression)", () => {
  it("still opens a request for the user's own booking, named by customerId", async () => {
    const { service, created } = build();
    await service.create({ id: USER_ID, role: "customer" } as any, dto);
    expect(created[0]).toMatchObject({
      customerId: USER_ID,
      whatsappCustomerId: null,
      requestedBy: USER_ID,
      requestedByWhatsAppCustomerId: null,
    });
  });

  it("still refuses another account's booking", async () => {
    const { service } = build({ booking: bookingRow({ customerId: oid() }) });
    await expect(
      service.create({ id: USER_ID, role: "customer" } as any, dto),
    ).rejects.toThrow(ForbiddenException);
  });

  it("still lets support raise a request on a customer's behalf", async () => {
    const { service, created } = build();
    await service.create(staff.principal as any, dto);
    expect(created[0].customerId).toBe(USER_ID);
    expect(created[0].requestedBy).toBe(staff.userId);
  });
});

describe("RefundsService for a WhatsApp guest", () => {
  const guestBooking = () =>
    bookingRow({ customerId: undefined, whatsappCustomerId: WA_ID });

  it("opens a request for the guest without any User", async () => {
    const { service, created } = build({ booking: guestBooking() });
    await service.createFor(guest, dto);
    expect(created[0]).toMatchObject({
      customerId: null,
      whatsappCustomerId: WA_ID,
      requestedBy: null,
      requestedByWhatsAppCustomerId: WA_ID,
    });
  });

  it("does not write the string 'undefined' as a customer id", async () => {
    const { service, created } = build({ booking: guestBooking() });
    await service.createFor(guest, dto);
    expect(JSON.stringify(created[0])).not.toContain("undefined");
    expect(created[0].customerId).toBeNull();
  });

  it("records the guest, not a User, in the history and audit trail", async () => {
    const { service, history, audit } = build({ booking: guestBooking() });
    await service.createFor(guest, dto);
    expect(history.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        actorWhatsAppCustomerId: WA_ID,
        actorRole: "whatsapp_customer",
      }),
    );
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "REFUND_REQUESTED",
        actorId: null,
        actorWhatsAppCustomerId: WA_ID,
      }),
    );
  });

  it("refuses a different guest's booking", async () => {
    const { service } = build({
      booking: bookingRow({
        customerId: undefined,
        whatsappCustomerId: oid(),
      }),
    });
    await expect(service.createFor(guest, dto)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("refuses a guest asking about a website user's booking", async () => {
    const { service } = build();
    await expect(service.createFor(guest, dto)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("reads the guest's own request back through their identity, not a User scope", async () => {
    const { service } = build({ booking: guestBooking() });
    await service.createFor(guest, dto);
    expect(service.getOwned).toHaveBeenCalled();
    expect(service.get).not.toHaveBeenCalled();
  });
});

describe("RefundsService uses one authoritative refund decision", () => {
  it("takes the amount BookingsService.cancel already decided", async () => {
    // The RefundPolicy here would give 100% (2000), the cancellation decided
    // 1600. The request must carry the cancellation's figure.
    const { service, created, calculations } = build();
    await service.create({ id: USER_ID, role: "customer" } as any, dto);
    expect(created[0].requestedAmount).toBe(1600);
    expect(calculations.create).toHaveBeenCalledWith(
      expect.objectContaining({ netRefundable: 1600 }),
    );
  });

  it("refuses to open a claim when the cancellation decided on no refund", async () => {
    const { service } = build({
      booking: bookingRow({ cancellation: { refundAmount: 0 } }),
    });
    await expect(
      service.create({ id: USER_ID, role: "customer" } as any, dto),
    ).rejects.toThrow("does not refund anything");
  });

  it("refuses a second claim once the cancellation refund was processed", async () => {
    const { service } = build({ bookingRefund: { status: "success" } });
    await expect(
      service.create({ id: USER_ID, role: "customer" } as any, dto),
    ).rejects.toThrow(ConflictException);
  });

  it("still calculates from the refund policy for a booking that was never cancelled", async () => {
    const { service, created } = build({
      booking: bookingRow({ status: "confirmed", cancellation: undefined }),
    });
    await service.create({ id: USER_ID, role: "customer" } as any, dto);
    expect(created[0].requestedAmount).toBeGreaterThan(0);
  });
});

describe("RefundsService.statusForBooking", () => {
  it("shows a guest the refund state of their own booking", async () => {
    const { service, bookings } = build({
      booking: bookingRow({ customerId: undefined, whatsappCustomerId: WA_ID }),
    });
    bookings.db.models.BookingRefund.findOne = jest.fn(() => ({
      sort: () => lean({ refundReference: "REF-1", amount: 1600, status: "pending" }),
    }));
    const status = await service.statusForBooking(guest, SOURCE_ID);
    expect(status).toMatchObject({
      bookingId: "TRV-9",
      decidedRefundAmount: 1600,
      cancellationRefund: { reference: "REF-1", amount: 1600, status: "pending" },
    });
  });

  it("reports someone else's booking as not found", async () => {
    const { service } = build();
    await expect(service.statusForBooking(guest, SOURCE_ID)).rejects.toThrow(
      "Booking not found",
    );
  });
});

describe("RefundRequest schema identity rule", () => {
  const RefundRequest = model("RefundRequestGuestSpec", RefundRequestSchema);
  const base = () => ({
    refundNumber: `RFD-${oid()}`,
    module: "ashram_booking",
    sourceId: SOURCE_ID,
    reason: "test",
  });

  it("accepts a website customer and requester", async () => {
    await expect(
      new RefundRequest({
        ...base(),
        customerId: USER_ID,
        requestedBy: USER_ID,
      }).validate(),
    ).resolves.toBeUndefined();
  });

  it("accepts a WhatsApp customer and requester with no User at all", async () => {
    await expect(
      new RefundRequest({
        ...base(),
        whatsappCustomerId: WA_ID,
        requestedByWhatsAppCustomerId: WA_ID,
      }).validate(),
    ).resolves.toBeUndefined();
  });

  it("accepts a WhatsApp customer whose request staff raised", async () => {
    await expect(
      new RefundRequest({
        ...base(),
        whatsappCustomerId: WA_ID,
        requestedBy: USER_ID,
      }).validate(),
    ).resolves.toBeUndefined();
  });

  it("rejects a request with no customer identity", async () => {
    await expect(
      new RefundRequest({ ...base(), requestedBy: USER_ID }).validate(),
    ).rejects.toThrow("must belong to either");
  });

  it("rejects a request claiming both identities", async () => {
    await expect(
      new RefundRequest({
        ...base(),
        customerId: USER_ID,
        whatsappCustomerId: WA_ID,
        requestedBy: USER_ID,
      }).validate(),
    ).rejects.toThrow("cannot belong to both");
  });

  it("rejects a request with no requester", async () => {
    await expect(
      new RefundRequest({ ...base(), customerId: USER_ID }).validate(),
    ).rejects.toThrow("exactly one");
  });
});
