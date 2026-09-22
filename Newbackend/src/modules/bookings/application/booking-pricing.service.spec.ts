import { BadRequestException } from "@nestjs/common";
import { BookingPricingService } from "./booking-pricing.service";
import { OffersService } from "./offers.service";

const ASHRAM_ID = "507f1f77bcf86cd799439011";
const ROOM_A = "507f1f77bcf86cd799439021";
const ROOM_B = "507f1f77bcf86cd799439022";

/** A chainable stand-in for a mongoose query that resolves to `value`. */
const chain = (value: unknown) => {
  const q: any = {
    select: () => q,
    sort: () => q,
    populate: () => q,
    lean: async () => value,
  };
  return q;
};

const room = (id: string, basePrice: number, capacity = 2) => ({
  _id: id,
  ashramId: ASHRAM_ID,
  name: `Room ${id.slice(-2)}`,
  capacity,
  basePrice,
  pricingRules: [],
});

const build = (
  opts: { coupon?: unknown; rooms?: any[]; addons?: any[] } = {},
) => {
  const couponFindOne = jest.fn().mockReturnValue(chain(opts.coupon ?? null));
  const models = {
    rooms: { find: () => chain(opts.rooms ?? [room(ROOM_A, 1000)]) },
    inventory: { find: () => chain([]) },
    addons: { find: () => chain(opts.addons ?? []) },
    pricingRules: { find: () => chain([]) },
    coupons: { findOne: couponFindOne },
    policies: { findOne: () => chain(null) },
    settings: { findOne: () => chain(null) },
    ashrams: {
      findOne: () =>
        chain({
          status: "approved",
          bookingPaused: false,
          name: "Test Ashram",
          addOnServices: [],
        }),
    },
  };
  const service = new BookingPricingService(
    models.rooms as any,
    models.inventory as any,
    models.addons as any,
    models.pricingRules as any,
    models.coupons as any,
    models.policies as any,
    models.settings as any,
    models.ashrams as any,
  );
  return { service, couponFindOne };
};

const dto = (extra: Record<string, unknown> = {}) =>
  ({
    ashramId: ASHRAM_ID,
    rooms: [{ roomId: ROOM_A, units: 1 }],
    roomsBookedCount: 1,
    checkInDate: "2030-10-01",
    checkOutDate: "2030-10-03",
    guestsCount: 2,
    ...extra,
  }) as any;

const activeCoupon = (extra: Record<string, unknown> = {}) => ({
  _id: "507f1f77bcf86cd799439099",
  promoCode: "SAVE10",
  discountType: "Percentage",
  discountValue: 10,
  minimumBookingAmount: 0,
  remainingRedemptions: 5,
  ...extra,
});

