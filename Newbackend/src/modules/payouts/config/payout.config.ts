import { registerAs } from "@nestjs/config";

const enabled = (value: string | undefined): boolean =>
  value?.toLowerCase() === "true";

const encryptionKey = (): string => {
  const dedicated = process.env.PAYOUT_ENCRYPTION_KEY?.trim();
  if (dedicated) return dedicated;
  if (process.env.NODE_ENV === "production") return "";
  return (
    process.env.ENCRYPTION_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    ""
  );
};

export const payoutConfig = registerAs("payout", () => ({
  enabled: enabled(process.env.RAZORPAYX_PAYOUT_ENABLED),
  baseUrl: "https://api.razorpay.com/v1",
  keyId: process.env.RAZORPAY_KEY_ID?.trim() ?? "",
  keySecret: process.env.RAZORPAY_KEY_SECRET?.trim() ?? "",
  sourceAccountNumber: process.env.RAZORPAYX_ACCOUNT_NUMBER?.trim() ?? "",
  webhookSecret: process.env.RAZORPAYX_WEBHOOK_SECRET?.trim() ?? "",
  encryptionKey: encryptionKey(),
  timeoutMs: 10_000,
  maxAttempts: 3,
}));
