import { ForbiddenException } from "@nestjs/common";
import { RoomRatesService } from "./room-rates.service";

describe("RoomRatesService", () => {
  let service: RoomRatesService;
  let mockRoomRates: any;
  let mockRooms: any;
  let mockAshrams: any;
  let mockAudits: any;

  const ownerUser = {
    id: "owner-user-1",
    role: "owner",
    scopedAshramIds: ["ashram-1"],
  } as any;

  const unauthorizedOwner = {
    id: "other-owner-2",
    role: "owner",
    scopedAshramIds: ["ashram-2"],
  } as any;

  const superAdmin = {
    id: "admin-1",
    role: "super_admin",
  } as any;

  const mockStay = {
    _id: "ashram-1",
    name: "Sri Radha Dham",
    ownerId: "owner-user-1",
  };

  const mockRoom = {
    _id: "room-1",
    ashramId: "ashram-1",
    name: "Deluxe AC Room",
    type: "private_room",
    acType: "AC",
    capacity: 2,
    totalInventory: 10,
    basePrice: 5000,
    discountPercent: 0,
    discountAmount: 0,
    sellingPrice: 5000,
    isDiscountActive: true,
    status: "active",
  };

  beforeEach(() => {
    mockRoomRates = {
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn().mockImplementation((filter, update) => ({
        _id: "rate-1",
        roomId: filter.roomId,
        ...update.$set,
        updatedAt: new Date(),
      })),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    mockRooms = {
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([mockRoom]) }),
      findOne: jest.fn().mockImplementation((query) => {
        if (query._id === "room-1") {
          return {
            ...mockRoom,
            lean: jest.fn().mockResolvedValue(mockRoom),
          };
        }
        return { lean: jest.fn().mockResolvedValue(null) };
      }),
      findById: jest.fn().mockImplementation((id) => ({
        lean: jest.fn().mockResolvedValue(id === "ashram-1" ? mockStay : null),
      })),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    mockAshrams = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockStay),
      }),
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockStay),
      }),
    };

    mockAudits = {
      create: jest.fn().mockResolvedValue({}),
    };

    service = new RoomRatesService(
      mockRoomRates,
      mockRooms,
      mockAshrams,
      mockAudits,
    );
  });

  describe("Rate Calculation & Upsert", () => {
    it("correctly calculates discount amount and selling price for MRP ₹5000 at 6%", async () => {
      const result = await service.upsertRate(ownerUser, {
        ashramId: "ashram-1",
        roomId: "room-1",
        mrp: 5000,
        discountPercent: 6,
        isDiscountActive: true,
      });

      expect(result.mrp).toBe(5000);
      expect(result.discountPercent).toBe(6);
      expect(result.discountAmount).toBe(300);
      expect(result.sellingPrice).toBe(4700);
      expect(result.isDiscountActive).toBe(true);

      expect(mockRoomRates.findOneAndUpdate).toHaveBeenCalled();
      expect(mockRooms.updateOne).toHaveBeenCalledWith(
        { _id: "room-1" },
        {
          $set: {
            basePrice: 5000,
            discountPercent: 6,
            discountAmount: 300,
            sellingPrice: 4700,
            isDiscountActive: true,
          },
        },
      );
      expect(mockAudits.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "room_rate.update",
          module: "rate_management",
          details: expect.objectContaining({
            mrp: 5000,
            discountPercent: 6,
            discountAmount: 300,
            sellingPrice: 4700,
          }),
        }),
      );
    });

    it("reverts selling price to full MRP when discount is 0%", async () => {
      const result = await service.upsertRate(ownerUser, {
        ashramId: "ashram-1",
        roomId: "room-1",
        mrp: 5000,
        discountPercent: 0,
        isDiscountActive: true,
      });

      expect(result.mrp).toBe(5000);
      expect(result.discountPercent).toBe(0);
      expect(result.discountAmount).toBe(0);
      expect(result.sellingPrice).toBe(5000);
    });

    it("caps discount percentage at safe 90% maximum", async () => {
      const result = await service.upsertRate(ownerUser, {
        ashramId: "ashram-1",
        roomId: "room-1",
        mrp: 1000,
        discountPercent: 99,
        isDiscountActive: true,
      });

      expect(result.discountPercent).toBe(90);
      expect(result.discountAmount).toBe(900);
      expect(result.sellingPrice).toBe(100);
    });
  });

  describe("Discount Toggle", () => {
    it("disables discount and sets selling price to full MRP", async () => {
      mockRoomRates.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          mrp: 5000,
          discountPercent: 6,
          discountAmount: 300,
          sellingPrice: 4700,
          isDiscountActive: true,
        }),
      });

      const result = await service.toggleDiscount(ownerUser, "room-1", false);

      expect(result.isDiscountActive).toBe(false);
      expect(result.sellingPrice).toBe(5000);
      expect(result.discountAmount).toBe(0);
    });
  });

  describe("Role-based Authorization & Security", () => {
    it("rejects unauthorized owner trying to modify another stay's room rate", async () => {
      await expect(
        service.upsertRate(unauthorizedOwner, {
          ashramId: "ashram-1",
          roomId: "room-1",
          mrp: 5000,
          discountPercent: 10,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("allows Super Admin to update rates for any stay", async () => {
      const result = await service.upsertRate(superAdmin, {
        ashramId: "ashram-1",
        roomId: "room-1",
        mrp: 6000,
        discountPercent: 10,
      });

      expect(result.mrp).toBe(6000);
      expect(result.sellingPrice).toBe(5400);
    });
  });

  describe("Bulk Rate Updates", () => {
    it("applies discount across multiple room categories while preserving distinct MRPs", async () => {
      const roomA = { ...mockRoom, _id: "room-1", basePrice: 4000 };
      const roomB = { ...mockRoom, _id: "room-2", basePrice: 8000 };
      mockRooms.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([roomA, roomB]) });

      const result = await service.bulkUpdate(ownerUser, {
        ashramId: "ashram-1",
        roomIds: ["room-1", "room-2"],
        discountPercent: 10,
        isDiscountActive: true,
      });

      expect(result.updatedCount).toBe(2);
      expect(result.rates[0].mrp).toBe(4000);
      expect(result.rates[0].sellingPrice).toBe(3600);
      expect(result.rates[1].mrp).toBe(8000);
      expect(result.rates[1].sellingPrice).toBe(7200);
    });
  });

  describe("Public Effective Rate", () => {
    it("returns public rate breakdown without requiring caller authentication", async () => {
      mockRoomRates.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          mrp: 5000,
          discountPercent: 6,
          discountAmount: 300,
          sellingPrice: 4700,
          isDiscountActive: true,
        }),
      });

      const rate = await service.getPublicEffectiveRate("room-1");

      expect(rate.mrp).toBe(5000);
      expect(rate.discountPercent).toBe(6);
      expect(rate.discountAmount).toBe(300);
      expect(rate.sellingPrice).toBe(4700);
    });
  });
});