describe("BookingPricingService coupon integrity", () => {
  it("prices a stay with no coupon from stored room rates only", async () => {
    const { service } = build();
    const quote = await service.quote(dto());
    expect(quote.pricing.basePrice).toBe(2000); // 2 nights x 1000
    expect(quote.pricing.discountAmount).toBe(0);
    expect(quote.pricing.totalAmount).toBeGreaterThan(1);
  });

  it("does not treat TEST1 as a built-in code: with no stored coupon it is rejected", async () => {
    const { service, couponFindOne } = build({ coupon: null });
    await expect(service.quote(dto({ promoCode: "TEST1" }))).rejects.toThrow(
      BadRequestException,
    );
    // It was resolved through the coupon collection like any other code —
    // never short-circuited before the lookup.
    expect(couponFindOne).toHaveBeenCalledWith(
      expect.objectContaining({ promoCode: "TEST1" }),
    );
  });

  it.each(["TEST1", "test1", " Test1 ", "TEST-1", "ONE", "1INR"])(
    "cannot reduce a booking total to ₹1 with the code %j",
    async (code) => {
      const { service } = build({ coupon: null, rooms: [room(ROOM_A, 50_000)] });
      await expect(service.quote(dto({ promoCode: code }))).rejects.toThrow(
        BadRequestException,
      );
    },
  );

  it("cannot reduce the total to ₹1 even when a coupon is genuinely stored, beyond its own rules", async () => {
    const { service } = build({
      coupon: activeCoupon({ discountType: "Percentage", discountValue: 10 }),
      rooms: [room(ROOM_A, 50_000)],
    });
    const quote = await service.quote(dto({ promoCode: "SAVE10" }));
    expect(quote.pricing.totalAmount).toBeGreaterThan(50_000);
    expect(quote.pricing.discountAmount).toBeLessThan(
      quote.pricing.totalAmount,
    );
  });

  it("applies a stored percentage coupon to the gross payable amount", async () => {
    const { service } = build({ coupon: activeCoupon() });
    const noCoupon = await build().service.quote(dto());
    const quote = await service.quote(dto({ promoCode: "SAVE10" }));
    const gross = noCoupon.pricing.totalAmount;
    expect(quote.pricing.discountAmount).toBeCloseTo(gross * 0.1, 1);
    expect(quote.pricing.totalAmount).toBeCloseTo(gross * 0.9, 1);
    expect(quote.coupon?.promoCode).toBe("SAVE10");
  });

  it("rejects a coupon the collection does not return (expired / exhausted / inactive)", async () => {
    // Expiry, status and remaining redemptions are part of the query filter,
    // so an ineligible coupon simply comes back null.
    const { service } = build({ coupon: null });
    await expect(service.quote(dto({ promoCode: "OLDCODE" }))).rejects.toThrow(
      "Promo code is invalid or not applicable",
    );
  });

  it("rejects a coupon bound to a different ashram", async () => {
    const { service } = build({
      coupon: activeCoupon({ ashramId: "507f1f77bcf86cd7994390ff" }),
    });
    await expect(service.quote(dto({ promoCode: "SAVE10" }))).rejects.toThrow(
      "not valid for this ashram",
    );
  });

  it("rejects a coupon when the gross amount is below its minimum", async () => {
    const { service } = build({
      coupon: activeCoupon({ minimumBookingAmount: 1_000_000 }),
    });
    await expect(service.quote(dto({ promoCode: "SAVE10" }))).rejects.toThrow(
      "invalid or not applicable",
    );
  });

  it("rejects a room-restricted coupon when that room is not selected", async () => {
    const { service } = build({
      coupon: activeCoupon({ roomId: ROOM_B }),
    });
    await expect(service.quote(dto({ promoCode: "SAVE10" }))).rejects.toThrow(
      "designated room category",
    );
  });

  it("caps a flat discount at the gross payable amount", async () => {
    const { service } = build({
      coupon: activeCoupon({ discountType: "Flat Amount", discountValue: 9_999_999 }),
    });
    const quote = await service.quote(dto({ promoCode: "SAVE10" }));
    expect(quote.pricing.totalAmount).toBe(0);
  });
});

describe("BookingPricingService multi-room and guests", () => {
  it("sums several units of several room categories", async () => {
    const { service } = build({
      rooms: [room(ROOM_A, 1000), room(ROOM_B, 3000, 4)],
    });
    const quote = await service.quote(
      dto({
        rooms: [
          { roomId: ROOM_A, units: 2 },
          { roomId: ROOM_B, units: 1 },
        ],
        roomsBookedCount: 3,
        guestsCount: 6,
      }),
    );
    // per night: 2*1000 + 1*3000 = 5000; two nights
    expect(quote.pricing.basePrice).toBe(10_000);
  });

  it("charges no extra-guest fee for guests within the room capacity", async () => {
    const { service } = build({ rooms: [room(ROOM_A, 1000, 5)] });
    const quote = await service.quote(dto({ guestsCount: 4 }));
    expect(quote.pricing.extraGuestAmount).toBe(0);
    expect(quote.pricing.totalAmount).toBe(
      quote.pricing.basePrice +
        quote.pricing.platformFee +
        quote.pricing.gstAmount,
    );
  });

  it("rejects more guests than the selected rooms can hold", async () => {
    const { service } = build({ rooms: [room(ROOM_A, 1000, 2)] });
    await expect(service.quote(dto({ guestsCount: 3 }))).rejects.toThrow(
      "exceeds the selected rooms capacity",
    );
  });
});

describe("OffersService.validate", () => {
  const offers = (row: unknown) => {
    const findOne = jest.fn().mockReturnValue(chain(row));
    const service = new OffersService(
      { findOne } as any,
      {} as any,
      {} as any,
    );
    return { service, findOne };
  };

  it.each(["TEST1", "test1"])(
    "treats %s as an ordinary unknown code",
    async (code) => {
      const { service, findOne } = offers(null);
      await expect(
        service.validate({ promoCode: code, bookingAmount: 50_000 } as any),
      ).rejects.toThrow("does not exist");
      expect(findOne).toHaveBeenCalledWith(
        expect.objectContaining({ promoCode: "TEST1" }),
      );
    },
  );

  it("never returns a discount that is not backed by a stored offer", async () => {
    const { service } = offers(
      activeCoupon({
        status: "active",
        validTill: new Date(Date.now() + 86_400_000),
        ashramId: undefined,
      }),
    );
    const result = await service.validate({
      promoCode: "SAVE10",
      bookingAmount: 1000,
      ashramId: ASHRAM_ID,
    } as any);
    expect(result).toMatchObject({ valid: true, discountAmount: 100 });
  });
});
