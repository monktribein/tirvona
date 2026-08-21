import { toast } from "./toast";

let scriptPromise: Promise<boolean> | null = null;

export const loadRazorpayScript = (): Promise<boolean> => {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    if (typeof window !== "undefined" && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
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

export const openRazorpayCheckout = (
  order: RazorpayOrder,
  prefill: { name?: string; email?: string; contact?: string },
): Promise<RazorpayResult> => {
  return loadRazorpayScript()
    .then((ok) => {
      if (!ok)
        throw new Error(
          "Could not load the payment gateway. Check your connection.",
        );
      return new Promise<RazorpayResult>((resolve, reject) => {
        const rzp = new (window as any).Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: "Tirvona (Ashray Bharat)",
          description: "Secure Tirvona Payment",
          prefill,
          theme: { color: "#0A4DA6" },
          handler: (response: RazorpayResult) => resolve(response),
          modal: {
            ondismiss: () => reject(new Error("Payment was cancelled. Nothing was confirmed.")),
          },
        });
        rzp.on("payment.failed", (resp: any) =>
          reject(
            new Error(
              resp?.error?.description ||
                "Payment failed. Your booking was not confirmed.",
            ),
          ),
        );
        rzp.open();
      });
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Payment was not completed. Nothing was confirmed.";
      toast.error(message, { title: "Payment not completed" });
      throw error;
    });
};
