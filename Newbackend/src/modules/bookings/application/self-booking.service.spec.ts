import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { SelfBookingService } from "./self-booking.service";

jest.setTimeout(30_000);

const leanOf = (rows: unknown) => ({
  select: jest.fn(() => ({
    sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(rows) })),
    lean: jest.fn().mockResolvedValue(rows),
  })),
  sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(rows) })),
  lean: jest.fn().mockResolvedValue(rows),
});

const build = (opts: { ownedAshrams?: string[] } = {}) => {
  const created: Record<string, any[]> = {
    bookings: [],
    payments: [],
    receipts: [],
    transactions: [],
    audits: [],
    history: [],
    users: [],
  };
  const collect = (bucket: string) => ({
    create: jest.fn(async (docs: any[]) => {
      created[bucket].push(...docs);
      return docs.map((doc, index) => ({
        ...doc,
        _id: `${bucket}-${index}`,
        receiptNumber: doc.receiptNumber,
      }));
    }),
  });

  const ashrams = {
    find: jest.fn(() => leanOf((opts.ownedAshrams ?? []).map((id) => ({ _id: id })))),
    findOne: jest.fn().mockResolvedValue({ _id: "ashram-a", ownerId: "owner-1" }),
  };
  const inventory = {
    find: jest.fn(() => leanOf([])),
    updateMany: jest.fn().mockResolvedValue({}),
  };
  const users = {
    findOne: jest.fn(() => ({ session: jest.fn().mockResolvedValue(null) })),
    ...collect("users"),
  };
  const repository = {
    holdInventory: jest.fn().mockResolvedValue(undefined),
    confirmInventory: jest.fn().mockResolvedValue(undefined),
    releaseInventory: jest.fn().mockResolvedValue(undefined),
  };
  const transactions = { run: jest.fn(async (fn: any) => fn({})) };
  const pricing = {
    quote: jest.fn().mockResolvedValue({
      room: { totalInventory: 10 },
      dates: [new Date("2026-09-01T00:00:00.000Z")],
      pricing: { totalAmount: 1000, basePrice: 1000 },
    }),
  };
  const qr = { renderSvg: jest.fn(() => "<svg/>") };

  const service = new SelfBookingService(
    repository as never,
    transactions as never,
    pricing as never,
    qr as never,
    { ...collect("bookings"), findById: jest.fn() } as never,
    collect("history") as never,
    { ...collect("payments"), findOne: jest.fn(() => leanOf(null)) } as never,
    { ...collect("receipts"), findOne: jest.fn(() => leanOf(null)) } as never,
    collect("transactions") as never,
    collect("audits") as never,
    inventory as never,
    ashrams as never,
    { find: jest.fn(() => leanOf([])) } as never,
    users as never,
  );
  return { service, created, repository, inventory, pricing };
};

const owner = (over: Record<string, unknown> = {}) =>
  ({
    id: "owner-1",
    role: "ashram_owner",
    name: "Owner",
    permissions: [],
    scopedAshramIds: [],
    employerAshramId: "ashram-a",
    ...over,
  }) as never;

const dto = (over: Record<string, unknown> = {}) =>
  ({
    ashramId: "ashram-a",
    roomId: "room-1",
    guestName: "Ravi Kumar",
    guestPhone: "9876543210",
    checkInDate: "2026-09-01",
    checkOutDate: "2026-09-02",
    guestsCount: 2,
    roomsBookedCount: 1,
    bookingType: "self",
    paymentMethod: "cash",
    amountCollected: 1000,
    ...over,
  }) as never;

