import { BookingPricingService } from "./booking-pricing.service";

describe("Booking Rate Integration & Snapshot", () => {
  let pricingService: BookingPricingService;
  let mockRooms: any;
  let mockInventory: any;
  let mockAddons: any;
  let mockPricingRules: any;
  let mockCoupons: any;
  let mockPolicies: any;
  let mockSettings: any;
  let mockAshrams: any;

  const activeStay = {
    _id: "ashram-1",
    status: "approved",
    bookingPaused: false,
    ashramType: "ashram",
    name: "Sri Radha Dham",
  };

  const roomWithDiscount = {
    _id: "room-1",
    ashramId: "ashram-1",
    name: "Deluxe AC Room",
    basePrice: 5000,
    discountPercent: 6,
    discountAmount: 300,
    sellingPrice: 4700,
    isDiscountActive: true,
    capacity: 2,
    totalInventory: 10,
    status: "active",
  };

  beforeEach(() => {
    mockRooms = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([roomWithDiscount]),
      }),
    };
    mockInventory = {
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    };
    mockAddons = {
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    };
    mockPricingRules = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      }),
    };
    mockCoupons = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    };
    mockPolicies = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      }),
    };
    mockSettings = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    };
    mockAshrams = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(activeStay),
        }),
      }),
    };

    pricingService = new BookingPricingService(
      mockRooms,
      mockInventory,
      mockAddons,
      mockPricingRules,
      mockCoupons,
      mockPolicies,
      mockSettings,
      mockAshrams,
    );
  });

  it("quotes stay using the effective selling price (₹4700) instead of MRP (₹5000)", async () => {
    const quote = await pricingService.quote({
      ashramId: "ashram-1",
      roomId: "room-1",
      checkInDate: "2026-10-01",
      checkOutDate: "2026-10-02", // 1 night
      guestsCount: 2,
      roomsBookedCount: 1,
    } as any);

    expect(quote.pricing.basePrice).toBe(4700);
    expect(quote.pricing.roomMrp).toBe(5000);
    expect(quote.pricing.roomDiscountAmount).toBe(300);

    expect(quote.roomsSnapshot).toHaveLength(1);
    expect(quote.roomsSnapshot[0]).toEqual(
      expect.objectContaining({
        roomId: "room-1",
        mrp: 5000,
        discountPercentage: 6,
        discountAmount: 300,
        sellingPrice: 4700,
      }),
    );
  });

  it("quotes full MRP when discount is disabled on the room category", async () => {
    mockRooms.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          ...roomWithDiscount,
          isDiscountActive: false,
        },
      ]),
    });

    const quote = await pricingService.quote({
      ashramId: "ashram-1",
      roomId: "room-1",
      checkInDate: "2026-10-01",
      checkOutDate: "2026-10-02",
      guestsCount: 2,
      roomsBookedCount: 1,
    } as any);

    expect(quote.pricing.basePrice).toBe(5000);
    expect(quote.pricing.roomMrp).toBe(5000);
    expect(quote.pricing.roomDiscountAmount).toBe(0);
    expect(quote.roomsSnapshot[0].sellingPrice).toBe(5000);
    expect(quote.roomsSnapshot[0].discountPercentage).toBe(0);
  });
});
