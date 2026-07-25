import crypto from 'crypto';
import config from '../config/env.js';

export const isRazorpayConfigured = () => config.razorpay.configured;

// Create an order on Razorpay via their REST API (no SDK dependency).
// amountInRupees is converted to the smallest currency unit (paise).
export const createRazorpayOrder = async (amountInRupees, receipt) => {
  const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(amountInRupees * 100),
      currency: 'INR',
      receipt,
      payment_capture: 1,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.description || 'Failed to create Razorpay order');
  }
  return data;
};

// Verify the checkout callback signature: HMAC_SHA256(order_id|payment_id, key_secret).
export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  // Constant-time comparison to avoid timing attacks.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
