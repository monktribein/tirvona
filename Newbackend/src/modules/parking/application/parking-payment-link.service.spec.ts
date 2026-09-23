import {
  BadRequestException,
  ConflictException,
  GoneException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ParkingPaymentLinkService } from "./parking-payment-link.service";

const JWT = "j".repeat(48);
const BOOKING_ID = "507f1f77bcf86cd799439011";

const query = <T>(value: T) => {
  const q: any = {
    populate: () => q,
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

const bookingRow = (extra: Record<string, unknown> = {}): any => ({
  _id: BOOKING_ID,
  bookingReference: "TVN-PKG-ABCD1234",
  whatsappCustomerId: "wa-1",
  customerId: null,
  status: "pending",
  paymentStatus: "pending",
  reservationExpiresAt: new Date(Date.now() + 8 * 60_000),
  entryAt: new Date(Date.now() + 3_600_000),
  exitAt: new Date(Date.now() + 7_200_000),
  durationHours: 1,
  vehicleType: "car",
  vehicleNumber: "UP32AB1234",
  locationId: { name: "Prem Mandir Parking", address: { city: "Vrindavan" } },
  slotTypeId: { name: "Covered Bay" },
  pricing: {
    baseFee: 50,
    durationAmount: 30,
    subtotal: 80,
    taxPercent: 18,
    taxAmount: 14,
    totalAmount: 94,
    currency: "INR",
  },
  ...extra,
});

const build = (
  row: any = bookingRow(),
  config: Record<string, unknown> = { jwtSecret: JWT, frontendUrl: "https://tirvona.com" },
) => {
  const model: any = {
    findById: jest.fn(() => query(row)),
    updateOne: jest.fn(async (_filter: any, update: any) => {
      Object.assign(row, update.$set);
      return { modifiedCount: 1 };
    }),
  };
  const parking: any = {
    createPaymentOrderFor: jest.fn(async () => ({
      demo: false,
      data: { orderId: "order_A", amount: 9_400, currency: "INR", keyId: "rzp_key" },
    })),
    confirmPaymentFor: jest.fn(async () => ({})),
  };
  const service = new ParkingPaymentLinkService(
    { get: (key: string) => config[key] } as any,
    parking,
    model,
  );
  return { service, model, parking, row };
};

const tokenOf = (url: string) => url.split("/parking/pay/")[1];

describe("issuing a parking payment link", () => {
  it("issues a link on the public parking payment page for a booking the guest owns", async () => {
    const { service } = build();
    const link = await service.issue(
      { userId: null, whatsappCustomerId: "wa-1" } as any,
      BOOKING_ID,
    );
    expect(link.url).toMatch(/^https:\/\/tirvona\.com\/parking\/pay\/[\w-]+\.[\w-]+$/);
    expect(link.amount).toBe(94);
    expect(link.reference).toBe("TVN-PKG-ABCD1234");
  });

  it("refuses a booking that is not the actor's own", async () => {
    const { service } = build();
    await expect(
      service.issue({ userId: "someone-else", whatsappCustomerId: null } as any, BOOKING_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it("expires with the bay hold when sooner than 30 minutes", async () => {
    const hold = new Date(Date.now() + 5 * 60_000);
    const { service } = build(bookingRow({ reservationExpiresAt: hold }));
    const link = await service.issue(
      { userId: null, whatsappCustomerId: "wa-1" } as any,
      BOOKING_ID,
    );
    expect(link.expiresAt.getTime()).toBe(hold.getTime());
  });

  it("refuses to issue a link for an already-paid booking", async () => {
    const { service } = build(bookingRow({ paymentStatus: "paid" }));
    await expect(
      service.issue({ userId: null, whatsappCustomerId: "wa-1" } as any, BOOKING_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it("does not open a Razorpay order when the link is made", async () => {
    const { service, parking } = build();
    await service.issue({ userId: null, whatsappCustomerId: "wa-1" } as any, BOOKING_ID);
    expect(parking.createPaymentOrderFor).not.toHaveBeenCalled();
  });
});

describe("resolving a parking payment token", () => {
  it("refuses a tampered token", async () => {
    const { service } = build();
    await expect(service.summary("not-a-real-token")).rejects.toThrow(NotFoundException);
  });

  it("refuses a stay payment token here — the purposes are distinct", async () => {
    const { service: parkingLink } = build();
    // Build a stay token with the same key material via the stays service,
    // to prove cross-purpose tokens are rejected rather than silently reused.
    const { signPaymentLink, PAYMENT_LINK_PURPOSE, PAYMENT_LINK_VERSION, paymentLinkKey } =
      jest.requireActual("../../bookings/domain/payment-link-token");
    const key = paymentLinkKey({ jwtSecret: JWT });
    const stayToken = signPaymentLink(
      {
        v: PAYMENT_LINK_VERSION,
        p: PAYMENT_LINK_PURPOSE,
        b: BOOKING_ID,
        j: "some-jti",
        iat: Date.now(),
        exp: Date.now() + 60_000,
      },
      key,
    );
    await expect(parkingLink.summary(stayToken)).rejects.toThrow(NotFoundException);
  });

  it("says a link expired rather than merely invalid", async () => {
    const { service } = build();
    const link = await service.issue(
      { userId: null, whatsappCustomerId: "wa-1" } as any,
      BOOKING_ID,
    );
    const past = jest
      .spyOn(Date, "now")
      .mockReturnValue(Date.parse(link.expiresAt.toISOString()) + 1);
    await expect(service.summary(tokenOf(link.url))).rejects.toThrow(GoneException);
    past.mockRestore();
  });

  it("says a superseded link was replaced", async () => {
    const { service } = build();
    const first = await service.issue(
      { userId: null, whatsappCustomerId: "wa-1" } as any,
      BOOKING_ID,
    );
    await service.issue({ userId: null, whatsappCustomerId: "wa-1" } as any, BOOKING_ID);
    await expect(service.summary(tokenOf(first.url))).rejects.toThrow(GoneException);
  });

  it("shows a masked vehicle number, not the full plate", async () => {
    const { service } = build();
    const link = await service.issue(
      { userId: null, whatsappCustomerId: "wa-1" } as any,
      BOOKING_ID,
    );
    const summary = await service.summary(tokenOf(link.url));
    expect(summary.vehicleNumber).not.toBe("UP32AB1234");
    expect(summary.vehicleNumber).toContain("UP32");
  });

  it("refuses to sign or verify with no key configured", async () => {
    const { service } = build(bookingRow(), {});
    await expect(
      service.issue({ userId: null, whatsappCustomerId: "wa-1" } as any, BOOKING_ID),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});

describe("paying through a parking link", () => {
  it("opens the order through the booking's own actor, amount from the booking", async () => {
    const { service, parking } = build();
    const link = await service.issue(
      { userId: null, whatsappCustomerId: "wa-1" } as any,
      BOOKING_ID,
    );
    const order = await service.createOrder(tokenOf(link.url));
    expect(order.amount).toBe(9_400);
    expect(parking.createPaymentOrderFor).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappCustomerId: "wa-1" }),
      BOOKING_ID,
    );
  });

  it("refuses to open an order for an already-paid booking", async () => {
    const row = bookingRow();
    const { service } = build(row);
    const link = await service.issue(
      { userId: null, whatsappCustomerId: "wa-1" } as any,
      BOOKING_ID,
    );
    row.paymentStatus = "paid";
    await expect(service.createOrder(tokenOf(link.url))).rejects.toThrow(ConflictException);
  });

  it("refuses a simulated order in production-like config (no Razorpay secret)", async () => {
    const row = bookingRow();
    const { service, parking } = build(row);
    parking.createPaymentOrderFor.mockResolvedValueOnce({
      demo: true,
      data: { amount: 94 },
    });
    const link = await service.issue(
      { userId: null, whatsappCustomerId: "wa-1" } as any,
      BOOKING_ID,
    );
    await expect(service.createOrder(tokenOf(link.url))).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it("confirms through confirmPaymentFor with the booking's own actor", async () => {
    const { service, parking } = build();
    const link = await service.issue(
      { userId: null, whatsappCustomerId: "wa-1" } as any,
      BOOKING_ID,
    );
    const result = await service.confirm(tokenOf(link.url), {
      razorpay_order_id: "order_A",
      razorpay_payment_id: "pay_A",
      razorpay_signature: "sig",
    });
    expect(result.status).toBe("paid");
    expect(parking.confirmPaymentFor).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappCustomerId: "wa-1" }),
      BOOKING_ID,
      expect.objectContaining({ razorpay_order_id: "order_A" }),
    );
  });

  it("treats an already-confirmed booking (ConflictException) as success, not a failure", async () => {
    const { service, parking } = build();
    parking.confirmPaymentFor.mockRejectedValueOnce(
      new ConflictException("This booking is already paid."),
    );
    const link = await service.issue(
      { userId: null, whatsappCustomerId: "wa-1" } as any,
      BOOKING_ID,
    );
    const result = await service.confirm(tokenOf(link.url), {
      razorpay_order_id: "order_A",
      razorpay_payment_id: "pay_A",
      razorpay_signature: "sig",
    });
    expect(result.status).toBe("paid");
  });
});
