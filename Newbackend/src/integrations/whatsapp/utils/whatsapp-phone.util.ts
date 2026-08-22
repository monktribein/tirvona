const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** Returns the provider-safe international number as digits only. */
export const normalizeWhatsAppNumber = (value: string): string | null => {
  let digits = value.trim().replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^0[6-9]\d{9}$/.test(digits)) digits = digits.slice(1);

  if (INDIAN_MOBILE.test(digits)) return `91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return digits;
  if (/^(?:91){2,}[6-9]\d{9}$/.test(digits))
    return `91${digits.slice(-10)}`;

  // A number beginning with India's country code but not matching an Indian
  // mobile is rejected instead of being passed through as malformed input.
  if (digits.startsWith("91")) return null;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
};

export const maskWhatsAppNumber = (number: string): string =>
  `${"*".repeat(Math.max(0, number.length - 4))}${number.slice(-4)}`;
