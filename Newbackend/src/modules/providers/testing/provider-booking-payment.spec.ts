import { Types } from "../../../database/orm";
import { ProviderBookingPaymentService } from "../application/provider-booking-payment.service";

describe("ProviderBookingPaymentService", () => {
  let service: ProviderBookingPaymentService;
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
    };

    mockWallet = {
      planSplit: jest.fn().mockResolvedValue({ walletAmount: 0, gatewayAmount: 1500 }),
      placeHold: jest.fn().mockResolvedValue({}),
      releaseHold: jest.fn().mockResolvedValue({}),
      spend: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      credit: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    };

    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === "razorpayKeyId") return undefined; // test unconfigured initially
        if (key === "razorpayKeySecret") return undefined;
        return undefined;
      }),
    };

    service = new ProviderBookingPaymentService(
      mockBookingsModel,
      mockBookingService,
      mockWallet,
      mockConfig,
    );
  });

  describe("createPaymentOrder", () => {
    it("rejects when booking does not exist", async () => {
      mockBookingsModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.createPaymentOrder(bookingId, mockUser),
      ).rejects.toThrow("Booking not found");
    });

    it("treats a booking the caller does not own as not found", async () => {
      mockBookingsModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: bookingId,
            customerUserId: new Types.ObjectId(), // different user
            status: "PAYMENT_PENDING",
          }),
        }),
      });

      await expect(
        service.createPaymentOrder(bookingId, mockUser),
      ).rejects.toThrow("Booking not found");
    });

    it("rejects when calendar hold has expired", async () => {
      mockBookingsModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: bookingId,
            customerUserId: customerId,
            status: "PAYMENT_PENDING",
            holdExpiresAt: new Date(Date.now() - 60_000), // expired 1m ago
            serviceSnapshot: { pricing: { totalMinor: 150000 } },
          }),
        }),
      });

      await expect(
        service.createPaymentOrder(bookingId, mockUser),
      ).rejects.toThrow("The calendar hold for this booking has expired");
    });

    it("safely reports configuration blocker when Razorpay credentials are missing", async () => {
      mockBookingsModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: bookingId,
            customerUserId: customerId,
            status: "PAYMENT_PENDING",
            bookingNumber: "PJ-261009-ABC123",
            holdExpiresAt: new Date(Date.now() + 600_000),
            serviceSnapshot: { pricing: { totalMinor: 150000 } },
          }),
        }),
      });

      const res = await service.createPaymentOrder(bookingId, mockUser);
      expect(res.configured).toBe(false);
      expect(res.blocker).toBe("RAZORPAY_CREDENTIALS_MISSING");
      expect(res.data.amountMinor).toBe(150000);
      expect(mockBookingService.confirmPayment).not.toHaveBeenCalled();
    });

    it("settles 100% wallet payments immediately without gateway order", async () => {
      mockBookingsModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: bookingId,
            customerUserId: customerId,
            status: "PAYMENT_PENDING",
            bookingNumber: "PJ-261009-ABC123",
            holdExpiresAt: new Date(Date.now() + 600_000),
            serviceSnapshot: { pricing: { totalMinor: 150000 } },
          }),
        }),
      });

      // Wallet covers whole amount (₹1,500)
      mockWallet.planSplit.mockResolvedValueOnce({ walletAmount: 1500, gatewayAmount: 0 });

      const res = await service.createPaymentOrder(bookingId, mockUser, { useWallet: true });
      expect(res.walletPaid).toBe(true);
      expect(mockWallet.spend).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1500, userId: customerId }),
      );
      expect(mockBookingService.confirmPayment).toHaveBeenCalledWith(
        bookingId,
        expect.stringMatching(/^WLT-/),
      );
    });
  });

  describe("confirmPaymentFromWebhook", () => {
    it("returns false when no booking matches the gateway order", async () => {
      mockBookingsModel.findOne.mockResolvedValueOnce(null);

      const handled = await service.confirmPaymentFromWebhook("order_unknown", "pay_unknown");
      expect(handled).toBe(false);
      expect(mockBookingService.confirmPayment).not.toHaveBeenCalled();
    });

    it("returns true and is idempotent when booking was already confirmed", async () => {
      mockBookingsModel.findOne.mockResolvedValueOnce({
        _id: bookingId,
        status: "CONFIRMED",
        bookingNumber: "PJ-261009-ABC123",
      });

      const handled = await service.confirmPaymentFromWebhook("order_rzp_123", "pay_123");
      expect(handled).toBe(true);
      expect(mockBookingService.confirmPayment).not.toHaveBeenCalled();
    });

    it("flags amount mismatch and refuses auto-confirmation", async () => {
      mockBookingsModel.findOne.mockResolvedValueOnce({
        _id: bookingId,
        status: "PAYMENT_PENDING",
        bookingNumber: "PJ-261009-ABC123",
        paymentOrder: { orderId: "order_rzp_123", gatewayMinor: 150000, walletMinor: 0 },
      });

      const handled = await service.confirmPaymentFromWebhook("order_rzp_123", "pay_123", {
        amountPaise: 100000, // 100000 paise != 150000 paise
      });

      expect(handled).toBe(true);
      expect(mockBookingService.confirmPayment).not.toHaveBeenCalled();
    });

    it("refuses a payment on an order that has been replaced by a newer one", async () => {
      mockBookingsModel.findOne.mockResolvedValueOnce({
        _id: bookingId,
        customerUserId: customerId,
        status: "PAYMENT_PENDING",
        bookingNumber: "PJ-261009-ABC123",
        paymentOrder: { orderId: "order_NEWER", gatewayMinor: 150000, walletMinor: 0 },
      });
      expect(await service.confirmPaymentFromWebhook("order_OLD", "pay_1", { amountPaise: 150000 })).toBe(true);
      expect(mockBookingService.confirmPayment).not.toHaveBeenCalled();
    });

    it("confirms payment and updates references when order matches", async () => {
      mockBookingsModel.findOne.mockResolvedValueOnce({
        _id: bookingId,
        customerUserId: customerId,
        status: "PAYMENT_PENDING",
        bookingNumber: "PJ-261009-ABC123",
        paymentOrder: { orderId: "order_rzp_123", gatewayMinor: 150000, walletMinor: 0 },
      });

      const handled = await service.confirmPaymentFromWebhook("order_rzp_123", "pay_123", {
        amountPaise: 150000,
      });

      expect(handled).toBe(true);
      expect(mockBookingService.confirmPayment).toHaveBeenCalledWith(bookingId, "pay_123");
      expect(mockBookingsModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        { $addToSet: { paymentRefs: "pay_123" } },
      );
    });
  });

  describe("handleRefundOnCancellation", () => {
    it("credits wallet when booking has a wallet payment reference", async () => {
      const booking = {
        _id: bookingId,
        customerUserId: customerId,
        bookingNumber: "PJ-261009-ABC123",
        paymentRefs: ["WLT-1234567890"],
        paymentOrder: { orderId: "WLT-1234567890", gatewayMinor: 0, walletMinor: 150000 },
        serviceSnapshot: { pricing: { totalMinor: 150000 } },
      };

      await service.handleRefundOnCancellation(booking, "CHANGE_OF_PLAN");
      expect(mockWallet.credit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: customerId,
          amount: 1500,
          module: "provider_booking",
          category: "refund",
        }),
      );
    });
  });
});
