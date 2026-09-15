import { normalizeWhatsAppNumber } from "./whatsapp-phone.util";

/** Reason recorded on a notification row blocked by WhatsApp test mode. */
export const WHATSAPP_TEST_MODE_BLOCK_REASON =
  "test_mode_recipient_not_allowed" as const;

export interface WhatsAppTestRecipientPolicy {
  testMode: boolean;
  testRecipients: readonly string[];
}

/**
 * Parses `WHATSAPP_TEST_RECIPIENTS` (comma separated) into unique,
 * provider-safe digits, so `+919876543210`, `919876543210` and `9876543210`
 * are one number. Entries that are not valid WhatsApp numbers are dropped.
 */
export const parseTestRecipients = (
  value: string | undefined,
): readonly string[] =>
  Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => normalizeWhatsAppNumber(entry))
        .filter((number): number is string => Boolean(number)),
    ),
  );

/**
 * Whether a real transactional WhatsApp message may go to this phone.
 *
 * Outside test mode every recipient is allowed, exactly as before. In test mode
 * only allow-listed numbers are; an empty or invalid list blocks everything
 * rather than falling open.
 */
export const isAllowedTestRecipient = (
  policy: WhatsAppTestRecipientPolicy | undefined,
  phone: string | undefined,
): boolean => {
  if (!policy?.testMode) return true;
  const number = normalizeWhatsAppNumber(String(phone ?? ""));
  return Boolean(number && policy.testRecipients.includes(number));
};
