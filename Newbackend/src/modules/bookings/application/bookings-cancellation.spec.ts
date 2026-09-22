import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import type { BookingActor } from "../domain/booking-customer";

const chain = (value: unknown) => {
  const q: any = {
    sort: () => q,
    lean: async () => value,
  };
  return q;
};

const website: BookingActor = {
  userId: "user-1",
  whatsappCustomerId: null,
  role: "customer",
  channel: "web" as any,
  principal: { id: "user-1", role: "customer" } as any,
};
const guest: BookingActor = {
  userId: null,
  whatsappCustomerId: "wa-1",
  role: "whatsapp_customer",
  channel: "whatsapp" as any,
};

const policy = {
  cancellationFreeHours: 24,
  refundBeforeWindowPercent: 80,
  refundInsideWindowPercent: 10,
};

const paidBooking = (extra: Record<string, unknown> = {}) => {
  const row: any = {
    _id: "booking-1",
    bookingId: "TRV-1",
    ashramId: "ashram-1",
    customerId: "user-1",
    status: "confirmed",
    paymentStatus: "fully_paid",
    checkInDate: new Date(Date.now() + 72 * 3_600_000),
    occupiedDates: [new Date("2030-01-01")],
    pricing: { amountPaid: 2000, totalAmount: 2000 },
    save: jest.fn().mockResolvedValue(undefined),
    ...extra,
  };
  return row;
};

const build = (row: any) => {
  const service = Object.create(BookingsService.prototype) as any;
  const refundCreate = jest.fn().mockResolvedValue([{}]);
  Object.assign(service, {
    logger: { log: jest.fn(), warn: jest.fn() },
    transactions: { run: jest.fn(async (work: any) => work({})) },
    bookings: { findById: jest.fn(async () => row) },
    pricing: { policies: { findOne: jest.fn(() => chain(policy)) } },
    payments: {
      findOne: jest.fn(() => ({
        session: async () => ({ _id: "pay-1" }),
      })),
    },
    refunds: { create: refundCreate },
    commissions: { updateOne: jest.fn() },
    coupons: { updateOne: jest.fn() },
    redemptions: { updateOne: jest.fn() },
    inventoryHolds: { updateMany: jest.fn() },
    history: { create: jest.fn() },
    notifications: { create: jest.fn() },
    repository: { releaseInventory: jest.fn() },
    roomUnits: () => [{ roomId: "room-1", units: 1 }],
  });
  return { service, refundCreate };
};

describe("BookingsService cancellation refund", () => {
  it("previews exactly what cancel then records", async () => {
    const row = paidBooking();
    const { service, refundCreate } = build(row);

    const preview = await service.previewCancellation("booking-1", website);
    const result = await service.cancel("booking-1", website, {
      reason: "Change of plan",
    });

    expect(preview.refundAmount).toBe(1600); // 80% of 2000
    expect(result.refundAmount).toBe(preview.refundAmount);
    expect(refundCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ amount: preview.refundAmount, percentage: 80 })],
      expect.anything(),
    );
  });

  it("applies the late-cancellation percentage in both", async () => {
    const row = paidBooking({
      checkInDate: new Date(Date.now() + 2 * 3_600_000),
    });
    const { service } = build(row);
    const preview = await service.previewCancellation("booking-1", website);
    const result = await service.cancel("booking-1", website, {
      reason: "Late",
    });
    expect(preview.refundAmount).toBe(200); // 10%
    expect(result.refundAmount).toBe(200);
  });

  it("does not change anything when only previewing", async () => {
    const row = paidBooking();
    const { service, refundCreate } = build(row);
    await service.previewCancellation("booking-1", website);
    expect(row.save).not.toHaveBeenCalled();
    expect(row.status).toBe("confirmed");
    expect(refundCreate).not.toHaveBeenCalled();
  });

  it("records a WhatsApp guest's cancellation against the guest, not a User", async () => {
    const row = paidBooking({
      customerId: undefined,
      whatsappCustomerId: "wa-1",
    });
    const { service, refundCreate } = build(row);
    await service.cancel("booking-1", guest, { reason: "Nahi aa sakte" });
    const [[created]] = refundCreate.mock.calls[0];
    expect(created).toMatchObject({
      requestedBy: null,
      requestedByWhatsAppCustomerId: "wa-1",
      amount: 1600,
    });
  });

  it("gives a guest the same preview a website user would get", async () => {
    const asGuest = await build(
      paidBooking({ customerId: undefined, whatsappCustomerId: "wa-1" }),
    ).service.previewCancellation("booking-1", guest);
    const asUser = await build(paidBooking()).service.previewCancellation(
      "booking-1",
      website,
    );
    expect(asGuest.refundAmount).toBe(asUser.refundAmount);
  });

  it("reports someone else's booking as not found, for preview and cancel", async () => {
    const { service } = build(paidBooking());
    await expect(
      service.previewCancellation("booking-1", guest),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.cancel("booking-1", guest, { reason: "not mine" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("refunds nothing for a booking that was never paid", async () => {
    const row = paidBooking({ paymentStatus: "pending", status: "pending" });
    const { service, refundCreate } = build(row);
    const preview = await service.previewCancellation("booking-1", website);
    const result = await service.cancel("booking-1", website, {
      reason: "Changed mind",
    });
    expect(preview.refundAmount).toBe(0);
    expect(result.refundAmount).toBe(0);
    expect(refundCreate).not.toHaveBeenCalled();
  });

  it("refuses to cancel twice and previews no refund for a closed booking", async () => {
    const row = paidBooking({ status: "cancelled" });
    const { service } = build(row);
    const preview = await service.previewCancellation("booking-1", website);
    expect(preview.cancellable).toBe(false);
    expect(preview.refundAmount).toBe(0);
    await expect(
      service.cancel("booking-1", website, { reason: "again" }),
    ).rejects.toThrow(BadRequestException);
  });
});
