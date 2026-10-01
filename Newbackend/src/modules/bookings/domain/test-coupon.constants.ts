import { Types } from "mongoose";

export const TEST_COUPON_OBJECT_ID = new Types.ObjectId(
  "000000000000000000000001",
);
export const TEST_PROMO_CODE = "TEST1";

export const isTestPromoCode = (code?: string | null): boolean => {
  return (code || "").trim().toUpperCase() === TEST_PROMO_CODE;
};

export const createTestCouponObject = (discountAmount = 0) => ({
  _id: TEST_COUPON_OBJECT_ID,
  offerTitle: "Testing Offer (₹1)",
  shortTitle: "Test Offer",
  subtitle: "Testing only - ₹1 rate",
  offerType: "TEST",
  description: "Internal testing offer: Sets payable rate to ₹1",
  promoCode: TEST_PROMO_CODE,
  discountType: "Flat Amount",
  discountValue: discountAmount,
  maximumDiscount: discountAmount,
  minimumBookingAmount: 0,
  validFrom: new Date(2020, 0, 1),
  validTill: new Date(2099, 11, 31),
  maximumRedemptions: 999999,
  remainingRedemptions: 999999,
  perUserLimit: 999999,
  status: "active",
});
