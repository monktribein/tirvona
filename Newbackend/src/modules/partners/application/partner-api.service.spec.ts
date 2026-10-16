import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PartnerApiService } from "./partner-api.service";
import type { AuthenticatedPartnerContext } from "../decorators/current-partner.decorator";

describe("PartnerApiService", () => {
  let service: PartnerApiService;
  let mockBookingModel: any;
  let mockPaymentModel: any;
  let mockRoomModel: any;
  let mockInventoryModel: any;
  let mockAshramModel: any;

  const mockGlobalPartner: AuthenticatedPartnerContext = {
    partnerId: "partner-global",
    partnerName: "Global OTA",
    partnerSlug: "global-ota",
    environment: "production",
    scopedAshramIds: [],
    permissions: ["bookings.read", "inventory.read", "payments.read"],
    keyId: "key-1",
    keyPrefix: "tv_live_abc123",
  };

  const mockScopedPartner: AuthenticatedPartnerContext = {
    partnerId: "partner-scoped",
    partnerName: "Scoped Partner",
    partnerSlug: "scoped-partner",
    environment: "sandbox",
    scopedAshramIds: ["ashram-1", "ashram-2"],
    permissions: ["bookings.read", "inventory.read", "payments.read"],
    keyId: "key-2",
    keyPrefix: "tv_test_xyz789",
  };

  beforeEach(() => {
    mockBookingModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([
                  {
                    _id: "book-1",
                    bookingId: "TIR-1001",
                    ashramId: "ashram-1",
                    status: "confirmed",
                    checkInDate: new Date("2026-11-01"),
                    checkOutDate: new Date("2026-11-03"),
                  },
                ]),
              }),
            }),
          }),
        }),
      }),
      countDocuments: jest.fn().mockResolvedValue(1),
      findOne: jest.fn(),
    };

    mockPaymentModel = {
      findOne: jest.fn(),
    };

    mockRoomModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: "room-1",
            ashramId: "ashram-1",
            name: "Standard AC Room",
            type: "private_room",
            totalInventory: 10,
            basePrice: 1500,
          },
        ]),
      }),
    };

    mockInventoryModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            roomId: "room-1",
            date: new Date("2026-11-01T00:00:00.000Z"),
            totalInventory: 10,
            bookedCount: 3,
            heldCount: 1,
            maintenanceCount: 0,
            customPrice: 1600,
            isClosed: false,
          },
        ]),
      }),
    };

    mockAshramModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "ashram-1",
          name: "Sri Ramanasramam",
        }),
      }),
    };

    service = new PartnerApiService(
      mockBookingModel,
      mockPaymentModel,
      mockRoomModel,
      mockInventoryModel,
      mockAshramModel,
    );
  });

  describe("listBookings", () => {
    it("filters bookings strictly within scoped ashram IDs for scoped partners", async () => {
      const res = await service.listBookings(mockScopedPartner, {});

      expect(mockBookingModel.find).toHaveBeenCalledWith({
        ashramId: { $in: ["ashram-1", "ashram-2"] },
      });
      expect(res.items).toHaveLength(1);
      expect(res.meta.total).toBe(1);
    });

    it("allows global partner to query all ashrams without restriction", async () => {
      await service.listBookings(mockGlobalPartner, {});

      expect(mockBookingModel.find).toHaveBeenCalledWith({});
    });

    it("allows scoped partner to query specific ashram within their allowed scope", async () => {
      await service.listBookings(mockScopedPartner, { ashramId: "ashram-1" });

      expect(mockBookingModel.find).toHaveBeenCalledWith({
        ashramId: "ashram-1",
      });
    });

    it("rejects scoped partner attempting to query an ashram outside their scope", async () => {
      await expect(
        service.listBookings(mockScopedPartner, { ashramId: "ashram-999" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("applies checkInDate filter when startDate and endDate are provided", async () => {
      await service.listBookings(mockGlobalPartner, {
        startDate: "2026-11-01",
        endDate: "2026-11-05",
      });

      expect(mockBookingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          checkInDate: {
            $gte: new Date("2026-11-01"),
            $lte: new Date("2026-11-05"),
          },
        }),
      );
    });
  });

  describe("getBooking", () => {
    it("returns booking when ashram is in partner scope", async () => {
      mockBookingModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: "book-1",
            bookingId: "TIR-1001",
            ashramId: "ashram-1",
            status: "confirmed",
          }),
        }),
      });

      const booking = await service.getBooking(mockScopedPartner, "TIR-1001");
      expect(booking.bookingId).toBe("TIR-1001");
    });

    it("throws ForbiddenException when booking belongs to an ashram outside partner scope", async () => {
      mockBookingModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: "book-2",
            bookingId: "TIR-2002",
            ashramId: "ashram-999",
            status: "confirmed",
          }),
        }),
      });

      await expect(
        service.getBooking(mockScopedPartner, "TIR-2002"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws NotFoundException when booking does not exist", async () => {
      mockBookingModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.getBooking(mockScopedPartner, "NONEXISTENT"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getAvailability", () => {
    it("throws ForbiddenException if requested ashram is not in partner scope", async () => {
      await expect(
        service.getAvailability(mockScopedPartner, {
          ashramId: "ashram-999",
          startDate: "2026-11-01",
          endDate: "2026-11-02",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws BadRequestException for invalid date range", async () => {
      await expect(
        service.getAvailability(mockGlobalPartner, {
          ashramId: "ashram-1",
          startDate: "2026-11-05",
          endDate: "2026-11-01", // start > end
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("correctly calculates available inventory subtracting booked and held units", async () => {
      const result = await service.getAvailability(mockGlobalPartner, {
        ashramId: "ashram-1",
        startDate: "2026-11-01",
        endDate: "2026-11-01",
      });

      expect(result.ashramName).toBe("Sri Ramanasramam");
      expect(result.rooms).toHaveLength(1);
      const room = result.rooms[0];
      expect(room.roomName).toBe("Standard AC Room");
      expect(room.roomType).toBe("private_room");
      expect(room.daily).toHaveLength(1);
      const day = room.daily[0];
      // capacity (10) - booked (3) - held (1) = 6
      expect(day.capacity).toBe(10);
      expect(day.booked).toBe(3);
      expect(day.held).toBe(1);
      expect(day.available).toBe(6);
      expect(day.price).toBe(1600);
      expect(room.minAvailableAcrossDates).toBe(6);
    });
  });

  describe("getPaymentStatus", () => {
    it("returns sanitized payment details for in-scope booking", async () => {
      mockPaymentModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "pay-1",
          bookingId: "TIR-1001",
          ashramId: "ashram-1",
          amount: 3200,
          currency: "INR",
          status: "captured",
          method: "upi",
          paidAt: new Date("2026-10-15T10:00:00Z"),
          transactionId: "pay_rzp_12345",
          gateway: {
            orderId: "order_rzp_67890",
            secretSignature: "secret_should_never_leak",
          },
        }),
      });

      const res = await service.getPaymentStatus(mockScopedPartner, "pay-1");

      expect(res.paymentId).toBe("pay-1");
      expect(res.amount).toBe(3200);
      expect(res.status).toBe("captured");
      expect(res.transactionId).toBe("pay_rzp_12345");
      expect(res.gatewayOrderId).toBe("order_rzp_67890");
      // Must not leak internal gateway signature or credentials
      expect((res as any).gateway).toBeUndefined();
      expect((res as any).secretSignature).toBeUndefined();
    });

    it("throws ForbiddenException when payment belongs to an ashram outside partner scope", async () => {
      mockPaymentModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "pay-2",
          bookingId: "TIR-2002",
          ashramId: "ashram-999",
          amount: 5000,
        }),
      });

      await expect(
        service.getPaymentStatus(mockScopedPartner, "pay-2"),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
