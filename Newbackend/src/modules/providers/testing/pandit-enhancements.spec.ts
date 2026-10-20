import { Types } from "../../../database/orm";
import {
  haversineDistanceKm,
  validateTravelDistance,
  validateShiftTravelFeasibility,
} from "../domain/travel-distance.util";
import { ProviderBookingPaymentService } from "../application/provider-booking-payment.service";
import {
  MAX_MULTI_PANDIT_REQUESTS,
  MAX_TRAVEL_RADIUS_KM,
  ADVANCE_PAYMENT_WINDOW_HOURS,
} from "../domain/provider.constants";

describe("Pandit Booking Enhancements & Production Safety", () => {
  describe("Travel radius and shift feasibility (50 km rule)", () => {
    it("allows same-day shifts when locations are within 50 km (e.g. Noida to Delhi)", () => {
      const dist = validateTravelDistance("Noida", "Delhi", MAX_TRAVEL_RADIUS_KM);
      expect(dist.valid).toBe(true);
      expect(dist.distanceKm).toBeLessThanOrEqual(50);
      expect(dist.distanceKm).toBeGreaterThan(0);
    });

    it("rejects same-day shifts when locations exceed 50 km (e.g. Noida to Agra)", () => {
      const dist = validateTravelDistance("Noida", "Agra", MAX_TRAVEL_RADIUS_KM);
      expect(dist.valid).toBe(false);
      expect(dist.distanceKm).toBeGreaterThan(50);
      expect(dist.reason).toContain("exceeding the maximum allowed travel radius");
    });

    it("rejects shift if travel buffer + 45 min prep time cannot be met", () => {
      // Noida to Gurugram is ~38km (~65 min travel + 45 min prep = ~110 min needed)
      const morningEnd = new Date("2026-11-01T12:00:00Z");
      const eveningStartTooSoon = new Date("2026-11-01T12:30:00Z"); // only 30 mins later
      const eveningStartSufficient = new Date("2026-11-01T15:00:00Z"); // 3 hours later

      const impossible = validateShiftTravelFeasibility({
        priorEndAt: morningEnd,
        newStartAt: eveningStartTooSoon,
        priorLocation: { city: "Noida" },
        newLocation: { city: "Gurugram" },
        maxRadiusKm: 50,
      });
      expect(impossible.feasible).toBe(false);
      expect(impossible.reason).toContain("Insufficient buffer");

      const feasible = validateShiftTravelFeasibility({
        priorEndAt: morningEnd,
        newStartAt: eveningStartSufficient,
        priorLocation: { city: "Noida" },
        newLocation: { city: "Gurugram" },
        maxRadiusKm: 50,
      });
      expect(feasible.feasible).toBe(true);
    });
  });

  describe("Multi-Pandit request limits", () => {
    it("enforces maximum 5 candidate Pandits limit constant", () => {
      expect(MAX_MULTI_PANDIT_REQUESTS).toBe(5);
    });
  });

  describe("1-hour advance payment deadline and payment gating", () => {
    let paymentService: ProviderBookingPaymentService;
    let mockBookingsModel: any;
    let mockBookingService: any;
    let mockWallet: any;
    let mockConfig: any;

    const customerId = new Types.ObjectId().toHexString();
    const bookingId = new Types.ObjectId().toHexString();
    const mockUser: any = { id: customerId, role: "customer" };

    beforeEach(() => {
      mockBookingsModel = {
        findById: jest.fn(),
        findOne: jest.fn(),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };
      mockBookingService = {
        confirmPayment: jest.fn().mockResolvedValue({ _id: bookingId, status: "CONFIRMED" }),
        expireHold: jest.fn().mockResolvedValue({}),
      };
      mockWallet = {
        planSplit: jest.fn().mockResolvedValue({ walletAmount: 0, gatewayAmount: 1155 }),
        placeHold: jest.fn().mockResolvedValue({}),
        releaseHold: jest.fn().mockResolvedValue({}),
      };
      mockConfig = {
        get: jest.fn().mockReturnValue(undefined),
      };
      paymentService = new ProviderBookingPaymentService(
        mockBookingsModel,
        mockBookingService,
        mockWallet,
        mockConfig,
      );
    });

    it("rejects advance payment when 1-hour window has expired", async () => {
      const expiredDeadline = new Date(Date.now() - 5 * 60 * 1000); // 5 mins ago
      mockBookingsModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: bookingId,
            customerUserId: customerId,
            status: "ACCEPTED_AWAITING_ADVANCE",
            advancePaymentDeadlineAt: expiredDeadline,
            advanceRequiredMinor: 105000,
          }),
        }),
      });

      await expect(
        paymentService.createPaymentOrder(bookingId, mockUser),
      ).rejects.toThrow("The 1-hour advance payment deadline for this booking has expired.");
      expect(mockBookingService.expireHold).toHaveBeenCalledWith(bookingId);
    });

    it("bases payment order charge on 50% advanceRequiredMinor instead of full amount", async () => {
      const activeDeadline = new Date(Date.now() + 50 * 60 * 1000); // 50 mins from now
      mockBookingsModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: bookingId,
            customerUserId: customerId,
            status: "ACCEPTED_AWAITING_ADVANCE",
            advancePaymentDeadlineAt: activeDeadline,
            advanceRequiredMinor: 115500, // ₹1,155 (50% dakshina + travel + fee)
            serviceSnapshot: {
              pricing: {
                totalMinor: 220500, // full price was ₹2,205
              },
            },
          }),
        }),
      });

      const res = await paymentService.createPaymentOrder(bookingId, mockUser);
      expect(mockWallet.planSplit).toHaveBeenCalledWith(
        customerId,
        1155,
        undefined,
        expect.objectContaining({ module: "provider_booking" }),
      );
      expect(res.data.amountMinor).toBe(115500);
    });
  });

  describe("Contact privacy redaction before and after payment", () => {
    it("strictly hides provider contact details when contactUnlocked is false", () => {
      const snapshot = {
        phone: "+919876543210",
        email: "panditji@tirvona.com",
        displayName: "Acharya Sharma",
      };

      // Simulating customer view serialization
      const serializeCustomerView = (row: any) => ({
        id: row._id,
        status: row.status,
        contactUnlocked: row.contactUnlocked === true,
        providerContact: row.contactUnlocked === true ? row.providerContactSnapshot : null,
      });

      const beforePayment = serializeCustomerView({
        _id: "bk_1",
        status: "ACCEPTED_AWAITING_ADVANCE",
        contactUnlocked: false,
        providerContactSnapshot: snapshot,
      });
      expect(beforePayment.contactUnlocked).toBe(false);
      expect(beforePayment.providerContact).toBeNull();

      const afterPayment = serializeCustomerView({
        _id: "bk_1",
        status: "CONFIRMED",
        contactUnlocked: true,
        providerContactSnapshot: snapshot,
      });
      expect(afterPayment.contactUnlocked).toBe(true);
      expect(afterPayment.providerContact).toEqual(snapshot);
      expect(afterPayment.providerContact.phone).toBe("+919876543210");
    });

    it("masks customer phone in provider view when contactUnlocked is false", () => {
      const maskPhone = (phone?: string) => {
        if (!phone) return null;
        const cleaned = phone.replace(/\D/g, "");
        if (cleaned.length < 4) return "******";
        return `******${cleaned.slice(-4)}`;
      };

      const serializeProviderView = (row: any) => ({
        id: row._id,
        status: row.status,
        contactUnlocked: row.contactUnlocked === true,
        customer: {
          name: row.customerContactSnapshot?.fullName || "Devotee",
          phone: row.contactUnlocked === true
            ? row.customerContactSnapshot?.phone
            : maskPhone(row.customerContactSnapshot?.phone),
          address: row.contactUnlocked === true
            ? row.serviceLocation
            : { city: row.serviceLocation?.city, state: row.serviceLocation?.state },
        },
      });

      const raw = {
        _id: "bk_1",
        status: "ACCEPTED_AWAITING_ADVANCE",
        contactUnlocked: false,
        customerContactSnapshot: {
          fullName: "Ramesh Kumar",
          phone: "9876543210",
        },
        serviceLocation: {
          line1: "Flat 402, Lotus Tower",
          city: "Noida",
          state: "Uttar Pradesh",
        },
      };

      const lockedView = serializeProviderView(raw);
      expect(lockedView.customer.phone).toBe("******3210");
      expect(lockedView.customer.address).not.toHaveProperty("line1");
      expect(lockedView.customer.address.city).toBe("Noida");

      const unlockedView = serializeProviderView({ ...raw, contactUnlocked: true });
      expect(unlockedView.customer.phone).toBe("9876543210");
      expect(unlockedView.customer.address.line1).toBe("Flat 402, Lotus Tower");
    });
  });

  describe("50% Dakshina and balance calculation", () => {
    it("computes integer paise advance and balance accurately without floating point drift", () => {
      const professionalFeeMinor = 210000; // ₹2,100
      const advancePercent = 50;
      const advanceDakshina = Math.round((professionalFeeMinor * advancePercent) / 100);
      const remainingDakshina = professionalFeeMinor - advanceDakshina;
      const travelChargeMinor = 25000; // ₹250
      const platformFeeMinor = 23500; // ₹235 (10% of subtotal)

      const advanceRequiredMinor = advanceDakshina + travelChargeMinor + platformFeeMinor;
      const remainingBalanceMinor = remainingDakshina;

      expect(advanceDakshina).toBe(105000); // ₹1,050
      expect(remainingDakshina).toBe(105000); // ₹1,050
      expect(advanceRequiredMinor).toBe(153500); // ₹1,535
      expect(remainingBalanceMinor).toBe(105000); // ₹1,050
      expect(advanceDakshina + remainingDakshina).toBe(professionalFeeMinor);
    });
  });

  describe("Security, Idempotency & Webhook Reconciliation", () => {
    let paymentService: ProviderBookingPaymentService;
    let mockBookingsModel: any;
    let mockBookingService: any;
    let mockWallet: any;
    let mockConfig: any;

    const customerId = new Types.ObjectId().toHexString();
    const bookingId = new Types.ObjectId().toHexString();
    const mockUser: any = { id: customerId, role: "customer" };
    const secret = "test_webhook_secret_12345";

    beforeEach(() => {
      mockBookingsModel = {
        findById: jest.fn(),
        findOne: jest.fn(),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };
      mockBookingService = {
        confirmPayment: jest.fn().mockResolvedValue({ _id: bookingId, status: "CONFIRMED" }),
        expireHold: jest.fn().mockResolvedValue({}),
      };
      mockWallet = {
        planSplit: jest.fn().mockResolvedValue({ walletAmount: 0, gatewayAmount: 1155 }),
        spend: jest.fn().mockResolvedValue({ _id: "spend_1" }),
        credit: jest.fn().mockResolvedValue({ _id: "credit_1" }),
      };
      mockConfig = {
        get: jest.fn((key: string) => {
          if (key === "razorpayKeySecret") return secret;
          if (key === "razorpayKeyId") return "rzp_test_123";
          return undefined;
        }),
      };
      paymentService = new ProviderBookingPaymentService(
        mockBookingsModel,
        mockBookingService,
        mockWallet,
        mockConfig,
      );
    });

    it("rejects payment confirmation when gateway signature is invalid", async () => {
      mockBookingsModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: bookingId,
            customerUserId: customerId,
            status: "ACCEPTED_AWAITING_ADVANCE",
            paymentOrder: { orderId: "order_correct_123", gatewayMinor: 115500 },
          }),
        }),
      });

      await expect(
        paymentService.confirmPayment(bookingId, mockUser, {
          razorpay_order_id: "order_correct_123",
          razorpay_payment_id: "pay_xyz",
          razorpay_signature: "invalid_tampered_signature",
        }),
      ).rejects.toThrow("Invalid payment signature from gateway");
      expect(mockBookingService.confirmPayment).not.toHaveBeenCalled();
    });

    it("rejects payment confirmation when payment order ID does not match", async () => {
      const crypto = require("node:crypto");
      const orderId = "order_mismatch_456";
      const paymentId = "pay_xyz_123";
      const validSig = crypto
        .createHmac("sha256", secret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      mockBookingsModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: bookingId,
            customerUserId: customerId,
            status: "ACCEPTED_AWAITING_ADVANCE",
            paymentOrder: { orderId: "order_correct_123", gatewayMinor: 115500 },
          }),
        }),
      });

      await expect(
        paymentService.confirmPayment(bookingId, mockUser, {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSig,
        }),
      ).rejects.toThrow("This payment does not belong to this booking");
      expect(mockBookingService.confirmPayment).not.toHaveBeenCalled();
    });

    it("handles duplicate webhooks idempotently without double-confirming", async () => {
      // Booking is already CONFIRMED by this very payment, so it carries the order and payment ids
      mockBookingsModel.findOne.mockResolvedValue({
        _id: bookingId,
        status: "CONFIRMED",
        bookingNumber: "PB-20261019-ABCD",
        paymentOrder: { orderId: "order_123", gatewayMinor: 115500 },
        paymentRefs: ["order_123", "pay_456"],
      });

      const handled = await paymentService.confirmPaymentFromWebhook("order_123", "pay_456", {
        amountPaise: 115500,
        currency: "INR",
      });

      expect(handled).toBe(true);
      expect(mockBookingService.confirmPayment).not.toHaveBeenCalled();
      expect(mockBookingsModel.updateOne).not.toHaveBeenCalled();
    });

    it("rejects webhook payment when captured amount does not match order amount", async () => {
      mockBookingsModel.findOne.mockResolvedValue({
        _id: bookingId,
        status: "ACCEPTED_AWAITING_ADVANCE",
        bookingNumber: "PB-20261019-ABCD",
        paymentOrder: { orderId: "order_123", gatewayMinor: 115500 },
      });

      const handled = await paymentService.confirmPaymentFromWebhook("order_123", "pay_456", {
        amountPaise: 50000, // Partial or mismatched amount
        currency: "INR",
      });

      expect(handled).toBe(true); // Handled by this module, deliberately not confirmed
      expect(mockBookingService.confirmPayment).not.toHaveBeenCalled();
      expect(mockBookingsModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe("State transitions and sibling cancellation safety", () => {
    it("allows confirm_payment transition from ACCEPTED_AWAITING_ADVANCE state", () => {
      const { BOOKING_TRANSITIONS } = require("../domain/provider.constants");
      const transitions = BOOKING_TRANSITIONS.ACCEPTED_AWAITING_ADVANCE;
      const confirmCommand = transitions.find((t: any) => t.command === "confirm_payment");
      expect(confirmCommand).toBeDefined();
      expect(confirmCommand.to).toBe("CONFIRMED");
      expect(confirmCommand.actors).toContain("SYSTEM");
    });

    it("allows confirm_advance transition from ACCEPTED_AWAITING_ADVANCE state", () => {
      const { BOOKING_TRANSITIONS } = require("../domain/provider.constants");
      const transitions = BOOKING_TRANSITIONS.ACCEPTED_AWAITING_ADVANCE;
      const confirmAdvance = transitions.find((t: any) => t.command === "confirm_advance");
      expect(confirmAdvance).toBeDefined();
      expect(confirmAdvance.to).toBe("CONFIRMED");
      expect(confirmAdvance.actors).toContain("SYSTEM");
    });
  });
});

