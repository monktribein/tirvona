import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { DayStayInventoryService } from "../application/day-stay-inventory.service";
import { DayStayBookingService } from "../application/day-stay-booking.service";
import { DayStayProductsService } from "../application/day-stay-products.service";
import { DayStayVendorService } from "../application/day-stay-vendor.service";
import { TransactionService } from "../../../common/database/transaction.service";

describe("DayStay Engine Unit & Integration Tests", () => {
  let inventoryService: DayStayInventoryService;
  let bookingService: DayStayBookingService;
  let vendorService: DayStayVendorService;

  const mockAshramModel: any = {
    findById: jest.fn(),
    findOne: jest.fn(),
  };

  const mockRoomModel: any = {
    findOne: jest.fn(),
  };

  const mockBookingModel: any = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockHistoryModel: any = {
    create: jest.fn(),
  };

  const mockProductModel: any = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockNotificationModel: any = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DayStayInventoryService,
        DayStayBookingService,
        DayStayProductsService,
        DayStayVendorService,
        { provide: getModelToken("Ashram"), useValue: mockAshramModel },
        { provide: getModelToken("Room"), useValue: mockRoomModel },
        { provide: getModelToken("Booking"), useValue: mockBookingModel },
        { provide: getModelToken("BookingStatusHistory"), useValue: mockHistoryModel },
        { provide: getModelToken("BookingNotification"), useValue: mockNotificationModel },
        { provide: getModelToken("DayStayProduct"), useValue: mockProductModel },
        {
          provide: TransactionService,
          useValue: { run: jest.fn((cb) => cb({})) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue("mock_secret") },
        },
      ],
    }).compile();

    inventoryService = module.get<DayStayInventoryService>(DayStayInventoryService);
    bookingService = module.get<DayStayBookingService>(DayStayBookingService);
    vendorService = module.get<DayStayVendorService>(DayStayVendorService);
  });

  describe("1. Time Interval Overlap & Availability Engine", () => {
    it("calculates available slots considering grace and housekeeping turnaround buffer", async () => {
      mockAshramModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "ashram_01",
          dayStayConfig: {
            enabled: true,
            operatingHours: { start: "08:00", end: "14:00" },
            defaultGraceMinutes: 15,
            defaultHousekeepingBufferMinutes: 45,
          },
        }),
      });

      mockRoomModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "room_01",
          ashramId: "ashram_01",
          dayStayConfig: {
            enabled: true,
            allocatedInventory: 1, // 1 slot available at any given time
            products: [
              {
                productCode: "DAY_REST_3H",
                productType: "day_rest",
                durationMinutes: 180,
                price: 800,
                discountPrice: 700,
                enabled: true,
              },
            ],
          },
        }),
      });

      // Existing booking from 08:00 to 11:00 UTC
      // Turnaround window: 08:00 to 11:00 + 15m grace + 45m buffer = 12:00 UTC
      mockBookingModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            bookingType: "day_rest",
            status: "confirmed",
            roomsBookedCount: 1,
            dayStayDetails: {
              slotStartTime: new Date("2026-10-01T08:00:00.000Z"),
              slotEndTime: new Date("2026-10-01T11:00:00.000Z"),
              graceMinutes: 15,
              housekeepingBufferMinutes: 45,
            },
          },
        ]),
      });

      const slots = await inventoryService.getRoomSlots("ashram_01", "room_01", "2026-10-01", "DAY_REST_3H");

      expect(slots.length).toBeGreaterThan(0);

      // Slot at 08:00 should be unavailable (occupied)
      const slot8am = slots.find((s) => s.startTime === "08:00");
      expect(slot8am?.isAvailable).toBe(false);
      expect(slot8am?.availableUnits).toBe(0);

      // Slot at 09:00 should be unavailable (overlaps with 08:00-12:00 occupied window)
      const slot9am = slots.find((s) => s.startTime === "09:00");
      expect(slot9am?.isAvailable).toBe(false);

      // Next sellable slot should start at 12:00 (after 11:00 + 15m grace + 45m buffer)
      const slot12pm = slots.find((s) => s.startTime === "11:00");
      // 11:00 overlaps turnaround (which ends at 12:00)
      expect(slot12pm?.isAvailable).toBe(false);
    });
  });

  describe("2. Atomic Slot Holding & Double Booking Protection", () => {
    it("successfully creates a 10-minute hold for available slot", async () => {
      mockAshramModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "ashram_01",
          dayStayConfig: {
            enabled: true,
            operatingHours: { start: "06:00", end: "20:00" },
            defaultGraceMinutes: 15,
            defaultHousekeepingBufferMinutes: 45,
          },
        }),
      });

      mockRoomModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "room_01",
          ashramId: "ashram_01",
          dayStayConfig: {
            enabled: true,
            allocatedInventory: 2,
            products: [
              {
                productCode: "DAY_REST_4H",
                productType: "day_rest",
                durationMinutes: 240,
                price: 700,
                discountPrice: 650,
                enabled: true,
              },
            ],
          },
        }),
      });

      mockBookingModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      mockBookingModel.create.mockResolvedValue({
        _id: "doc_123",
        bookingId: "BK-12345",
        reservationNumber: "RES-12345",
      });

      const res = await bookingService.holdSlot(
        {
          ashramId: "ashram_01",
          roomId: "room_01",
          productCode: "DAY_REST_4H",
          date: "2026-10-01",
          startTime: "09:00",
          guestsCount: 2,
        },
        "customer_01",
      );

      expect(res.bookingId).toBeDefined();
      expect(res.durationMinutes).toBe(240);
      expect(res.pricing.basePrice).toBe(650);
      expect(mockBookingModel.create).toHaveBeenCalled();
      expect(mockHistoryModel.create).toHaveBeenCalled();
    });

    it("rejects hold if another user just took the final remaining slot", async () => {
      mockAshramModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "ashram_01",
          dayStayConfig: {
            enabled: true,
            operatingHours: { start: "06:00", end: "20:00" },
          },
        }),
      });

      mockRoomModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "room_01",
          ashramId: "ashram_01",
          dayStayConfig: {
            enabled: true,
            allocatedInventory: 1, // Only 1 slot
            products: [
              {
                productCode: "DAY_REST_4H",
                productType: "day_rest",
                durationMinutes: 240,
                price: 700,
                enabled: true,
              },
            ],
          },
        }),
      });

      mockBookingModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            bookingType: "day_rest",
            status: "pending",
            roomsBookedCount: 1,
            dayStayDetails: {
              slotStartTime: new Date("2026-10-01T09:00:00.000Z"),
              slotEndTime: new Date("2026-10-01T13:00:00.000Z"),
            },
          },
        ]),
      });

      await expect(
        bookingService.holdSlot(
          {
            ashramId: "ashram_01",
            roomId: "room_01",
            productCode: "DAY_REST_4H",
            date: "2026-10-01",
            startTime: "09:00",
            guestsCount: 1,
          },
          "customer_02",
        ),
      ).rejects.toThrow(/ConflictException|just selected by another pilgrim/);
    });
  });

  describe("3. Vendor Blocking Controls", () => {
    it("allows vendor to instantly block Day Stay for today and tomorrow", async () => {
      const ashramDoc: any = {
        _id: "ashram_01",
        ownerId: "owner_01",
        dayStayConfig: { enabled: true, isBlockedToday: false },
        save: jest.fn().mockResolvedValue(true),
      };

      mockAshramModel.findOne.mockResolvedValue(ashramDoc);

      await vendorService.blockDayStay(
        { ashramId: "ashram_01", action: "today" },
        "owner_01",
      );

      expect(ashramDoc.dayStayConfig.isBlockedToday).toBe(true);
      expect(ashramDoc.save).toHaveBeenCalled();
    });
  });

  describe("4. Payment Reconciliation & Orphaned Payment Recovery (DAYSTAY-020 Scenarios)", () => {
    const createPendingBookingDoc = (overrides: any = {}) => ({
      _id: "bk_id_001",
      bookingId: "BK-DAY-001",
      reservationNumber: "RES-DAY-001",
      customerId: "cust_01",
      ashramId: "ashram_01",
      rooms: [{ roomId: "room_01" }],
      bookingType: "day_rest",
      status: "pending",
      paymentStatus: "pending",
      pricing: { totalAmount: 826 },
      dayStayDetails: {
        productCode: "DAY_REST_3H",
        slotStartTime: new Date(Date.now() + 3600000),
        slotEndTime: new Date(Date.now() + 4 * 3600000),
        durationMinutes: 180,
      },
      reservationExpiresAt: new Date(Date.now() + 600000), // 10m in future
      paymentSummary: { razorpayOrderId: "order_rzp_001" },
      checkInCode: "1234",
      save: jest.fn().mockResolvedValue(true),
      ...overrides,
    });

    it("A. Browser confirmation succeeds", async () => {
      const doc = createPendingBookingDoc();
      mockBookingModel.findOne.mockResolvedValue(doc);
      mockNotificationModel.findOne.mockResolvedValue(null);

      const res = await bookingService.confirmPayment(
        {
          bookingId: "BK-DAY-001",
          razorpayOrderId: "order_rzp_001",
          razorpayPaymentId: "pay_rzp_001",
        },
        "cust_01",
      );

      expect(res.status).toBe("confirmed");
      expect(doc.status).toBe("confirmed");
      expect(doc.paymentStatus).toBe("fully_paid");
      expect(doc.save).toHaveBeenCalled();
    });

    it("B. Webhook succeeds for orphaned payment when browser disconnects (Scenario G)", async () => {
      const doc = createPendingBookingDoc();
      mockBookingModel.findOne.mockResolvedValue(doc);
      mockNotificationModel.findOne.mockResolvedValue(null);

      const reconciled = await bookingService.confirmPaymentFromWebhook(
        "order_rzp_001",
        "pay_rzp_001",
      );

      expect(reconciled).toBe(true);
      expect(doc.status).toBe("confirmed");
      expect(doc.paymentStatus).toBe("fully_paid");
    });

    it("C & D & E. Duplicate webhook / duplicate browser confirmations are idempotent", async () => {
      mockNotificationModel.create.mockClear();
      mockNotificationModel.findOne.mockResolvedValue({ _id: "notif_existing" });
      const doc = createPendingBookingDoc({ status: "confirmed", paymentStatus: "fully_paid" });
      mockBookingModel.findOne.mockResolvedValue(doc);

      // 1st duplicate browser confirmation
      const res = await bookingService.confirmPayment(
        {
          bookingId: "BK-DAY-001",
          razorpayOrderId: "order_rzp_001",
          razorpayPaymentId: "pay_rzp_001",
        },
        "cust_01",
      );
      expect(res.status).toBe("confirmed");

      // 2nd duplicate webhook
      const webhookRes = await bookingService.confirmPaymentFromWebhook(
        "order_rzp_001",
        "pay_rzp_001",
      );
      expect(webhookRes).toBe(true);

      // Notification should NOT be created for already confirmed duplicate deliveries
      expect(mockNotificationModel.create).not.toHaveBeenCalled();
    });

    it("H. Payment succeeds after hold expiry when slot is occupied -> triggers auto-refund state", async () => {
      const expiredDoc = createPendingBookingDoc({
        reservationExpiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
      });
      mockBookingModel.findOne.mockResolvedValue(expiredDoc);

      // Mock inventory indicating 0 available units for that slot now
      mockAshramModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "ashram_01",
          dayStayConfig: { enabled: true, operatingHours: { start: "06:00", end: "20:00" } },
        }),
      });
      mockRoomModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "room_01",
          dayStayConfig: { enabled: true, allocatedInventory: 1, products: [{ productCode: "DAY_REST_3H", enabled: true, durationMinutes: 180 }] },
        }),
      });
      mockBookingModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            bookingType: "day_rest",
            status: "confirmed",
            roomsBookedCount: 1,
            dayStayDetails: {
              slotStartTime: expiredDoc.dayStayDetails.slotStartTime,
              slotEndTime: expiredDoc.dayStayDetails.slotEndTime,
            },
          },
        ]),
      });

      await expect(
        bookingService.confirmPayment(
          {
            bookingId: "BK-DAY-001",
            razorpayOrderId: "order_rzp_001",
            razorpayPaymentId: "pay_rzp_001",
          },
          "cust_01",
        ),
      ).rejects.toThrow(/full refund has been initiated/);

      expect(expiredDoc.status).toBe("cancelled");
      expect(expiredDoc.paymentStatus).toBe("refunded");
    });

    it("L. Unknown payment/order ID returns false from webhook handler", async () => {
      mockBookingModel.findOne.mockResolvedValue(null);

      const res = await bookingService.confirmPaymentFromWebhook(
        "unknown_order_999",
        "pay_999",
      );

      expect(res).toBe(false);
    });

    it("CONCURRENCY TEST: Concurrent browser and webhook confirmation converges safely", async () => {
      const doc = createPendingBookingDoc();
      mockBookingModel.findOne.mockResolvedValue(doc);
      mockNotificationModel.findOne.mockResolvedValue(null);

      // Simulate simultaneous execution of client callback and webhook arrival
      const [clientResult, webhookResult] = await Promise.all([
        bookingService.confirmPayment(
          {
            bookingId: "BK-DAY-001",
            razorpayOrderId: "order_rzp_001",
            razorpayPaymentId: "pay_rzp_001",
          },
          "cust_01",
        ),
        bookingService.confirmPaymentFromWebhook("order_rzp_001", "pay_rzp_001"),
      ]);

      expect(clientResult.status).toBe("confirmed");
      expect(webhookResult).toBe(true);
      expect(doc.status).toBe("confirmed");
      expect(doc.paymentStatus).toBe("fully_paid");
    });
  });
});