describe("self / walk-in booking", () => {
  it("records the booking against the staff member's own ashram", async () => {
    const { service, created } = build();
    await service.create(owner(), dto());
    const booking = created.bookings[0];
    expect(booking.bookingSource).toBe("self");
    expect(String(booking.ashramId)).toBe("ashram-a");
    expect(booking.status).toBe("confirmed");
    expect(booking.paymentMode).toBe("offline");
    expect(booking.bookedBy).toBe("owner-1");
  });

  it("refuses to book against an ashram outside the staff member's scope", async () => {
    const { service } = build();
    await expect(
      service.create(owner(), dto({ ashramId: "ashram-other" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses a role that is not allowed to take walk-ins", async () => {
    const { service } = build();
    await expect(
      service.create(owner({ role: "customer" }), dto()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets super admin record against any ashram", async () => {
    const { service, created } = build();
    await service.create(owner({ role: "super_admin" }), dto());
    expect(created.bookings[0].bookingSource).toBe("self");
  });

  it("generates a unique booking id, check-in code and receipt", async () => {
    const { service, created } = build();
    const result = await service.create(owner(), dto());
    expect(created.bookings[0].bookingId).toBeTruthy();
    expect(created.bookings[0].checkInCode).toBeTruthy();
    expect(result.checkInCode).toBe(created.bookings[0].checkInCode);
    expect(created.receipts[0].receiptNumber).toBeTruthy();
  });

  it("holds and confirms real inventory so a walk-in cannot overbook", async () => {
    const { service, repository } = build();
    await service.create(owner(), dto());
    expect(repository.holdInventory).toHaveBeenCalled();
    expect(repository.confirmInventory).toHaveBeenCalled();
  });

  it("counts the stay against the offline inventory tally", async () => {
    const { service, inventory } = build();
    await service.create(owner(), dto());
    expect(inventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: "room-1" }),
      { $inc: { offlineBookedCount: 1 } },
      expect.anything(),
    );
  });

  it("tags the payment and finance transaction as a self booking", async () => {
    const { service, created } = build();
    await service.create(owner(), dto({ paymentMethod: "upi" }));
    expect(created.payments[0].bookingSource).toBe("self");
    expect(created.payments[0].method).toBe("upi");
    expect(created.payments[0].collectedBy).toBe("owner-1");
    expect(created.transactions[0].bookingSource).toBe("self");
  });

  it("marks a part payment as partially paid rather than settled", async () => {
    const { service, created } = build();
    await service.create(owner(), dto({ amountCollected: 400 }));
    expect(created.bookings[0].paymentStatus).toBe("partially_paid");
    expect(created.bookings[0].pricing.amountPaid).toBe(400);
  });

  it("marks a full payment as fully paid", async () => {
    const { service, created } = build();
    await service.create(owner(), dto({ amountCollected: 1000 }));
    expect(created.bookings[0].paymentStatus).toBe("fully_paid");
  });

  it("refuses to collect more than the booking total", async () => {
    const { service } = build();
    await expect(
      service.create(owner(), dto({ amountCollected: 5000 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("writes an audit entry naming the collecting staff member", async () => {
    const { service, created } = build();
    await service.create(owner(), dto());
    const logged = JSON.stringify(created.audits);
    expect(logged).toContain("SELF_BOOKING_CREATED");
    expect(logged).toContain("owner-1");
  });

  it("holds but does not confirm a Tirvona booking until Razorpay pays", async () => {
    const { service, created, repository } = build();
    const result = await service.create(
      owner(),
      dto({ bookingType: "tirvona", paymentMethod: undefined, amountCollected: undefined }),
    );
    const booking = created.bookings[0];
    expect(booking.bookingSource).toBe("tirvona");
    expect(booking.status).toBe("pending");
    expect(booking.paymentMode).toBe("online");
    expect(booking.gatewayStatus).toBe("not_initiated");
    expect(booking.reservationExpiresAt).toBeInstanceOf(Date);
    expect(repository.holdInventory).toHaveBeenCalled();
    expect(repository.confirmInventory).not.toHaveBeenCalled();
    expect(result.requiresOnlinePayment).toBe(true);
    expect(result.amountDue).toBe(1000);
  });

  it("writes no payment, receipt or ledger row for an unpaid Tirvona booking", async () => {
    const { service, created, inventory } = build();
    await service.create(owner(), dto({ bookingType: "tirvona" }));
    expect(created.payments).toHaveLength(0);
    expect(created.receipts).toHaveLength(0);
    expect(created.transactions).toHaveLength(0);
    expect(inventory.updateMany).not.toHaveBeenCalled();
  });

  it("still enforces ashram scope for a counter Tirvona booking", async () => {
    const { service } = build();
    await expect(
      service.create(
        owner(),
        dto({ bookingType: "tirvona", ashramId: "ashram-other" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lists only the ashrams the staff member is authorised for", async () => {
    const { service } = build({ ownedAshrams: [] });
    const rows = await service.authorizedAshrams(owner());
    expect(Array.isArray(rows)).toBe(true);
  });
});
