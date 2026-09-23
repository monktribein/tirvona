import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import { DayStayInventoryService } from "../application/day-stay-inventory.service";
import { DayStayBookingService } from "../application/day-stay-booking.service";
import { DayStayProductsService } from "../application/day-stay-products.service";
import { DayStayVendorService } from "../application/day-stay-vendor.service";
import { TransactionService } from "../../../common/database/transaction.service";
import { createHmac } from "node:crypto";

/** A genuine Razorpay checkout signature under the test key secret. */
const sign = (orderId: string, paymentId: string, secret = "mock_secret") =>
  createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");

// Mirrors DayStayBookingService's own signature computation so tests can
// simulate a real, valid Razorpay checkout callback instead of relying on
// the (now-closed) "missing signature" bypass.
const validSignature = (orderId: string, paymentId: string) =>
  createHmac("sha256", "mock_secret").update(`${orderId}|${paymentId}`).digest("hex");

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
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
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

  /** Per-test config overrides; anything unset reads as "mock_secret". */
  let configOverrides: Record<string, string | undefined> = {};

  beforeEach(async () => {
    configOverrides = {};
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
          useValue: {
            get: jest.fn((key: string) =>
              key in configOverrides ? configOverrides[key] : "mock_secret",
            ),
          },
        },
      ],
    }).compile();

    inventoryService = module.get<DayStayInventoryService>(DayStayInventoryService);
    bookingService = module.get<DayStayBookingService>(DayStayBookingService);
    vendorService = module.get<DayStayVendorService>(DayStayVendorService);

    // holdSlot's per-room lock: grant it by default (simulates no contention).
    mockRoomModel.findOneAndUpdate.mockResolvedValue({ _id: "room_01" });
    mockRoomModel.updateOne.mockResolvedValue({});
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

    it("treats an explicit allocatedInventory of 0 as zero slots, not 'unset'", async () => {
      mockAshramModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "ashram_01",
          dayStayConfig: { enabled: true, operatingHours: { start: "08:00", end: "12:00" } },
        }),
      });

      mockRoomModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "room_01",
          ashramId: "ashram_01",
          totalInventory: 15, // the room's full overnight inventory
          dayStayConfig: {
            enabled: true,
            allocatedInventory: 0, // owner enabled Day Stay but never allocated units
            products: [
              {
                productCode: "DAY_REST_3H",
                productType: "day_rest",
                durationMinutes: 180,
                price: 800,
                enabled: true,
              },
            ],
          },
        }),
      });

      mockBookingModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      const slots = await inventoryService.getRoomSlots("ashram_01", "room_01", "2026-10-01", "DAY_REST_3H");

      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((s) => s.availableUnits === 0 && !s.isAvailable)).toBe(true);
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

    it("rejects hold when the per-room lock is already held by another in-flight request", async () => {
      mockAshramModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "ashram_01",
          dayStayConfig: { enabled: true, operatingHours: { start: "06:00", end: "20:00" } },
        }),
      });
      mockRoomModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "room_01",
          dayStayConfig: {
            enabled: true,
            allocatedInventory: 2,
            products: [{ productCode: "DAY_REST_4H", durationMinutes: 240, price: 700, enabled: true }],
          },
        }),
      });
      // Lock is currently held by someone else's in-flight hold request.
      mockRoomModel.findOneAndUpdate.mockResolvedValueOnce(null);

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
          "customer_01",
        ),
      ).rejects.toThrow(/busy processing another booking request/);
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
<<<<<<< Updated upstream
          razorpaySignature: validSignature("order_rzp_001", "pay_rzp_001"),
=======
          razorpaySignature: sign("order_rzp_001", "pay_rzp_001"),
