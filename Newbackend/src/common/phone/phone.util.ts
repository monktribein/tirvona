import { normalizeWhatsAppNumber } from "../../integrations/whatsapp/utils/whatsapp-phone.util";

/**
 * The stored form of a phone number. Indian mobiles keep the 10-digit local
 * form existing accounts use; any other country is "+<country><number>".
 * Input that is not a recognisable number is kept as typed (trimmed).
 */
export const canonicalPhone = (phone: string): string => {
  const normalized = normalizeWhatsAppNumber(phone);
  if (!normalized) return phone.trim();
  if (/^91[6-9]\d{9}$/.test(normalized)) return normalized.slice(2);
  return `+${normalized}`;
};

/**
 * Every spelling an existing account may hold for the same number
 * ("+918920877101", "08920877101", "918920877101", "8920877101"). Accounts
 * created before phones were canonicalised keep their original spelling, so
 * duplicate checks and lookups must try all of them.
 */
export const phoneCandidates = (phone: string): string[] => {
  const raw = phone.trim();
  const normalized = normalizeWhatsAppNumber(raw);
  const local =
    normalized?.startsWith("91") && normalized.length === 12
      ? normalized.slice(2)
      : undefined;
  const candidates = [
    raw,
    normalized,
    local,
    local ? `0${local}` : undefined,
    normalized ? `+${normalized}` : undefined,
  ].filter((value): value is string => Boolean(value));
  return [...new Set(candidates)];
};
