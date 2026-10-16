import { openRazorpayCheckout } from "../lib/razorpay";
import { foodService } from "./food.service";

/**
 * Pays a food order on Tirvona's Razorpay account. Resolves once the server has
 * verified the payment; throws if the customer cancels or the payment fails
 * (the order then stays "payment pending" and can be paid again).
 */
export const payForFoodOrder = async (
  orderId: string,
  prefill: { name?: string; email?: string; contact?: string } = {},
): Promise<void> => {
  const session = await foodService.createPaymentCheckout(orderId);

  // Local development without Razorpay keys: the server issues a test order.
  if (session.demo) {
    await foodService.confirmPayment(orderId, {
      razorpay_order_id: session.gatewayOrderId,
      razorpay_payment_id: `pay_demo_${Date.now()}`,
    });
    return;
  }

  const result = await openRazorpayCheckout(
    {
      orderId: session.gatewayOrderId,
      amount: session.amountPaise,
      currency: session.currency,
      keyId: session.key,
    },
    prefill,
    { name: "Tirvona Bhojan", description: `Food order ${session.orderNumber}` },
  );
  await foodService.confirmPayment(orderId, result);
};