>>>>>>> Stashed changes
        },
        "cust_01",
      );

      expect(res.status).toBe("confirmed");
      expect(doc.status).toBe("confirmed");
      expect(doc.paymentStatus).toBe("fully_paid");
      expect(doc.save).toHaveBeenCalled();
    });

    it("A2. Browser confirmation without a signature is rejected", async () => {
      const doc = createPendingBookingDoc();
      mockBookingModel.findOne.mockResolvedValue(doc);

      await expect(
        bookingService.confirmPayment(
          {
            bookingId: "BK-DAY-001",
            razorpayOrderId: "order_rzp_001",
            razorpayPaymentId: "pay_rzp_001",
          },
          "cust_01",
        ),
      ).rejects.toThrow(/signature/i);
      expect(doc.status).toBe("pending");
    });

    it("A3. Browser confirmation for someone else's booking is rejected", async () => {
      const doc = createPendingBookingDoc();
      mockBookingModel.findOne.mockResolvedValue(doc);

      await expect(
        bookingService.confirmPayment(
          {
            bookingId: "BK-DAY-001",
            razorpayOrderId: "order_rzp_001",
            razorpayPaymentId: "pay_rzp_001",
            razorpaySignature: validSignature("order_rzp_001", "pay_rzp_001"),
          },
          "someone_else",
        ),
      ).rejects.toThrow(/not found/i);
      expect(doc.status).toBe("pending");
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
          razorpaySignature: sign("order_rzp_001", "pay_rzp_001"),
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
<<<<<<< Updated upstream
            razorpaySignature: validSignature("order_rzp_001", "pay_rzp_001"),
=======
            razorpaySignature: sign("order_rzp_001", "pay_rzp_001"),
>>>>>>> Stashed changes
          },
          "cust_01",
        ),
      ).rejects.toThrow(/full refund has been initiated/);

      expect(expiredDoc.status).toBe("cancelled");
      expect(expiredDoc.paymentStatus).toBe("refunded");
    });

    it("H2. Payment succeeds after hold expiry but the booking's own pending row must not count as a competing occupant", async () => {
      // Fixed, 30-minute-grid-aligned slot time (rather than "now") so the
      // inventory engine's generated slots are guaranteed to include an
      // exact match regardless of when this test happens to run.
      const expiredDoc = createPendingBookingDoc({
        reservationExpiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
        dayStayDetails: {
          productCode: "DAY_REST_3H",
          slotStartTime: new Date("2026-10-01T09:00:00.000Z"),
          slotEndTime: new Date("2026-10-01T12:00:00.000Z"),
          durationMinutes: 180,
        },
      });
      mockBookingModel.findOne.mockResolvedValue(expiredDoc);

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
      // No genuinely competing booking exists — the availability recheck
      // must exclude the booking being confirmed itself.
      mockBookingModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await bookingService.confirmPayment(
        {
          bookingId: "BK-DAY-001",
          razorpayOrderId: "order_rzp_001",
          razorpayPaymentId: "pay_rzp_001",
          razorpaySignature: validSignature("order_rzp_001", "pay_rzp_001"),
        },
        "cust_01",
      );

      expect(res.status).toBe("confirmed");
      expect(expiredDoc.status).toBe("confirmed");
      expect(expiredDoc.paymentStatus).toBe("fully_paid");

      // The recheck must have asked the inventory service to exclude this
      // booking's own id from the competing-bookings query.
      const findCall = mockBookingModel.find.mock.calls.at(-1)?.[0];
      expect(findCall?._id?.$ne).toBe("bk_id_001");
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
<<<<<<< Updated upstream
            razorpaySignature: validSignature("order_rzp_001", "pay_rzp_001"),
=======
            razorpaySignature: sign("order_rzp_001", "pay_rzp_001"),
>>>>>>> Stashed changes
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

    describe("client confirmation cannot settle a booking without a real payment", () => {
      const attempt = (dto: Record<string, string | undefined>, customer = "cust_01") =>
        bookingService.confirmPayment(
          {
            bookingId: "BK-DAY-001",
            razorpayOrderId: "order_rzp_001",
            razorpayPaymentId: "pay_rzp_001",
            ...dto,
          } as any,
          customer,
        );

      beforeEach(() => {
        mockNotificationModel.findOne.mockResolvedValue(null);
      });

      it("refuses a confirmation with no signature", async () => {
        const doc = createPendingBookingDoc();
        mockBookingModel.findOne.mockResolvedValue(doc);
        await expect(attempt({})).rejects.toThrow(/signature is required/);
        expect(doc.status).toBe("pending");
        expect(doc.save).not.toHaveBeenCalled();
      });

      it.each([
        ["a mock_ payment id", { razorpayPaymentId: "mock_1", razorpaySignature: "x" }],
        ["a pay_sim_ payment id", { razorpayPaymentId: "pay_sim_1", razorpaySignature: "x" }],
        ["the demo signature", { razorpaySignature: "demo_simulated_sig" }],
        ["a forged signature", { razorpaySignature: sign("order_rzp_001", "pay_rzp_001", "wrong") }],
      ])("refuses %s", async (_label, dto) => {
        const doc = createPendingBookingDoc();
        mockBookingModel.findOne.mockResolvedValue(doc);
        await expect(attempt(dto)).rejects.toThrow(/signature/);
        expect(doc.paymentStatus).toBe("pending");
        expect(doc.save).not.toHaveBeenCalled();
      });

      it("refuses a genuine payment for a different Razorpay order", async () => {
        const doc = createPendingBookingDoc();
        mockBookingModel.findOne.mockResolvedValue(doc);
        await expect(
          attempt({
            razorpayOrderId: "order_other",
            razorpaySignature: sign("order_other", "pay_rzp_001"),
          }),
        ).rejects.toThrow(/does not belong to this booking/);
        expect(doc.save).not.toHaveBeenCalled();
      });

      it("only ever looks up the caller's own booking", async () => {
        mockBookingModel.findOne.mockResolvedValue(null);
        await expect(
          attempt({ razorpaySignature: sign("order_rzp_001", "pay_rzp_001") }, "someone_else"),
        ).rejects.toThrow(/not found/i);
        expect(mockBookingModel.findOne).toHaveBeenLastCalledWith(
          expect.objectContaining({ customerId: "someone_else" }),
        );
      });

      it("refuses in production when no Razorpay secret is configured", async () => {
        configOverrides = { razorpayKeySecret: undefined, nodeEnv: "production" };
        const doc = createPendingBookingDoc();
        mockBookingModel.findOne.mockResolvedValue(doc);
        await expect(attempt({})).rejects.toThrow(/not configured/);
        expect(doc.save).not.toHaveBeenCalled();
      });

      it("allows an unsigned confirmation only in local development without a secret", async () => {
        configOverrides = { razorpayKeySecret: undefined, nodeEnv: "development" };
        const doc = createPendingBookingDoc();
        mockBookingModel.findOne.mockResolvedValue(doc);
        const res = await attempt({});
        expect(res.status).toBe("confirmed");
      });
    });
  });
});
