// Loads the Razorpay Checkout script once and opens the payment modal.
// Used only when the backend reports a real (non-demo) order.

let scriptPromise: Promise<boolean> | null = null;

export const loadRazorpayScript = (): Promise<boolean> => {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => {
      scriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
};

export interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// Opens the checkout modal and resolves with the payment result, or rejects if
// the user closes the modal / the script fails to load.
export const openRazorpayCheckout = (
  order: RazorpayOrder,
  prefill: { name?: string; email?: string; contact?: string }
): Promise<RazorpayResult> =>
  new Promise(async (resolve, reject) => {
    const ok = await loadRazorpayScript();
    if (!ok) {
      reject(new Error('Could not load the payment gateway. Check your connection.'));
      return;
    }

    const rzp = new (window as any).Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'Tirvona (Ashray Bharat)',
      description: 'Sacred Stay Booking',
      prefill,
      theme: { color: '#0A4DA6' },
      handler: (response: RazorpayResult) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled.')),
      },
    });
    rzp.on('payment.failed', (resp: any) =>
      reject(new Error(resp?.error?.description || 'Payment failed.'))
    );
    rzp.open();
  });
