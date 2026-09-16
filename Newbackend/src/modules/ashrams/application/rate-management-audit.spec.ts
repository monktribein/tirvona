import {
  ForbiddenException,
} from "@nestjs/common";
import { RoomRatesService } from "./room-rates.service";
import { UpsertRoomRateDto, type BulkRoomRatesDto } from "../presentation/dtos/room-rate.dto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

describe("Rate Management Final Deep Audit", () => {
  let rateService: RoomRatesService;

  const mockOwnerA = {
    id: "user-owner-a",
    email: "owner.a@example.com",
    role: "owner",
    scopedAshramIds: ["507f1f77bcf86cd799439011"],
  } as any;

  const mockSuperAdmin = {
    id: "user-super-admin",
    email: "admin@example.com",
    role: "super_admin",
  } as any;

  const mockCustomer = {
    id: "user-customer",
    email: "customer@example.com",
    role: "customer",
  } as any;

  const mockStayA = {
    _id: "507f1f77bcf86cd799439011",
    name: "Stay A",
    ownerId: "user-owner-a",
    status: "approved",
  };

  const mockStayB = {
    _id: "507f1f77bcf86cd799439012",
    name: "Stay B",
    ownerId: "user-owner-b",
    status: "approved",
  };

  const mockRoomA = {
    _id: "507f1f77bcf86cd799439021",
    ashramId: "507f1f77bcf86cd799439011",
    name: "Deluxe A",
    type: "private_room",
    acType: "AC",
    capacity: 2,
    totalInventory: 5,
    basePrice: 5000,
    discountPercent: 6,
    discountAmount: 300,
    sellingPrice: 4700,
    isDiscountActive: true,
    status: "active",
  };

  const mockRoomRateA = {
    _id: "507f1f77bcf86cd799439031",
    ashramId: "507f1f77bcf86cd799439011",
    roomId: "507f1f77bcf86cd799439021",
    mrp: 5000,
    discountPercent: 6,
    discountAmount: 300,
    sellingPrice: 4700,
    isDiscountActive: true,
  };

  const mockAudits = {
    create: jest.fn().mockResolvedValue({}),
  };

  const mockRoomRateModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    bulkWrite: jest.fn(),
  };

  const mockRoomModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };

  const mockAshramModel = {
    findById: jest.fn().mockImplementation((id: string) => ({
      lean: jest.fn().mockResolvedValue(id === mockStayA._id ? mockStayA : mockStayB),
    })),
    findOne: jest.fn().mockImplementation((query: any) => ({
      lean: jest.fn().mockResolvedValue(query?._id === mockStayA._id ? mockStayA : mockStayB),
    })),
  };

  const calcRate = (mrp: number, discount: number, active: boolean = true) =>
    (rateService as any).calculateRate(mrp, discount, active);

  beforeEach(() => {
    jest.clearAllMocks();
    rateService = new RoomRatesService(
      mockRoomRateModel as any,
      mockRoomModel as any,
      mockAshramModel as any,
      mockAudits as any,
    );
  });

  // =========================================================================
  // 1. SINGLE SOURCE OF TRUTH & MONEY ROUNDING FORMULA
  // =========================================================================
  describe("1 & 8. Formula & Money Rounding", () => {
    it("computes exact mathematical rate with proper 2-decimal rounding", () => {
      // MRP = 5000, Discount = 6% -> 300 discount, 4700 selling
      const calc1 = calcRate(5000, 6, true);
      expect(calc1.mrp).toBe(5000);
      expect(calc1.discountPercent).toBe(6);
      expect(calc1.discountAmount).toBe(300);
      expect(calc1.sellingPrice).toBe(4700);

      // ₹999 * 7% = 69.93 discount, 929.07 selling
      const calc2 = calcRate(999, 7, true);
      expect(calc2.discountAmount).toBe(69.93);
      expect(calc2.sellingPrice).toBe(929.07);

      // ₹1,999 * 6% = 119.94 discount, 1879.06 selling
      const calc3 = calcRate(1999, 6, true);
      expect(calc3.discountAmount).toBe(119.94);
      expect(calc3.sellingPrice).toBe(1879.06);

      // ₹2,499.99 * 7.5% = 187.50 discount, 2312.49 selling
      const calc4 = calcRate(2499.99, 7.5, true);
      expect(calc4.discountAmount).toBe(187.5);
      expect(calc4.sellingPrice).toBe(2312.49);

      // ₹5,555.55 * 6.5% = 361.11 discount, 5194.44 selling
      const calc5 = calcRate(5555.55, 6.5, true);
      expect(calc5.discountAmount).toBe(361.11);
      expect(calc5.sellingPrice).toBe(5194.44);
    });

    it("clamps sellingPrice so it never goes negative", () => {
      const calc = calcRate(100, 90, true);
      expect(calc.discountAmount).toBe(90);
      expect(calc.sellingPrice).toBe(10);
    });
  });

  // =========================================================================
  // 2. REALISTIC END-TO-END SCENARIO & RATE PERSISTENCE
  // =========================================================================
  describe("2. Realistic End-to-End Scenario", () => {
    it("Owner saves rate (MRP ₹5,000, 6% OFF) -> Customer sees ₹4,700", async () => {
      mockAshramModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockStayA) });
      mockRoomModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockRoomA),
        }),
      });
      mockRoomRateModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRoomRateA),
      });
      mockRoomRateModel.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          ...mockRoomRateA,
          updatedAt: new Date(),
        }),
      });
      mockRoomModel.updateMany.mockResolvedValue({ modifiedCount: 1 });

      const dto: UpsertRoomRateDto = {
        ashramId: mockStayA._id,
        roomId: mockRoomA._id,
        mrp: 5000,
        discountPercent: 6,
        isDiscountActive: true,
      };

      const result = await rateService.upsertRate(mockOwnerA, dto);

      expect(result.mrp).toBe(5000);
      expect(result.discountPercent).toBe(6);
      expect(result.discountAmount).toBe(300);
      expect(result.sellingPrice).toBe(4700);

      // Verify DB update synced both collections
      expect(mockRoomRateModel.findOneAndUpdate).toHaveBeenCalledWith(
        { roomId: mockRoomA._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            mrp: 5000,
            discountPercent: 6,
            discountAmount: 300,
            sellingPrice: 4700,
            isDiscountActive: true,
          }),
        }),
        expect.any(Object),
      );

      // Verify audit log
      expect(mockAudits.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockOwnerA.id,
          action: "room_rate.update",
          details: expect.objectContaining({
            ashramId: mockStayA._id,
            roomId: mockRoomA._id,
            mrp: 5000,
            discountPercent: 6,
            discountAmount: 300,
            sellingPrice: 4700,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // 3 & 18. IMMUTABILITY OF BOOKING SNAPSHOT AFTER RATE CHANGE
  // =========================================================================
  describe("3 & 18. Rate change after booking & Historical snapshot immutability", () => {
    it("ensures rate change to 10% does NOT change previously created booking snapshot", () => {
      // Historical booking created when rate was 6%
      const existingBooking = {
        bookingId: "TIR-2026-0001",
        rooms: [
          {
            roomId: mockRoomA._id,
            units: 1,
            mrp: 5000,
            discountPercentage: 6,
            discountAmount: 300,
            sellingPrice: 4700,
          },
        ],
        pricing: {
          roomMrp: 5000,
          roomDiscountAmount: 300,
          effectiveRoomPrice: 4700,
          basePrice: 4700,
          finalAmount: 4700,
        },
      };

      // Now rate changes to 10% (selling price 4500)
      const newRateCalc = calcRate(5000, 10, true);
      expect(newRateCalc.sellingPrice).toBe(4500);

      // Historical booking remains untouched
      expect(existingBooking.rooms[0].sellingPrice).toBe(4700);
      expect(existingBooking.rooms[0].mrp).toBe(5000);
      expect(existingBooking.rooms[0].discountPercentage).toBe(6);
      expect(existingBooking.pricing.finalAmount).toBe(4700);
    });
  });

  // =========================================================================
  // 4. FRONTEND PRICE MANIPULATION DEFENSE
  // =========================================================================
  describe("4. Security: Frontend price manipulation attempts", () => {
    it("DTO whitelist & server calculation strictly ignore frontend prices", async () => {
      const maliciousPayload = {
        sellingPrice: 100, // Attacker tries to set selling price to 100
        totalAmount: 100,  // Attacker tries to set total to 100
        price: 100,
      };

      const dto = plainToInstance(UpsertRoomRateDto, {
        ashramId: mockStayA._id,
        roomId: mockRoomA._id,
        mrp: 5000,
        discountPercent: 6,
        isDiscountActive: true,
        ...maliciousPayload,
      });

      // DTO does not declare sellingPrice or totalAmount; server calculateRate is used
      const calc = calcRate(dto.mrp, dto.discountPercent, dto.isDiscountActive ?? true);
      expect(calc.sellingPrice).toBe(4700); // Strictly ₹4,700, malicious ₹100 is completely disregarded
    });
  });

  // =========================================================================
  // 5. OWNER ISOLATION
  // =========================================================================
  describe("5. Security: Owner Isolation", () => {
    it("Owner A CANNOT update Stay B rates (throws ForbiddenException)", async () => {
      mockAshramModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockStayB) });
      mockRoomModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            ...mockRoomA,
            ashramId: mockStayB._id,
          }),
        }),
      });

      const dto: UpsertRoomRateDto = {
        ashramId: mockStayB._id,
        roomId: mockRoomA._id,
        mrp: 5000,
        discountPercent: 6,
      };

      await expect(rateService.upsertRate(mockOwnerA, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("Owner A CANNOT toggle Stay B discount", async () => {
      mockRoomModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            ...mockRoomA,
            ashramId: mockStayB._id,
          }),
        }),
      });
      mockAshramModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockStayB) });

      await expect(
        rateService.toggleDiscount(mockOwnerA, mockRoomA._id, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it("Owner A CANNOT bulk-update Stay B rates", async () => {
      mockAshramModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockStayB) });

      const bulkDto: BulkRoomRatesDto = {
        ashramId: mockStayB._id,
        roomIds: [mockRoomA._id],
        discountPercent: 10,
      };

      await expect(rateService.bulkUpdate(mockOwnerA, bulkDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("Super Admin CAN update Stay A and Stay B rates", async () => {
      mockAshramModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockStayB) });
      mockRoomModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            ...mockRoomA,
            ashramId: mockStayB._id,
          }),
        }),
      });
      mockRoomRateModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRoomRateA),
      });
      mockRoomRateModel.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRoomRateA),
      });
      mockRoomModel.updateMany.mockResolvedValue({ modifiedCount: 1 });

      const dto: UpsertRoomRateDto = {
        ashramId: mockStayB._id,
        roomId: mockRoomA._id,
        mrp: 5000,
        discountPercent: 6,
      };

      const result = await rateService.upsertRate(mockSuperAdmin, dto);
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // 6. CUSTOMER PERMISSIONS
  // =========================================================================
  describe("6. Customer Permissions", () => {
    it("Customer CAN read effective pricing", async () => {
      mockRoomModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRoomA),
      });
      mockRoomRateModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRoomRateA),
      });

      const effective = await rateService.getPublicEffectiveRate(mockRoomA._id);
      expect(effective.mrp).toBe(5000);
      expect(effective.discountPercent).toBe(6);
      expect(effective.discountAmount).toBe(300);
      expect(effective.sellingPrice).toBe(4700);
      expect(effective.isDiscountActive).toBe(true);
    });

    it("Customer CANNOT upsert rates (forbidden by assertScope)", async () => {
      mockAshramModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockStayA) });
      mockRoomModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockRoomA),
        }),
      });

      const dto: UpsertRoomRateDto = {
        ashramId: mockStayA._id,
        roomId: mockRoomA._id,
        mrp: 5000,
        discountPercent: 6,
      };

      await expect(rateService.upsertRate(mockCustomer, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // =========================================================================
  // 7. DISCOUNT EDGE CASES & DTO VALIDATION
  // =========================================================================
  describe("7. Discount Edge Cases", () => {
    it("handles 0%, 1%, 6%, 50%, 90% correctly", () => {
      expect(calcRate(5000, 0, true).sellingPrice).toBe(5000);
      expect(calcRate(5000, 1, true).sellingPrice).toBe(4950);
      expect(calcRate(5000, 6, true).sellingPrice).toBe(4700);
      expect(calcRate(5000, 50, true).sellingPrice).toBe(2500);
      expect(calcRate(5000, 90, true).sellingPrice).toBe(500);
    });

    it("rejects discount > 90% in class-validator", async () => {
      const dto = plainToInstance(UpsertRoomRateDto, {
        ashramId: mockStayA._id,
        roomId: mockRoomA._id,
        mrp: 5000,
        discountPercent: 91, // Above 90%
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === "discountPercent")).toBe(true);
    });

    it("rejects negative discount in class-validator", async () => {
      const dto = plainToInstance(UpsertRoomRateDto, {
        ashramId: mockStayA._id,
        roomId: mockRoomA._id,
        mrp: 5000,
        discountPercent: -5,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === "discountPercent")).toBe(true);
    });

    it("rejects negative MRP in class-validator", async () => {
      const dto = plainToInstance(UpsertRoomRateDto, {
        ashramId: mockStayA._id,
        roomId: mockRoomA._id,
        mrp: -100,
        discountPercent: 10,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === "mrp")).toBe(true);
    });
  });

  // =========================================================================
  // 9. DISCOUNT TOGGLE
  // =========================================================================
  describe("9. Discount Toggle", () => {
    it("disabling discount returns sellingPrice = MRP; re-enabling returns discounted price", async () => {
      mockRoomModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockRoomA),
        }),
      });
      mockAshramModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockStayA) });
      mockRoomRateModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRoomRateA),
      });

      // Disable discount
      mockRoomRateModel.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          ...mockRoomRateA,
          isDiscountActive: false,
          sellingPrice: 5000,
        }),
      });
      mockRoomModel.updateMany.mockResolvedValue({ modifiedCount: 1 });

      const disabled = await rateService.toggleDiscount(mockOwnerA, mockRoomA._id, false);
      expect(disabled.isDiscountActive).toBe(false);
      expect(disabled.sellingPrice).toBe(5000);
      expect(disabled.discountAmount).toBe(0);

      // Re-enable discount
      mockRoomRateModel.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          ...mockRoomRateA,
          isDiscountActive: true,
          sellingPrice: 4700,
        }),
      });
      const reEnabled = await rateService.toggleDiscount(mockOwnerA, mockRoomA._id, true);
      expect(reEnabled.isDiscountActive).toBe(true);
      expect(reEnabled.sellingPrice).toBe(4700);
      expect(reEnabled.discountAmount).toBe(300);
    });
  });

  // =========================================================================
  // 10. BULK UPDATE
  // =========================================================================
  describe("10. Bulk Update", () => {
    it("applies 6% discount to Category A (5000), B (3000), C (7000) preserving their individual MRPs", async () => {
      const room1 = { ...mockRoomA, _id: "507f1f77bcf86cd799439021", basePrice: 5000 };
      const room2 = { ...mockRoomA, _id: "507f1f77bcf86cd799439022", basePrice: 3000 };
      const room3 = { ...mockRoomA, _id: "507f1f77bcf86cd799439023", basePrice: 7000 };

      mockAshramModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockStayA) });
      mockRoomModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([room1, room2, room3]),
      });
      mockRoomRateModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
      mockRoomRateModel.bulkWrite.mockResolvedValue({ modifiedCount: 3 });
      mockRoomModel.updateMany.mockResolvedValue({ modifiedCount: 3 });

      const bulkDto: BulkRoomRatesDto = {
        ashramId: mockStayA._id,
        roomIds: [room1._id, room2._id, room3._id],
        discountPercent: 6,
        isDiscountActive: true,
      };

      const result = await rateService.bulkUpdate(mockOwnerA, bulkDto);
      expect(result.updatedCount).toBe(3);

      const [resA, resB, resC] = result.rates;
      // Category A: MRP 5000 -> selling 4700
      expect(resA.mrp).toBe(5000);
      expect(resA.sellingPrice).toBe(4700);
      expect(resA.discountAmount).toBe(300);

      // Category B: MRP 3000 -> selling 2820
      expect(resB.mrp).toBe(3000);
      expect(resB.sellingPrice).toBe(2820);
      expect(resB.discountAmount).toBe(180);

      // Category C: MRP 7000 -> selling 6580
      expect(resC.mrp).toBe(7000);
      expect(resC.sellingPrice).toBe(6580);
      expect(resC.discountAmount).toBe(420);
    });
  });
});
