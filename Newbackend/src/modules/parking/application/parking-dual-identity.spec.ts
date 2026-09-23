import { ParkingBookingService } from "./parking-booking.service";
import { ParkingException } from "../domain/parking.errors";

jest.mock("razorpay", () => jest.fn());
// The confirm-payment path renders a QR image after settling; that render is
// irrelevant to what these tests check and is slow enough under load to make
// the suite flaky, so it is mocked out.
jest.mock("qrcode", () => ({ toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,x") }));

/**
 * A WhatsApp guest can book, pay for and cancel parking exactly like a
 * website account — same pricing, same inventory hold, same cancellation
 * policy — through the actor-based methods `ParkingBookingService` exposes
 * alongside its unchanged `AuthenticatedUser` ones.
 */
describe("parking booking service: dual identity", () => {
  const guestActor = {
    userId: null,
    whatsappCustomerId: "wa-1",
    role: "whatsapp_customer",
    channel: "whatsapp",
    name: "Ramesh",
    phone: "919999999999",
  } as any;

  const accountActor = {
    userId: "user-1",
    whatsappCustomerId: null,
    role: "customer",
    channel: "website",
    name: "Priya",
    phone: "918888888888",
  } as any;

  const location = {
    _id: "loc-1",
    status: "active",
    partnerId: "partner-1",
  };
  const slotType = {
    _id: "slot-1",
    vehicleTypes: ["car"],
    totalCapacity: 10,
  };
  const dto = {
    locationId: "loc-1",
    slotTypeId: "slot-1",
    vehicleType: "car",
    vehicleNumber: "UP32AB1234",
    entryAt: new Date(Date.now() + 3_600_000).toISOString(),
    exitAt: new Date(Date.now() + 7_200_000).toISOString(),
  };

  const build = () => {
    const created: any[] = [];
    const repository: any = {
      findLocationById: jest.fn().mockResolvedValue(location),
      findSlotType: jest.fn().mockResolvedValue(slotType),
      reserveInventory: jest.fn().mockResolvedValue({ ok: true }),
      releaseInventory: jest.fn().mockResolvedValue(undefined),
      findBooking: jest.fn(),
      findBookingForCustomer: jest.fn(),
    };
    const bookings: any = {
      create: jest.fn(async (docs: any[]) => {
        const doc = { ...docs[0], _id: "507f1f77bcf86cd799439011", save: jest.fn(), history: [] };
        created.push(doc);
        return [doc];
      }),
      findOne: jest.fn(() => ({ session: jest.fn().mockResolvedValue(null) })),
    };
    const pricingService: any = {
      quote: jest.fn().mockResolvedValue({
        ok: true,
        quote: { subtotal: 100, totalAmount: 118 },
        settings: { allowOnlineBooking: true, reservationHoldMinutes: 15 },
      }),
    };
    const transactions: any = { run: jest.fn((work: any) => work({})) };
    const config: any = { get: jest.fn() };
    const payments: any = { create: jest.fn(), findOne: jest.fn() };
    const service = new ParkingBookingService(
      repository,
      transactions,
      pricingService,
      config,
      bookings,
      payments,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { service, repository, bookings, created };
  };

  it("holds a bay for a WhatsApp guest and records the whatsapp source", async () => {
    const { service, created } = build();
    await service.createFor(guestActor, dto as any);
    expect(created[0].customerId).toBeNull();
    expect(created[0].whatsappCustomerId).toBe("wa-1");
    expect(created[0].source).toBe("whatsapp");
    expect(created[0].driverPhone).toBe("919999999999");
  });

  it("holds a bay for a website account and keeps the web source", async () => {
    const { service, created } = build();
    await service.createFor(accountActor, dto as any);
    expect(created[0].customerId).toBe("user-1");
    expect(created[0].whatsappCustomerId).toBeNull();
    expect(created[0].source).toBe("web");
  });

  it("refuses a malformed booking id before touching the database", async () => {
    const { service, bookings } = build();
    await expect(service.ownBookingFor(guestActor, "not-an-id")).rejects.toThrow(
      ParkingException,
    );
    expect(bookings.findOne).not.toHaveBeenCalled();
  });

  it("scopes ownership lookups to the guest's own identity, not any account", async () => {
    const { service, bookings } = build();
    bookings.findOne.mockReturnValueOnce(null);
    await expect(
      service.ownBookingFor(guestActor, "507f1f77bcf86cd799439011"),
    ).rejects.toThrow("Booking not found.");
    expect(bookings.findOne).toHaveBeenCalledWith({
      _id: "507f1f77bcf86cd799439011",
      whatsappCustomerId: "wa-1",
    });
  });

  it("scopes ownership lookups to the account's own id for a website identity", async () => {
    const { service, bookings } = build();
    bookings.findOne.mockReturnValueOnce(null);
    await expect(
      service.ownBookingFor(accountActor, "507f1f77bcf86cd799439011"),
    ).rejects.toThrow("Booking not found.");
    expect(bookings.findOne).toHaveBeenCalledWith({
      _id: "507f1f77bcf86cd799439011",
      customerId: "user-1",
    });
  });
});

describe("parking booking service: payment order binding", () => {
  const buildWithBooking = (booking: any, existingPayment: any = null) => {
    const repository: any = {};
    const session = {};
    const bookings: any = {
      findOne: jest.fn(() => ({
        session: jest.fn().mockResolvedValue(booking),
      })),
    };
    const payments: any = {
      findOne: jest.fn(() => ({
        sort: jest.fn(() => ({
          session: jest.fn().mockResolvedValue(existingPayment),
        })),
      })),
      create: jest.fn(async (docs: any[]) => [
        { ...docs[0], save: jest.fn(), _id: "pay-1" },
      ]),
    };
    const transactions: any = { run: jest.fn((work: any) => work(session)) };
    const config: any = {
      get: jest.fn((key: string) =>
        key === "razorpayKeySecret" ? "topsecret" : undefined,
      ),
    };
    const locations: any = { findById: jest.fn(() => ({ session: jest.fn() })) };
    const pricingService: any = { commission: jest.fn().mockResolvedValue({ percent: 0, amount: 0, partnerEarning: 0 }) };
    const notifications: any = { create: jest.fn() };
    const commissions: any = { updateOne: jest.fn() };
    const ledger: any = { create: jest.fn() };
    const service = new ParkingBookingService(
      repository,
      transactions,
      pricingService,
      config,
      bookings,
      payments,
      ledger,
      commissions,
      { findOne: jest.fn(() => ({ sort: jest.fn(() => ({ session: jest.fn().mockResolvedValue(null) })) })), create: jest.fn().mockResolvedValue([{}]) } as any,
      notifications,
      {} as any,
      locations,
    );
    (service as any).verifyRazorpay = jest.fn().mockReturnValue(true);
    (service as any).issueQr = jest.fn().mockResolvedValue({ displayCode: "X", token: "TVNPK1.tok" });
    return { service };
  };

  const actor = {
    userId: null,
    whatsappCustomerId: "wa-1",
    role: "whatsapp_customer",
    channel: "whatsapp",
  } as any;

  it("refuses a genuine payment whose Razorpay order does not belong to this booking", async () => {
    const booking = {
      _id: "507f1f77bcf86cd799439011",
      whatsappCustomerId: "wa-1",
      paymentStatus: "pending",
      status: "pending",
      reservationExpiresAt: new Date(Date.now() + 600_000),
      pricing: { totalAmount: 100 },
      partnerId: "partner-1",
      locationId: "loc-1",
      history: [],
      save: jest.fn(),
    };
    const { service } = buildWithBooking(booking, null);
    await expect(
      service.confirmPaymentFor(actor, "507f1f77bcf86cd799439011", {
        razorpay_order_id: "order_other",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "sig",
      } as any),
    ).rejects.toThrow("This payment does not belong to this booking.");
    expect(booking.save).not.toHaveBeenCalled();
  });

  it("accepts a payment for the order this booking's own pending payment opened", async () => {
    const booking = {
      _id: "507f1f77bcf86cd799439011",
      whatsappCustomerId: "wa-1",
      paymentStatus: "pending",
      status: "pending",
      reservationExpiresAt: new Date(Date.now() + 600_000),
      pricing: { totalAmount: 100 },
      partnerId: "partner-1",
      locationId: "loc-1",
      history: [],
      save: jest.fn(),
    };
    const payment = {
      _id: "pay-1",
      status: "pending",
      save: jest.fn(),
      gateway: { orderId: "order_1" },
    };
    const { service } = buildWithBooking(booking, payment);
    const result = await service.confirmPaymentFor(actor, "507f1f77bcf86cd799439011", {
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: "sig",
    } as any);
    expect(result.booking.status).toBe("upcoming");
    expect(payment.save).toHaveBeenCalled();
  });

  it("refuses a malformed booking id", async () => {
    const { service } = buildWithBooking({});
    await expect(
      service.confirmPaymentFor(actor, "not-an-id", {
        razorpay_order_id: "o",
        razorpay_payment_id: "p",
        razorpay_signature: "s",
      } as any),
    ).rejects.toThrow(ParkingException);
  });
});
